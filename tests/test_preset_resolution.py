"""Tests for preset-owned resolution targeting.

The preset stores a `target_megapixels` value (1 MP = 1024x1024 pixels). The
backend stores it, exposes it on the preset listing (so the UI can compute the
actual size), and must never forward it to the generation endpoint. The backend
does not compute or validate sizes: it generates whatever width/height it is sent.
"""

import base64
import json
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routes import generation as generation_routes
from app.services.preset import get_preset
from app.utils import PresetManager, coerce_preset_resolution_fields


@pytest.fixture
def presets_dir() -> Path:
    """Create a temporary directory for presets."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def _write_settings(presets_dir: Path, name: str, settings: object) -> None:
    """Write a preset's settings.json (dict -> JSON, str -> verbatim)."""
    preset_dir = presets_dir / name
    preset_dir.mkdir(parents=True, exist_ok=True)
    content = settings if isinstance(settings, str) else json.dumps(settings)
    (preset_dir / "settings.json").write_text(content)


class TestCoerceResolutionFields:
    """Type-safety net for the resolution fields exposed by the preset listing."""

    def test_reads_valid_values(self) -> None:
        assert coerce_preset_resolution_fields({"target_megapixels": 1.5, "resolution_divisor": 16}) == (
            1.5,
            16,
        )

    def test_integer_megapixels_become_float(self) -> None:
        target, _ = coerce_preset_resolution_fields({"target_megapixels": 2})
        assert target == 2.0
        assert isinstance(target, float)

    def test_missing_keys_are_none(self) -> None:
        assert coerce_preset_resolution_fields({"steps": 20}) == (None, None)

    def test_no_range_is_enforced(self) -> None:
        # Large/small targets are the preset's business, not the backend's.
        assert coerce_preset_resolution_fields({"target_megapixels": 0.05})[0] == 0.05
        assert coerce_preset_resolution_fields({"target_megapixels": 128})[0] == 128.0

    @pytest.mark.parametrize("value", ["1.0", True, None, 0, -1, [], {}])
    def test_unusable_megapixels_are_none(self, value: object) -> None:
        assert coerce_preset_resolution_fields({"target_megapixels": value})[0] is None

    @pytest.mark.parametrize("value", ["8", True, None, 0, -8])
    def test_unusable_divisor_is_none(self, value: object) -> None:
        assert coerce_preset_resolution_fields({"resolution_divisor": value})[1] is None

    def test_float_divisor_is_truncated(self) -> None:
        assert coerce_preset_resolution_fields({"resolution_divisor": 8.7})[1] == 8

    @pytest.mark.parametrize("settings", [None, [], "nope", 42])
    def test_non_dict_settings(self, settings: object) -> None:
        assert coerce_preset_resolution_fields(settings) == (None, None)


class TestPresetListing:
    """The listing must carry the resolution fields the UI needs."""

    def test_list_exposes_resolution_fields(self, presets_dir: Path) -> None:
        manager = PresetManager(presets_dir)
        _write_settings(presets_dir, "big", {"steps": 8, "target_megapixels": 2.0, "resolution_divisor": 16})
        _write_settings(presets_dir, "plain", {"steps": 20})

        listed = {item["name"]: item for item in manager.list_presets()}

        assert listed["big"]["target_megapixels"] == 2.0
        assert listed["big"]["resolution_divisor"] == 16
        assert listed["plain"]["target_megapixels"] is None
        assert listed["plain"]["resolution_divisor"] is None

    def test_list_survives_broken_settings(self, presets_dir: Path) -> None:
        manager = PresetManager(presets_dir)
        _write_settings(presets_dir, "broken", "{not json")

        assert manager.list_presets() == [{"name": "broken", "target_megapixels": None, "resolution_divisor": None}]


class TestGetPresetStripping:
    """Resolution fields are app-level and must not reach the generation endpoint."""

    def test_reserved_keys_are_stripped(self, presets_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        _write_settings(
            presets_dir,
            "p",
            {"steps": 8, "target_megapixels": 1.5, "resolution_divisor": 8, "custom": "kept"},
        )
        monkeypatch.setattr("app.services.preset.PRESETS_DIR", presets_dir)

        settings = get_preset("p")

        assert "target_megapixels" not in settings
        assert "resolution_divisor" not in settings
        assert settings == {"steps": 8, "custom": "kept"}

    def test_other_settings_untouched(self, presets_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        _write_settings(presets_dir, "p", {"model": "Anima-VAE", "steps": 20})
        monkeypatch.setattr("app.services.preset.PRESETS_DIR", presets_dir)

        assert get_preset("p") == {"model": "Anima-VAE", "steps": 20}


class _FakeLLMService:
    """Captures what the route hands to the LLM service."""

    def __init__(self) -> None:
        self.kwargs: dict | None = None

    async def generate_image(self, **kwargs: object) -> str:
        self.kwargs = kwargs
        return base64.b64encode(b"fake-png").decode()


@pytest.fixture
def fake_llm(monkeypatch: pytest.MonkeyPatch) -> _FakeLLMService:
    fake = _FakeLLMService()
    monkeypatch.setattr(generation_routes, "create_llm_service", lambda: fake)
    return fake


class TestGenerateRouteSizeHandling:
    """The route generates exactly the size it is asked for - no clamping, no recompute."""

    def _post(self, **overrides: object):
        data = {"prompt": "a cat", "preset": "p", "width": 888, "height": 1184, "seed": 3}
        data.update(overrides)
        return TestClient(app).post("/api/generate", data=data)

    def test_non_aligned_size_passes_through(
        self,
        presets_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        fake_llm: _FakeLLMService,
    ) -> None:
        _write_settings(presets_dir, "p", {"steps": 8, "target_megapixels": 1.0})
        monkeypatch.setattr("app.services.preset.PRESETS_DIR", presets_dir)

        response = self._post(width=1234, height=567)

        assert response.status_code == 200
        assert fake_llm.kwargs is not None
        assert fake_llm.kwargs["width"] == 1234
        assert fake_llm.kwargs["height"] == 567

    def test_large_size_is_accepted(
        self,
        presets_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        fake_llm: _FakeLLMService,
    ) -> None:
        _write_settings(presets_dir, "p", {"steps": 8})
        monkeypatch.setattr("app.services.preset.PRESETS_DIR", presets_dir)

        response = self._post(width=4096, height=8192)

        assert response.status_code == 200
        assert fake_llm.kwargs is not None
        assert (fake_llm.kwargs["width"], fake_llm.kwargs["height"]) == (4096, 8192)

    def test_target_megapixels_is_not_forwarded(
        self,
        presets_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        fake_llm: _FakeLLMService,
    ) -> None:
        _write_settings(presets_dir, "p", {"steps": 8, "target_megapixels": 3.0, "resolution_divisor": 16})
        monkeypatch.setattr("app.services.preset.PRESETS_DIR", presets_dir)

        response = self._post()

        assert response.status_code == 200
        assert fake_llm.kwargs is not None
        assert fake_llm.kwargs["preset_params"] == {"steps": 8}

    def test_response_contains_image_data_url(
        self,
        presets_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        fake_llm: _FakeLLMService,
    ) -> None:
        _write_settings(presets_dir, "p", {"steps": 8})
        monkeypatch.setattr("app.services.preset.PRESETS_DIR", presets_dir)

        response = self._post()

        assert response.json()["image"].startswith("data:image/png;base64,")
