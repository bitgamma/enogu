"""Tests for LLMService using a mocked httpx client."""

import asyncio
from unittest.mock import patch

import httpx
import pytest
from fastapi import HTTPException
from PIL import Image

from app.services.llm import LLMService


def make_response(status_code, json=None):
    request = httpx.Request("GET", "http://test")
    return httpx.Response(status_code, json=json, content=None, request=request)


class FakeClient:
    """Fake async httpx client returning a canned chat completion."""

    def __init__(self, chat_json=None, models_json=None):
        self.chat_json = chat_json
        self.models_json = models_json

    async def post(self, url, **kwargs):
        return make_response(200, json=self.chat_json)

    async def get(self, url, **kwargs):
        return make_response(200, json=self.models_json)


class FakeAClient:
    """Async context manager wrapping a FakeClient."""

    def __init__(self, fake):
        self._fake = fake

    async def __aenter__(self):
        return self._fake

    async def __aexit__(self, *args):
        return False


def _run(coro):
    return asyncio.run(coro)


def _tiny_image() -> Image.Image:
    return Image.new("RGB", (4, 4), color=(10, 20, 30))


def _chat_with_tool_call(status="OK", prompt="a cat", error_reason=None):
    arguments = {"status": status, "prompt": prompt}
    if error_reason:
        arguments["error_reason"] = error_reason
    return {
        "choices": [
            {
                "message": {
                    "tool_calls": [
                        {
                            "function": {
                                "name": "generate_image",
                                "arguments": __import__("json").dumps(arguments),
                            }
                        }
                    ]
                }
            }
        ]
    }


def _make_service(chat_json):
    fake = FakeClient(chat_json=chat_json)
    service = LLMService("http://llm", "apikey", "model")
    return service, fake


class TestLLMService:
    def test_analyze_success(self) -> None:
        service, fake = _make_service(_chat_with_tool_call(status="OK", prompt="a cat"))
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            result = _run(service.analyze_image(_tiny_image(), "extract"))
        assert result == {"status": "OK", "prompt": "a cat", "error_reason": None}

    def test_analyze_nok_includes_error_reason(self) -> None:
        service, fake = _make_service(
            _chat_with_tool_call(status="NOK", prompt="", error_reason="bad image")
        )
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            result = _run(service.analyze_image(_tiny_image(), "extract"))
        assert result["status"] == "NOK"
        assert result["error_reason"] == "bad image"

    def test_analyze_missing_tool_call_raises(self) -> None:
        chat = {"choices": [{"message": {"content": "no tool call"}}]}
        service, fake = _make_service(chat)
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            with pytest.raises(HTTPException) as exc_info:
                _run(service.analyze_image(_tiny_image(), "extract"))
        assert exc_info.value.status_code == 500

    def test_analyze_http_error_raises_500(self) -> None:
        class ErrorClient(FakeClient):
            async def post(self, url, **kwargs):
                return make_response(500, json={"error": "boom"})

        service = LLMService("http://llm", "apikey", "model")
        fake = ErrorClient(chat_json=None)
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            with pytest.raises(HTTPException) as exc_info:
                _run(service.analyze_image(_tiny_image(), "extract"))
        assert exc_info.value.status_code == 500

    def test_list_models_parses_list(self) -> None:
        fake = FakeClient(models_json=["model-a", "model-b"])
        service = LLMService("http://llm", "apikey", "model")
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            result = _run(service.list_models())
        assert result == ["model-a", "model-b"]

    def test_list_models_parses_data_dict(self) -> None:
        fake = FakeClient(models_json={"data": [{"id": "m1"}, {"name": "m2"}]})
        service = LLMService("http://llm/api/v1", "apikey", "model")
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            result = _run(service.list_models())
        assert result == ["m1", "m2"]

    def test_list_models_failure_raises_502(self) -> None:
        class ErrorClient(FakeClient):
            async def get(self, url, **kwargs):
                return make_response(404, json={})

        service = LLMService("http://llm", "apikey", "model")
        fake = ErrorClient(models_json=None)
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            with pytest.raises(HTTPException) as exc_info:
                _run(service.list_models())
        assert exc_info.value.status_code == 502

    def test_generate_image_returns_b64_json(self) -> None:
        image_json = {"data": [{"b64_json": "abc123"}]}
        service = LLMService("http://llm/api/v1", "apikey", "model")
        fake = FakeClient(chat_json=image_json)
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            result = _run(
                service.generate_image("a cat", 42, 512, 512, True, {"steps": 20})
            )
        assert result == "abc123"

    def test_generate_image_sends_preset_and_request_params(self) -> None:
        captured = {}

        class CaptureClient(FakeClient):
            async def post(self, url, **kwargs):
                captured["url"] = url
                captured["json"] = kwargs.get("json")
                return make_response(200, json={"data": [{"b64_json": "img"}]})

        service = LLMService("http://llm/api/v1", "apikey", "model")
        fake = CaptureClient()
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            _run(
                service.generate_image(
                    "a cat",
                    7,
                    768,
                    1024,
                    True,
                    {"steps": 20, "sampler": "er_sde"},
                )
            )
        assert captured["url"] == "http://llm/api/v1/images/generations"
        body = captured["json"]
        assert body["prompt"] == "a cat"
        assert body["seed"] == 7
        assert body["width"] == 768
        assert body["height"] == 1024
        assert body["upscale"] is True
        assert body["steps"] == 20
        assert body["sampler"] == "er_sde"

    def test_generate_image_http_error_raises_500(self) -> None:
        class ErrorClient(FakeClient):
            async def post(self, url, **kwargs):
                return make_response(500, json={"error": "boom"})

        service = LLMService("http://llm", "apikey", "model")
        fake = ErrorClient()
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            with pytest.raises(HTTPException) as exc_info:
                _run(service.generate_image("a cat", 1, 512, 512, False, {}))
        assert exc_info.value.status_code == 500

    def test_generate_image_no_data_raises_500(self) -> None:
        service = LLMService("http://llm", "apikey", "model")
        fake = FakeClient(chat_json={"data": []})
        with patch("app.services.llm.httpx.AsyncClient") as aclient_cls:
            aclient_cls.return_value = FakeAClient(fake)
            with pytest.raises(HTTPException) as exc_info:
                _run(service.generate_image("a cat", 1, 512, 512, False, {}))
        assert exc_info.value.status_code == 500
