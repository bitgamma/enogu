"""Tests for WorkflowManager."""

import tempfile
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.utils import WorkflowManager


@pytest.fixture
def temp_workflows_dir() -> Path:
    """Create a temporary directory for workflows."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def workflow_manager(temp_workflows_dir: Path) -> WorkflowManager:
    """Create a WorkflowManager instance with temp directory."""
    return WorkflowManager(temp_workflows_dir)


def _create_test_workflow(manager: WorkflowManager, name: str) -> None:
    """Helper to create a test workflow directory with required files."""
    workflow_dir = manager.workflows_dir / name
    workflow_dir.mkdir(parents=True, exist_ok=True)
    (workflow_dir / "workflow.json").write_text('{"nodes": []}')
    (workflow_dir / "mappings.json").write_text('{"prompt": "node1"}')


class TestWorkflowManager:
    """Tests for WorkflowManager."""

    def test_list_workflows_empty(self, workflow_manager: WorkflowManager) -> None:
        assert workflow_manager.list_workflows() == []

    def test_list_workflows_with_workflows(self, workflow_manager: WorkflowManager) -> None:
        _create_test_workflow(workflow_manager, "wf1")
        _create_test_workflow(workflow_manager, "wf2")
        workflows = workflow_manager.list_workflows()
        assert len(workflows) == 2
        assert workflows[0]["name"] == "wf1"
        assert workflows[1]["name"] == "wf2"

    def test_ignores_dir_without_workflow_json(self, workflow_manager: WorkflowManager) -> None:
        (workflow_manager.workflows_dir / "partial").mkdir()
        assert workflow_manager.list_workflows() == []

    def test_get_content(self, workflow_manager: WorkflowManager) -> None:
        _create_test_workflow(workflow_manager, "test_wf")
        content = workflow_manager.get_content("test_wf")
        assert content["workflow.json"] == '{"nodes": []}'
        assert content["mappings.json"] == '{"prompt": "node1"}'

    def test_get_content_nonexistent(self, workflow_manager: WorkflowManager) -> None:
        with pytest.raises(HTTPException) as exc_info:
            workflow_manager.get_content("nonexistent")
        assert exc_info.value.status_code == 404

    def test_save_files(self, workflow_manager: WorkflowManager) -> None:
        files = {
            "workflow.json": '{"nodes": [1]}',
            "mappings.json": None,  # None means don't create
        }
        workflow_manager.save_files("new_wf", files)
        assert (workflow_manager.workflows_dir / "new_wf").exists()
        assert (
            workflow_manager.workflows_dir / "new_wf" / "workflow.json"
        ).read_text() == '{"nodes": [1]}'
        assert not (workflow_manager.workflows_dir / "new_wf" / "mappings.json").exists()

    def test_delete(self, workflow_manager: WorkflowManager) -> None:
        _create_test_workflow(workflow_manager, "to_delete")
        workflow_manager.delete("to_delete")
        assert not (workflow_manager.workflows_dir / "to_delete").exists()

    def test_rename(self, workflow_manager: WorkflowManager) -> None:
        _create_test_workflow(workflow_manager, "old_name")
        workflow_manager.rename("old_name", "new_name")
        assert not (workflow_manager.workflows_dir / "old_name").exists()
        assert (workflow_manager.workflows_dir / "new_name").exists()

    def test_duplicate(self, workflow_manager: WorkflowManager) -> None:
        _create_test_workflow(workflow_manager, "source")
        workflow_manager.duplicate("source", "duplicate")
        assert (workflow_manager.workflows_dir / "duplicate").exists()
        assert (
            workflow_manager.workflows_dir / "duplicate" / "workflow.json"
        ).read_text() == '{"nodes": []}'

    def test_ensure_exists_raises(self, workflow_manager: WorkflowManager) -> None:
        with pytest.raises(HTTPException) as exc_info:
            workflow_manager.ensure_exists("nonexistent")
        assert exc_info.value.status_code == 404

    def test_ensure_not_exists_raises(self, workflow_manager: WorkflowManager) -> None:
        _create_test_workflow(workflow_manager, "existing")
        with pytest.raises(HTTPException) as exc_info:
            workflow_manager.ensure_not_exists("existing")
        assert exc_info.value.status_code == 400

    def test_create_zip(self, workflow_manager: WorkflowManager) -> None:
        _create_test_workflow(workflow_manager, "zippable")
        zip_path = workflow_manager.create_zip("zippable")
        assert Path(zip_path).exists()
        Path(zip_path).unlink()

    def test_create_all_zip(self, workflow_manager: WorkflowManager) -> None:
        _create_test_workflow(workflow_manager, "wf1")
        _create_test_workflow(workflow_manager, "wf2")
        zip_path = workflow_manager.create_all_zip()
        assert Path(zip_path).exists()
        Path(zip_path).unlink()
