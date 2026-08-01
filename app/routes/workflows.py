"""Workflow editor routes."""

import json

from fastapi import APIRouter

from app.config import WORKFLOWS_DIR
from app.models import (
    WorkflowContent,
    WorkflowDeleteResponse,
    WorkflowDuplicateRequest,
    WorkflowDuplicateResponse,
    WorkflowRenameRequest,
    WorkflowRenameResponse,
    WorkflowSaveRequest,
    WorkflowSaveResponse,
)
from app.utils import WorkflowManager, handle_api_errors, validate_json, validate_name_or_raise

router = APIRouter(prefix="/api/workflow-editor", tags=["workflow-editor"])

workflow_manager = WorkflowManager(WORKFLOWS_DIR)


@router.get("/workflow/{workflow_name}")
@handle_api_errors
async def get_workflow(workflow_name: str) -> WorkflowContent:
    """Get full workflow content (workflow.json + mappings.json)."""
    files = workflow_manager.get_content(workflow_name)
    return WorkflowContent(
        name=workflow_name,
        workflow=files.get("workflow.json"),
        mappings=files.get("mappings.json"),
    )


@router.post("/workflow", response_model=WorkflowSaveResponse)
@handle_api_errors
async def save_workflow(request: WorkflowSaveRequest) -> WorkflowSaveResponse:
    """Save/update a workflow (create or overwrite)."""
    validate_name_or_raise(request.name, "workflow name")

    # Validate and parse JSON files if provided
    workflow = validate_json(request.workflow, "workflow")
    mappings = validate_json(request.mappings, "mappings")

    files = {
        "workflow.json": workflow if isinstance(workflow, str) else json.dumps(workflow, indent=4),
        "mappings.json": mappings if isinstance(mappings, str) else json.dumps(mappings, indent=4),
    }

    workflow_manager.save_files(request.name, files)
    return WorkflowSaveResponse(message=f"Workflow '{request.name}' saved")


@router.post("/workflow/duplicate", response_model=WorkflowDuplicateResponse)
@handle_api_errors
async def duplicate_workflow(
    request: WorkflowDuplicateRequest,
) -> WorkflowDuplicateResponse:
    """Duplicate an existing workflow with a new name."""
    validate_name_or_raise(request.source_name, "source workflow name")
    validate_name_or_raise(request.new_name, "new workflow name")

    workflow_manager.ensure_exists(request.source_name)
    workflow_manager.ensure_not_exists(request.new_name)

    workflow_manager.duplicate(request.source_name, request.new_name)
    return WorkflowDuplicateResponse(
        message=f"Workflow '{request.source_name}' duplicated as '{request.new_name}'"
    )


@router.delete("/workflow/{workflow_name}", response_model=WorkflowDeleteResponse)
@handle_api_errors
async def delete_workflow(workflow_name: str) -> WorkflowDeleteResponse:
    """Delete a workflow."""
    workflow_manager.ensure_exists(workflow_name)
    workflow_manager.delete(workflow_name)
    return WorkflowDeleteResponse(message=f"Workflow '{workflow_name}' deleted")


@router.post("/workflow/rename", response_model=WorkflowRenameResponse)
@handle_api_errors
async def rename_workflow(request: WorkflowRenameRequest) -> WorkflowRenameResponse:
    """Rename a workflow."""
    validate_name_or_raise(request.old_name, "old workflow name")
    validate_name_or_raise(request.new_name, "new workflow name")

    workflow_manager.ensure_exists(request.old_name)
    workflow_manager.ensure_not_exists(request.new_name)

    workflow_manager.rename(request.old_name, request.new_name)
    return WorkflowRenameResponse(
        message=f"Workflow '{request.old_name}' renamed to '{request.new_name}'"
    )


@router.get("/download/{workflow_name}")
@handle_api_errors
async def download_workflow(workflow_name: str):
    """Download a single workflow as ZIP."""
    from fastapi.responses import FileResponse

    validate_name_or_raise(workflow_name, "workflow name")
    workflow_manager.ensure_exists(workflow_name)
    zip_path = workflow_manager.create_zip(workflow_name)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"{workflow_name}.zip",
    )


@router.get("/download-all")
@handle_api_errors
async def download_all_workflows():
    """Download all workflows as ZIP."""
    from fastapi.responses import FileResponse

    zip_path = workflow_manager.create_all_zip()
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="all_workflows.zip",
    )
