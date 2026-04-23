"""Tests for ProfileManager."""

import tempfile
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.utils import ProfileManager


@pytest.fixture
def temp_profiles_dir() -> Path:
    """Create a temporary directory for profiles."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def profile_manager(temp_profiles_dir: Path) -> ProfileManager:
    """Create a ProfileManager instance with temp directory."""
    return ProfileManager(temp_profiles_dir)


def _create_test_profile(manager: ProfileManager, name: str) -> None:
    """Helper to create a test profile directory with required files."""
    profile_dir = manager.profiles_dir / name
    profile_dir.mkdir(parents=True, exist_ok=True)
    (profile_dir / "extraction_prompt.txt").write_text("Test prompt")
    (profile_dir / "workflow.json").write_text("{}")
    (profile_dir / "mappings.json").write_text("{}")


class TestProfileManager:
    """Tests for ProfileManager."""

    def test_list_profiles_empty(self, profile_manager: ProfileManager) -> None:
        assert profile_manager.list_profiles() == []

    def test_list_profiles_with_profiles(self, profile_manager: ProfileManager) -> None:
        _create_test_profile(profile_manager, "profile1")
        _create_test_profile(profile_manager, "profile2")
        profiles = profile_manager.list_profiles()
        assert len(profiles) == 2
        assert profiles[0]["name"] == "profile1"
        assert profiles[1]["name"] == "profile2"

    def test_get_content(self, profile_manager: ProfileManager) -> None:
        _create_test_profile(profile_manager, "test_profile")
        content = profile_manager.get_content("test_profile")
        assert content["extraction_prompt.txt"] == "Test prompt"
        assert content["workflow.json"] == "{}"
        assert content["mappings.json"] == "{}"

    def test_get_content_nonexistent(self, profile_manager: ProfileManager) -> None:
        with pytest.raises(HTTPException) as exc_info:
            profile_manager.get_content("nonexistent")
        assert exc_info.value.status_code == 404

    def test_save_files(self, profile_manager: ProfileManager) -> None:
        files = {
            "extraction_prompt.txt": "New prompt",
            "workflow.json": '{"nodes": []}',
            "mappings.json": None,  # None means don't create
        }
        profile_manager.save_files("new_profile", files)
        assert (profile_manager.profiles_dir / "new_profile").exists()
        assert (profile_manager.profiles_dir / "new_profile" / "extraction_prompt.txt").read_text() == "New prompt"

    def test_delete(self, profile_manager: ProfileManager) -> None:
        _create_test_profile(profile_manager, "to_delete")
        profile_manager.delete("to_delete")
        assert not (profile_manager.profiles_dir / "to_delete").exists()

    def test_delete_nonexistent(self, profile_manager: ProfileManager) -> None:
        # Should not raise - delete is idempotent
        profile_manager.delete("nonexistent")

    def test_rename(self, profile_manager: ProfileManager) -> None:
        _create_test_profile(profile_manager, "old_name")
        profile_manager.rename("old_name", "new_name")
        assert not (profile_manager.profiles_dir / "old_name").exists()
        assert (profile_manager.profiles_dir / "new_name").exists()

    def test_duplicate(self, profile_manager: ProfileManager) -> None:
        _create_test_profile(profile_manager, "source")
        profile_manager.duplicate("source", "duplicate")
        assert (profile_manager.profiles_dir / "duplicate").exists()
        assert (profile_manager.profiles_dir / "duplicate" / "extraction_prompt.txt").read_text() == "Test prompt"

    def test_ensure_exists_raises(self, profile_manager: ProfileManager) -> None:
        with pytest.raises(HTTPException) as exc_info:
            profile_manager.ensure_exists("nonexistent")
        assert exc_info.value.status_code == 404

    def test_ensure_not_exists_raises(self, profile_manager: ProfileManager) -> None:
        _create_test_profile(profile_manager, "existing")
        with pytest.raises(HTTPException) as exc_info:
            profile_manager.ensure_not_exists("existing")
        assert exc_info.value.status_code == 400
