"""ComfyUI service for image generation."""

import asyncio
import base64
from pathlib import Path

import httpx
from fastapi import HTTPException

from app.config import (
    COMFYUI_POLL_INTERVAL_SECONDS,
    COMFYUI_POLL_TIMEOUT_SECONDS,
    get_providers,
)


class ComfyUIService:
    """Service for interacting with ComfyUI API."""

    def __init__(self, endpoint: str) -> None:
        self.endpoint = endpoint

    async def execute(self, workflow: dict, save_path: str | None = None) -> str:
        """
        Execute ComfyUI workflow and return base64 encoded result image.

        If save_path is provided, the raw image bytes are also written to that file.
        """
        async with httpx.AsyncClient(timeout=30) as client:
            # Queue the workflow
            queue_response = await client.post(
                f"{self.endpoint}/prompt",
                json={"prompt": workflow, "client_id": "webapp"},
            )

            if queue_response.status_code != 200:
                raise HTTPException(
                    status_code=500,
                    detail=f"ComfyUI queue error: {queue_response.text}",
                )

            prompt_id = queue_response.json()["prompt_id"]

            # Wait for completion
            history_entry = await self._poll_history(client, prompt_id)

            if "errors" in history_entry:
                raise HTTPException(
                    status_code=500,
                    detail=f"ComfyUI workflow failed: {history_entry['errors']}",
                )

            return await self._extract_image(client, history_entry["outputs"], save_path=save_path)

    execute_async = execute

    async def _poll_history(self, client: httpx.AsyncClient, prompt_id: str) -> dict:
        """Poll ComfyUI history until workflow completes or fails."""
        for _ in range(int(COMFYUI_POLL_TIMEOUT_SECONDS / COMFYUI_POLL_INTERVAL_SECONDS)):
            history_response = await client.get(f"{self.endpoint}/history/{prompt_id}")

            if history_response.status_code != 200:
                raise HTTPException(
                    status_code=500,
                    detail=f"ComfyUI history error: {history_response.text}",
                )

            history = history_response.json()

            if prompt_id in history:
                return history[prompt_id]

            await asyncio.sleep(COMFYUI_POLL_INTERVAL_SECONDS)

        raise HTTPException(status_code=500, detail="ComfyUI workflow timed out")

    async def _extract_image(
        self, client: httpx.AsyncClient, outputs: dict, save_path: str | None = None
    ) -> str:
        """Extract and encode the first image from ComfyUI workflow outputs.

        If save_path is provided, the raw image bytes are also written to that file.
        """
        for node_data in outputs.values():
            if "images" in node_data and "input_images" not in node_data and node_data["images"]:
                image_data = node_data["images"][0]
                view_response = await client.get(
                    f"{self.endpoint}/view?filename={image_data['filename']}"
                    f"&type={image_data['type']}&subfolder={image_data.get('subfolder', '')}"
                )
                image_bytes = view_response.content
                if save_path is not None:
                    Path(save_path).write_bytes(image_bytes)
                return base64.b64encode(image_bytes).decode("utf-8")
        raise HTTPException(status_code=500, detail="No image output from ComfyUI")


def create_comfyui_service() -> ComfyUIService:
    """Create a ComfyUIService instance from the global configuration."""
    providers = get_providers()
    return ComfyUIService(endpoint=providers["comfyui_endpoint"])
