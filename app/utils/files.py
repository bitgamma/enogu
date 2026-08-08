"""File utilities and generic manager for file-set directories."""

import json
import shutil
import tempfile
import zipfile
from pathlib import Path

from fastapi import HTTPException


def read_file_content(path: Path, strip: bool = False, as_json: bool = False) -> str | dict | None:
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


class FileSetManager:
    """Generic manager for a set of files stored in per-name directories."""

    def __init__(self, base_dir: Path, filenames: list[str], label: str) -> None:
        self.base_dir = base_dir
        self.filenames = filenames
        self.label = label

    def _dir(self, name: str) -> Path:
        return self.base_dir / name

    def ensure_exists(self, name: str) -> None:
        """Raise HTTPException if the item does not exist."""
        if not self._dir(name).exists():
            raise HTTPException(status_code=404, detail=f"{self.label} '{name}' not found")

    def ensure_not_exists(self, name: str) -> None:
        """Raise HTTPException if the item already exists."""
        if self._dir(name).exists():
            raise HTTPException(status_code=400, detail=f"{self.label} '{name}' already exists")

    def list_items(self) -> list[dict]:
        """List all items that have the primary managed file present."""
        items = []
        for item in self.base_dir.iterdir():
            if item.is_dir() and (item / self.filenames[0]).exists():
                items.append({"name": item.name})
        return sorted(items, key=lambda x: x["name"])

    def get_content(self, name: str) -> dict:
        """Read all managed files from an item directory."""
        directory = self._dir(name)
        if not directory.exists():
            raise HTTPException(status_code=404, detail=f"{self.label} '{name}' not found")
        files = {}
        for filename in self.filenames:
            filepath = directory / filename
            files[filename] = filepath.read_text() if filepath.exists() else None
        return files

    def save_files(self, name: str, files: dict[str, str | None]) -> None:
        """Save files to an item directory (creating it if needed)."""
        directory = self._dir(name)
        directory.mkdir(parents=True, exist_ok=True)
        for filename, content in files.items():
            if content is not None:
                (directory / filename).write_text(content)

    def delete(self, name: str) -> None:
        """Delete an item directory."""
        directory = self._dir(name)
        if directory.exists():
            shutil.rmtree(directory)

    def rename(self, old_name: str, new_name: str) -> None:
        """Rename an item directory."""
        shutil.move(str(self._dir(old_name)), str(self._dir(new_name)))

    def duplicate(self, source_name: str, new_name: str) -> None:
        """Duplicate an item directory with a new name."""
        shutil.copytree(str(self._dir(source_name)), str(self._dir(new_name)))

    def _create_temp_zip(self) -> str:
        """Create a temporary zip file and return its path."""
        return tempfile.NamedTemporaryFile(delete=False, suffix=".zip").name

    def _write_to_zip(self, zipf: zipfile.ZipFile, single: str | None = None) -> None:
        """Write item files to a ZIP archive."""
        if single:
            item_path = self._dir(single)
            if item_path.is_dir():
                for filepath in item_path.iterdir():
                    zipf.write(filepath, filepath.name)
        else:
            for item_dir in self.base_dir.iterdir():
                if item_dir.is_dir():
                    for filepath in item_dir.iterdir():
                        zipf.write(filepath, f"{item_dir.name}/{filepath.name}")

    def create_zip(self, name: str) -> str:
        """Create a ZIP file for a single item."""
        zip_path = self._create_temp_zip()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            self._write_to_zip(zipf, single=name)
        return zip_path

    def create_all_zip(self) -> str:
        """Create a ZIP file containing all items."""
        zip_path = self._create_temp_zip()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            self._write_to_zip(zipf)
        return zip_path


class ProfileManager(FileSetManager):
    """Manages profile directories (extraction_prompt.txt)."""

    def __init__(self, profiles_dir: Path) -> None:
        super().__init__(profiles_dir, ["extraction_prompt.txt"], label="Profile")
        self.profiles_dir = profiles_dir

    def list_profiles(self) -> list[dict]:
        """List all profiles."""
        return self.list_items()


class PresetManager(FileSetManager):
    """Manages preset directories (settings.json)."""

    def __init__(self, presets_dir: Path) -> None:
        super().__init__(presets_dir, ["settings.json"], label="Preset")
        self.presets_dir = presets_dir
        self.presets_dir.mkdir(parents=True, exist_ok=True)

    def list_presets(self) -> list[dict]:
        """List all presets."""
        return self.list_items()
