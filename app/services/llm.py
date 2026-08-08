"""LLM service for image analysis."""

import json

import httpx
from fastapi import HTTPException
from PIL import Image

from app.config import (
    DEFAULT_SYSTEM_PROMPT,
    GENERATE_IMAGE_TOOL,
    IMAGE_GEN_TIMEOUT_SECONDS,
    LLM_TIMEOUT_SECONDS,
    get_providers,
)
from app.utils.image import encode_image_to_base64, resize_image_for_llm
from app.utils.validation import build_llm_headers


class LLMService:
    """Service for interacting with LLM APIs."""

    def __init__(
        self,
        endpoint: str,
        apikey: str,
        model: str,
        system_prompt: str | None = None,
    ) -> None:
        self.endpoint = endpoint
        self.apikey = apikey
        self.model = model
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT

    async def analyze_image(self, image: Image.Image, extraction_prompt: str) -> dict:
        """
        Send image to LLM for analysis using tool calling.
        Returns dict with 'prompt' and 'status' fields.
        """
        resized_image = resize_image_for_llm(image)
        base64_image = encode_image_to_base64(resized_image)

        payload = {
            "messages": [
                {
                    "role": "system",
                    "content": self.system_prompt,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{base64_image}"},
                        },
                        {"type": "text", "text": extraction_prompt},
                    ],
                },
            ],
            "tools": [GENERATE_IMAGE_TOOL],
            "tool_choice": {"type": "function", "function": {"name": "generate_image"}},
            "model": self.model,
        }

        headers = build_llm_headers(self.apikey)

        async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{self.endpoint}/chat/completions",
                headers=headers,
                json=payload,
            )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"LLM API error: {response.text}")

        result = response.json()
        message = result["choices"][0]["message"]

        # Handle tool call response
        if "tool_calls" in message and message["tool_calls"]:
            tool_call = message["tool_calls"][0]
            if tool_call["function"]["name"] == "generate_image":
                arguments = json.loads(tool_call["function"]["arguments"])
                return {
                    "status": arguments.get("status", "NOK"),
                    "prompt": arguments.get("prompt", ""),
                    "error_reason": arguments.get("error_reason"),
                }

        raise HTTPException(status_code=500, detail="LLM did not return a valid tool call")

    async def generate_image(
        self,
        prompt: str,
        seed: int,
        width: int,
        height: int,
        upscale: bool,
        preset_params: dict,
    ) -> str:
        """Generate an image via the OpenAI-compatible endpoint.

        The endpoint accepts standard "prompt" and "seed" fields plus the
        non-standard generation parameters. Parameters that do not change
        per-request are provided by the preset (preset_params); prompt, seed,
        width, height and upscale are filled from the request.

        Returns the base64-encoded PNG image.
        """
        payload = {
            "prompt": prompt,
            "seed": seed,
            "width": width,
            "height": height,
            "upscale": upscale,
            **preset_params,
        }

        headers = build_llm_headers(self.apikey)

        async with httpx.AsyncClient(timeout=IMAGE_GEN_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{self.endpoint}/images/generations",
                headers=headers,
                json=payload,
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=500, detail=f"Image generation API error: {response.text}"
            )

        return _extract_image_base64(response.json(), response.content)

    async def list_models(self) -> list[str]:
        """
        Fetch available models from the LLM endpoint.
        Returns list of model names.
        """
        headers = build_llm_headers(self.apikey)

        # Try common endpoints for listing models
        models_endpoint = f"{self.endpoint}/models"
        if not self.endpoint.endswith("/api/v1"):
            models_endpoint = self.endpoint.rstrip("/") + "/models"

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(models_endpoint, headers=headers)

            if response.is_success:
                data = response.json()
                models = []
                if isinstance(data, list):
                    models = data
                elif isinstance(data, dict):
                    if "models" in data and isinstance(data["models"], list):
                        models = data["models"]
                    elif "data" in data and isinstance(data["data"], list):
                        models = data["data"]
                return _extract_model_names(models)
            else:
                # Try alternative endpoint format
                alt_endpoint = self.endpoint.replace("/api/v1", "").rstrip("/") + "/models"
                alt_response = await client.get(alt_endpoint, headers=headers)

                if alt_response.is_success:
                    data = alt_response.json()
                    models = data.get("models") or data.get("data") or []
                    return _extract_model_names(models)
                else:
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            f"Failed to fetch models from LLM endpoint: "
                            f"{alt_response.status_code} {alt_response.text}"
                        ),
                    )


def _extract_image_base64(result: dict, raw_content: bytes) -> str:
    """Extract a base64 image from various OpenAI-compatible response formats."""
    if isinstance(result, dict):
        # Standard OpenAI-style response: data[0].b64_json
        data = result.get("data")
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("b64_json"):
                    return item["b64_json"]
        # Some custom endpoints return the image directly under a key
        for key in ("image", "b64_json", "base64", "images"):
            value = result.get(key)
            if isinstance(value, str) and value:
                return value
            if isinstance(value, list) and value and isinstance(value[0], str):
                return value[0]
        raise HTTPException(status_code=500, detail="No image returned from generation endpoint")
    # Fall back to a raw base64 body for non-JSON responses
    text = raw_content.decode("utf-8", errors="ignore").strip() if raw_content else ""
    if text and not text.startswith("{"):
        return text
    raise HTTPException(status_code=500, detail="No image returned from generation endpoint")


def _extract_model_names(models: list) -> list[str]:
    """Extract model names from various API response formats."""
    model_list = []
    for model in models:
        if isinstance(model, str):
            model_list.append(model)
        elif isinstance(model, dict):
            model_id = model.get("id") or model.get("name") or model.get("model")
            if model_id:
                model_list.append(model_id)
    return model_list


def create_llm_service() -> LLMService:
    """Create an LLMService instance from the global configuration."""
    providers = get_providers()
    return LLMService(
        endpoint=providers["llm_endpoint"],
        apikey=providers["llm_apikey"],
        model=providers["llm_model"],
        system_prompt=providers.get("system_prompt"),
    )
