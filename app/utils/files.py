"""File utilities and ProfileManager for profile operations."""

import json
import shutil
import zipfile
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException


def read_file_content(
    path: Path, strip: bool = False, as_json: bool = False
) -> Optional[str | dict]:
    """Read file content with optional processing. Returns None if file doesn't exist."""
    if not path.exists():
        return None
    with open(path) as f:
        content = f.read()
    if strip:
        content = content.strip()
    if as_json:
        return json.loads(content)
    return content


def ensure_file_exists(path: Path, context: str) -> Path:
    """Ensure a file exists, raising HTTPException if not. Returns the path."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=context)
    return path


class ProfileManager:
    """Manages profile file operations."""

    def __init__(self, profiles_dir: Path) -> None:
        self.profiles_dir = profiles_dir

    def ensure_exists(self, profile_name: str) -> None:
        """Raise HTTPException if profile does not exist."""
        if not (self.profiles_dir / profile_name).exists():
            raise HTTPException(
                status_code=404, detail=f"Profile '{profile_name}' not found"
            )

    def ensure_not_exists(self, profile_name: str) -> None:
        """Raise HTTPException if profile already exists."""
        if (self.profiles_dir / profile_name).exists():
            raise HTTPException(
                status_code=400, detail=f"Profile '{profile_name}' already exists"
            )

    def list_profiles(self) -> list[dict]:
        """List all profiles that have an extraction_prompt.txt file."""
        profiles = []
        for item in self.profiles_dir.iterdir():
            if item.is_dir() and (item / "extraction_prompt.txt").exists():
                profiles.append({"name": item.name})
        return sorted(profiles, key=lambda x: x["name"])

    def get_content(self, profile_name: str) -> dict:
        """Read all files from a profile directory."""
        profile_path = self.profiles_dir / profile_name
        if not profile_path.exists():
            raise HTTPException(
                status_code=404, detail=f"Profile '{profile_name}' not found"
            )
        files = {}
        for filename in ["extraction_prompt.txt", "workflow.json", "mappings.json"]:
            filepath = profile_path / filename
            files[filename] = filepath.read_text() if filepath.exists() else None
        return files

    def save_files(self, profile_name: str, files: dict[str, Optional[str]]) -> None:
        """Save all files to a profile directory."""
        profile_path = self.profiles_dir / profile_name
        profile_path.mkdir(parents=True, exist_ok=True)
        for filename, content in files.items():
            if content is not None:
                (profile_path / filename).write_text(content)

    def delete(self, profile_name: str) -> None:
        """Delete a profile directory."""
        profile_path = self.profiles_dir / profile_name
        if profile_path.exists():
            shutil.rmtree(profile_path)

    def rename(self, old_name: str, new_name: str) -> None:
        """Rename a profile directory."""
        shutil.move(
            str(self.profiles_dir / old_name), str(self.profiles_dir / new_name)
        )

    def duplicate(self, source_name: str, new_name: str) -> None:
        """Duplicate a profile directory with a new name."""
        shutil.copytree(
            str(self.profiles_dir / source_name), str(self.profiles_dir / new_name)
        )

    def _create_temp_zip(self) -> str:
        """Create a temporary zip file and return its path."""
        return tempfile.NamedTemporaryFile(delete=False, suffix=".zip").name

    def _write_to_zip(
        self, zipf: zipfile.ZipFile, single_profile: Optional[str] = None
    ) -> None:
        """Write profile files to a ZIP archive."""
        if single_profile:
            profile_path = self.profiles_dir / single_profile
            if profile_path.is_dir():
                for filepath in profile_path.iterdir():
                    zipf.write(filepath, filepath.name)
        else:
            for profile_dir in self.profiles_dir.iterdir():
                if profile_dir.is_dir():
                    for filepath in profile_dir.iterdir():
                        zipf.write(filepath, f"{profile_dir.name}/{filepath.name}")

    def create_zip(self, profile_name: str) -> str:
        """Create a ZIP file for a single profile."""
        zip_path = self._create_temp_zip()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            self._write_to_zip(zipf, single_profile=profile_name)
        return zip_path

    def create_all_zip(self) -> str:
        """Create a ZIP file containing all profiles."""
        zip_path = self._create_temp_zip()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            self._write_to_zip(zipf)
        return zip_path


# Import tempfile at module level
import tempfile
