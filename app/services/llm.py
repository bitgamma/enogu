"""LLM service for image analysis."""

import json

import requests
from fastapi import HTTPException
from PIL import Image

from app.config import (
    DEFAULT_SYSTEM_PROMPT,
    GENERATE_IMAGE_TOOL,
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

    def analyze_image(self, image: Image.Image, extraction_prompt: str) -> dict:
        """
        Send image to LLM for analysis using tool calling.
        Returns dict with 'prompt' and 'status' fields.
        """
        resized_image = resize_image_for_llm(image)
        base64_image = encode_image_to_base64(resized_image)

        tools = [GENERATE_IMAGE_TOOL]

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
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            },
                        },
                        {"type": "text", "text": extraction_prompt},
                    ],
                },
            ],
            "tools": tools,
            "tool_choice": {"type": "function", "function": {"name": "generate_image"}},
            "model": self.model,
        }

        headers = build_llm_headers(self.apikey)

        response = requests.post(
            f"{self.endpoint}/chat/completions",
            headers=headers,
            json=payload,
            timeout=LLM_TIMEOUT_SECONDS,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=500, detail=f"LLM API error: {response.text}"
            )

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

        raise HTTPException(
            status_code=500, detail="LLM did not return a valid tool call"
        )

    def list_models(self) -> list[str]:
        """
        Fetch available models from the LLM endpoint.
        Returns list of model names.
        """
        headers = build_llm_headers(self.apikey)

        # Try common endpoints for listing models
        models_endpoint = f"{self.endpoint}/models"
        if not self.endpoint.endswith("/api/v1"):
            models_endpoint = self.endpoint.rstrip("/") + "/models"

        response = requests.get(models_endpoint, headers=headers, timeout=10)

        if response.ok:
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
            alt_response = requests.get(alt_endpoint, headers=headers, timeout=10)

            if alt_response.ok:
                data = alt_response.json()
                models = data.get("models") or data.get("data") or []
                return _extract_model_names(models)
            else:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to fetch models from LLM endpoint: {alt_response.status_code} {alt_response.text}",
                )


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
