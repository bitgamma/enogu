"""Tests for ComfyUIService using a mocked httpx client."""

import asyncio
import base64
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from fastapi import HTTPException

from app.services import comfyui
from app.services.comfyui import ComfyUIService


def make_response(status_code, json=None, content=None):
    request = httpx.Request("GET", "http://test")
    return httpx.Response(status_code, json=json, content=content, request=request)


class FakeClient:
    """Fake async httpx client that routes queue/history/view requests."""

    def __init__(self, queue_json=None, history_json=None, view_content=b"image"):
        self.queue_json = queue_json
        self.history_json = history_json
        self.view_content = view_content

    async def post(self, url, **kwargs):
        return make_response(200, json=self.queue_json)

    async def get(self, url, **kwargs):
        if "/history/" in url:
            return make_response(200, json=self.history_json)
        if "/view" in url:
            return make_response(200, content=self.view_content)
        return make_response(404)


class ErrorQueueClient(FakeClient):
    """Fake client whose queue request returns an error."""

    async def post(self, url, **kwargs):
        return make_response(500, json={"error": "bad"})


class FakeAClient:
    """Async context manager wrapping a FakeClient."""

    def __init__(self, fake):
        self._fake = fake

    async def __aenter__(self):
        return self._fake

    async def __aexit__(self, *args):
        return False


def _run(workflow, fake, endpoint="http://comfy"):
    """Execute a workflow against a fake client via the real service."""
    service = ComfyUIService(endpoint)
    with patch("app.services.comfyui.httpx.AsyncClient") as aclient_cls:
        aclient_cls.return_value = FakeAClient(fake)
        return asyncio.run(service.execute(workflow))


QUEUE = {"prompt_id": "abc123"}
HISTORY = {
    "abc123": {
        "outputs": {
            "9": {"images": [{"filename": "out.png", "type": "output", "subfolder": ""}]}
        }
    }
}


class TestComfyUIService:
    def test_success_returns_base64_image(self) -> None:
        fake = FakeClient(queue_json=QUEUE, history_json=HISTORY, view_content=b"raw-image")
        result = _run({"nodes": []}, fake)
        assert result == base64.b64encode(b"raw-image").decode("utf-8")

    def test_save_path_writes_raw_bytes(self, tmp_path: Path) -> None:
        fake = FakeClient(queue_json=QUEUE, history_json=HISTORY, view_content=b"raw-image")
        save_path = str(tmp_path / "out.png")
        service = ComfyUIService("http://comfy")
        with patch("app.services.comfyui.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            asyncio.run(service.execute({"nodes": []}, save_path=save_path))
        assert Path(save_path).read_bytes() == b"raw-image"

    def test_queue_error_raises_500(self) -> None:
        fake = ErrorQueueClient(queue_json=None, history_json=HISTORY)
        with pytest.raises(HTTPException) as exc_info:
            _run({"nodes": []}, fake)
        assert exc_info.value.status_code == 500

    def test_workflow_errors_raise_500(self) -> None:
        history = {"abc123": {"errors": {"node": "failed"}}}
        fake = FakeClient(queue_json=QUEUE, history_json=history)
        with pytest.raises(HTTPException) as exc_info:
            _run({"nodes": []}, fake)
        assert exc_info.value.status_code == 500

    def test_no_image_output_raises_500(self) -> None:
        history = {"abc123": {"outputs": {}}}
        fake = FakeClient(queue_json=QUEUE, history_json=history)
        with pytest.raises(HTTPException) as exc_info:
            _run({"nodes": []}, fake)
        assert exc_info.value.status_code == 500

    def test_timeout_raises_500(self, monkeypatch) -> None:
        monkeypatch.setattr(comfyui, "COMFYUI_POLL_TIMEOUT_SECONDS", 0.6)
        monkeypatch.setattr(comfyui, "COMFYUI_POLL_INTERVAL_SECONDS", 0.1)
        # history endpoint returns empty dict -> never resolves -> timeout
        fake = FakeClient(queue_json=QUEUE, history_json={})
        service = ComfyUIService("http://comfy")
        with patch("app.services.comfyui.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(service.execute({"nodes": []}))
        assert exc_info.value.status_code == 500
        assert "timed out" in exc_info.value.detail
