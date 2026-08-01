"""Workflow service for loading and applying ComfyUI workflows."""

from app.config import WORKFLOWS_DIR
from app.utils import ensure_file_exists, read_file_content
from app.utils.validation import apply_mappings


def get_workflow(workflow_name: str) -> dict:
    """Load a workflow configuration by name without applying mappings."""
    workflow_path = WORKFLOWS_DIR / workflow_name / "workflow.json"
    ensure_file_exists(workflow_path, f"Workflow '{workflow_name}' not found")
    return read_file_content(workflow_path, as_json=True) or {}


def load_mappings(workflow_name: str) -> dict:
    """Load parameter mappings from mappings.json in the workflow directory."""
    mappings_path = WORKFLOWS_DIR / workflow_name / "mappings.json"
    return read_file_content(mappings_path, as_json=True) or {}


def get_workflow_with_mappings(
    workflow_name: str,
    prompt: str,
    width: int,
    height: int,
    seed: int = -1,
    upscale_switch: bool = False,
    upscale_resolution: int = 1024,
) -> dict:
    """Load workflow and apply parameter mappings."""
    workflow = get_workflow(workflow_name)
    mappings = load_mappings(workflow_name)
    return apply_mappings(
        workflow,
        mappings,
        prompt,
        width,
        height,
        seed,
        upscale_switch,
        upscale_resolution,
    )
