"""ComfyUI service for image generation."""

import asyncio
import base64
import time

import requests
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

    def execute(self, workflow: dict) -> str:
        """
        Execute ComfyUI workflow and return base64 encoded result image.
        """
        # Queue the workflow
        queue_response = requests.post(
            f"{self.endpoint}/prompt",
            json={"prompt": workflow, "client_id": "webapp"},
        )

        if queue_response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"ComfyUI queue error: {queue_response.text}")

        prompt_id = queue_response.json()["prompt_id"]

        # Wait for completion
        history_entry = self._poll_history(prompt_id)

        if "errors" in history_entry:
            raise HTTPException(
                status_code=500,
                detail=f"ComfyUI workflow failed: {history_entry['errors']}",
            )

        return self._extract_image(history_entry["outputs"])

    async def execute_async(self, workflow: dict) -> str:
        """
        Execute ComfyUI workflow asynchronously and return base64 encoded result image.
        """
        # Queue the workflow
        queue_response = requests.post(
            f"{self.endpoint}/prompt",
            json={"prompt": workflow, "client_id": "webapp"},
        )

        if queue_response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"ComfyUI queue error: {queue_response.text}")

        prompt_id = queue_response.json()["prompt_id"]

        # Wait for completion
        history_entry = await self._poll_history_async(prompt_id)

        if "errors" in history_entry:
            raise HTTPException(
                status_code=500,
                detail=f"ComfyUI workflow failed: {history_entry['errors']}",
            )

        return self._extract_image(history_entry["outputs"])

    def _poll_history(self, prompt_id: str) -> dict:
        """Poll ComfyUI history synchronously until workflow completes or fails."""
        for _ in range(int(COMFYUI_POLL_TIMEOUT_SECONDS / COMFYUI_POLL_INTERVAL_SECONDS)):
            history_response = requests.get(f"{self.endpoint}/history/{prompt_id}")

            if history_response.status_code != 200:
                raise HTTPException(
                    status_code=500,
                    detail=f"ComfyUI history error: {history_response.text}",
                )

            history = history_response.json()

            if prompt_id in history:
                return history[prompt_id]

            time.sleep(COMFYUI_POLL_INTERVAL_SECONDS)

        raise HTTPException(status_code=500, detail="ComfyUI workflow timed out")

    async def _poll_history_async(self, prompt_id: str) -> dict:
        """Poll ComfyUI history asynchronously until workflow completes or fails."""
        for _ in range(int(COMFYUI_POLL_TIMEOUT_SECONDS / COMFYUI_POLL_INTERVAL_SECONDS)):
            history_response = requests.get(f"{self.endpoint}/history/{prompt_id}")

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

    def _extract_image(self, outputs: dict) -> str:
        """Extract and encode the first image from ComfyUI workflow outputs."""
        for _node_id, node_data in outputs.items():
            if "images" in node_data:
                image_data = node_data["images"][0]
                image_bytes = requests.get(
                    f"{self.endpoint}/view?filename={image_data['filename']}&type={image_data['type']}&subfolder={image_data.get('subfolder', '')}"
                ).content
                return base64.b64encode(image_bytes).decode("utf-8")
        raise HTTPException(status_code=500, detail="No image output from ComfyUI")


def create_comfyui_service() -> ComfyUIService:
    """Create a ComfyUIService instance from the global configuration."""
    providers = get_providers()
    return ComfyUIService(endpoint=providers["comfyui_endpoint"])
