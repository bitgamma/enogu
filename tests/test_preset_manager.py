"""Tests for PresetManager."""

import tempfile
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.utils import PresetManager


@pytest.fixture
def temp_presets_dir() -> Path:
    """Create a temporary directory for presets."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def preset_manager(temp_presets_dir: Path) -> PresetManager:
    """Create a PresetManager instance with temp directory."""
    return PresetManager(temp_presets_dir)


def _create_test_preset(manager: PresetManager, name: str) -> None:
    """Helper to create a test preset directory with the required settings file."""
    preset_dir = manager.presets_dir / name
    preset_dir.mkdir(parents=True, exist_ok=True)
    (preset_dir / "settings.json").write_text('{"steps": 20, "sampler": "er_sde"}')


class TestPresetManager:
    """Tests for PresetManager."""

    def test_list_presets_empty(self, preset_manager: PresetManager) -> None:
        assert preset_manager.list_presets() == []

    def test_list_presets_with_presets(self, preset_manager: PresetManager) -> None:
        _create_test_preset(preset_manager, "preset1")
        _create_test_preset(preset_manager, "preset2")
        presets = preset_manager.list_presets()
        assert len(presets) == 2
        assert presets[0]["name"] == "preset1"
        assert presets[1]["name"] == "preset2"

    def test_get_content(self, preset_manager: PresetManager) -> None:
        _create_test_preset(preset_manager, "test_preset")
        content = preset_manager.get_content("test_preset")
        assert '"steps": 20' in content["settings.json"]

    def test_get_content_nonexistent(self, preset_manager: PresetManager) -> None:
        with pytest.raises(HTTPException) as exc_info:
            preset_manager.get_content("nonexistent")
        assert exc_info.value.status_code == 404

    def test_save_files(self, preset_manager: PresetManager) -> None:
        files = {"settings.json": '{"steps": 30}'}
        preset_manager.save_files("new_preset", files)
        assert (preset_manager.presets_dir / "new_preset").exists()
        assert (
            preset_manager.presets_dir / "new_preset" / "settings.json"
        ).read_text() == '{"steps": 30}'

    def test_delete(self, preset_manager: PresetManager) -> None:
        _create_test_preset(preset_manager, "to_delete")
        preset_manager.delete("to_delete")
        assert not (preset_manager.presets_dir / "to_delete").exists()

    def test_rename(self, preset_manager: PresetManager) -> None:
        _create_test_preset(preset_manager, "old_name")
        preset_manager.rename("old_name", "new_name")
        assert not (preset_manager.presets_dir / "old_name").exists()
        assert (preset_manager.presets_dir / "new_name").exists()

    def test_duplicate(self, preset_manager: PresetManager) -> None:
        _create_test_preset(preset_manager, "source")
        preset_manager.duplicate("source", "duplicate")
        assert (preset_manager.presets_dir / "duplicate").exists()
        assert (
            preset_manager.presets_dir / "duplicate" / "settings.json"
        ).read_text() == '{"steps": 20, "sampler": "er_sde"}'

    def test_create_zip(self, preset_manager: PresetManager) -> None:
        _create_test_preset(preset_manager, "zippable")
        zip_path = preset_manager.create_zip("zippable")
        assert Path(zip_path).exists()
        Path(zip_path).unlink()
