"""File utilities and ProfileManager for profile operations."""

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


class ProfileManager:
    """Manages profile file operations."""

    def __init__(self, profiles_dir: Path) -> None:
        self.profiles_dir = profiles_dir

    def ensure_exists(self, profile_name: str) -> None:
        """Raise HTTPException if profile does not exist."""
        if not (self.profiles_dir / profile_name).exists():
            raise HTTPException(status_code=404, detail=f"Profile '{profile_name}' not found")

    def ensure_not_exists(self, profile_name: str) -> None:
        """Raise HTTPException if profile already exists."""
        if (self.profiles_dir / profile_name).exists():
            raise HTTPException(status_code=400, detail=f"Profile '{profile_name}' already exists")

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
            raise HTTPException(status_code=404, detail=f"Profile '{profile_name}' not found")
        files = {}
        for filename in ["extraction_prompt.txt", "workflow.json", "mappings.json"]:
            filepath = profile_path / filename
            files[filename] = filepath.read_text() if filepath.exists() else None
        return files

    def save_files(self, profile_name: str, files: dict[str, str | None]) -> None:
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
        shutil.move(str(self.profiles_dir / old_name), str(self.profiles_dir / new_name))

    def duplicate(self, source_name: str, new_name: str) -> None:
        """Duplicate a profile directory with a new name."""
        shutil.copytree(str(self.profiles_dir / source_name), str(self.profiles_dir / new_name))

    def _create_temp_zip(self) -> str:
        """Create a temporary zip file and return its path."""
        return tempfile.NamedTemporaryFile(delete=False, suffix=".zip").name

    def _write_to_zip(self, zipf: zipfile.ZipFile, single_profile: str | None = None) -> None:
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


class WorkflowManager:
    """Manages workflow file operations (workflow.json + mappings.json)."""

    def __init__(self, workflows_dir: Path) -> None:
        self.workflows_dir = workflows_dir
        self.workflows_dir.mkdir(parents=True, exist_ok=True)

    def ensure_exists(self, workflow_name: str) -> None:
        """Raise HTTPException if workflow does not exist."""
        if not (self.workflows_dir / workflow_name).exists():
            raise HTTPException(status_code=404, detail=f"Workflow '{workflow_name}' not found")

    def ensure_not_exists(self, workflow_name: str) -> None:
        """Raise HTTPException if workflow already exists."""
        if (self.workflows_dir / workflow_name).exists():
            raise HTTPException(status_code=400, detail=f"Workflow '{workflow_name}' already exists")

    def list_workflows(self) -> list[dict]:
        """List all workflows that have a workflow.json file."""
        workflows = []
        for item in self.workflows_dir.iterdir():
            if item.is_dir() and (item / "workflow.json").exists():
                workflows.append({"name": item.name})
        return sorted(workflows, key=lambda x: x["name"])

    def get_content(self, workflow_name: str) -> dict:
        """Read all files from a workflow directory."""
        workflow_path = self.workflows_dir / workflow_name
        if not workflow_path.exists():
            raise HTTPException(status_code=404, detail=f"Workflow '{workflow_name}' not found")
        files = {}
        for filename in ["workflow.json", "mappings.json"]:
            filepath = workflow_path / filename
            files[filename] = filepath.read_text() if filepath.exists() else None
        return files

    def save_files(self, workflow_name: str, files: dict[str, str | None]) -> None:
        """Save all files to a workflow directory."""
        workflow_path = self.workflows_dir / workflow_name
        workflow_path.mkdir(parents=True, exist_ok=True)
        for filename, content in files.items():
            if content is not None:
                (workflow_path / filename).write_text(content)

    def delete(self, workflow_name: str) -> None:
        """Delete a workflow directory."""
        workflow_path = self.workflows_dir / workflow_name
        if workflow_path.exists():
            shutil.rmtree(workflow_path)

    def rename(self, old_name: str, new_name: str) -> None:
        """Rename a workflow directory."""
        shutil.move(str(self.workflows_dir / old_name), str(self.workflows_dir / new_name))

    def duplicate(self, source_name: str, new_name: str) -> None:
        """Duplicate a workflow directory with a new name."""
        shutil.copytree(str(self.workflows_dir / source_name), str(self.workflows_dir / new_name))

    def _create_temp_zip(self) -> str:
        """Create a temporary zip file and return its path."""
        return tempfile.NamedTemporaryFile(delete=False, suffix=".zip").name

    def _write_to_zip(self, zipf: zipfile.ZipFile, single_workflow: str | None = None) -> None:
        """Write workflow files to a ZIP archive."""
        if single_workflow:
            workflow_path = self.workflows_dir / single_workflow
            if workflow_path.is_dir():
                for filepath in workflow_path.iterdir():
                    zipf.write(filepath, filepath.name)
        else:
            for workflow_dir in self.workflows_dir.iterdir():
                if workflow_dir.is_dir():
                    for filepath in workflow_dir.iterdir():
                        zipf.write(filepath, f"{workflow_dir.name}/{filepath.name}")

    def create_zip(self, workflow_name: str) -> str:
        """Create a ZIP file for a single workflow."""
        zip_path = self._create_temp_zip()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            self._write_to_zip(zipf, single_workflow=workflow_name)
        return zip_path

    def create_all_zip(self) -> str:
        """Create a ZIP file containing all workflows."""
        zip_path = self._create_temp_zip()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            self._write_to_zip(zipf)
        return zip_path
