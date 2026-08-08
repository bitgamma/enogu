"""Preset editor routes."""

import json

from fastapi import APIRouter

from app.config import PRESETS_DIR
from app.models import (
    PresetContent,
    PresetDeleteResponse,
    PresetDuplicateRequest,
    PresetDuplicateResponse,
    PresetRenameRequest,
    PresetRenameResponse,
    PresetSaveRequest,
    PresetSaveResponse,
)
from app.utils import PresetManager, handle_api_errors, validate_json, validate_name_or_raise

router = APIRouter(prefix="/api/preset-editor", tags=["preset-editor"])

preset_manager = PresetManager(PRESETS_DIR)


@router.get("/preset/{preset_name}")
@handle_api_errors
async def get_preset(preset_name: str) -> PresetContent:
    """Get full preset content (settings.json)."""
    files = preset_manager.get_content(preset_name)
    return PresetContent(
        name=preset_name,
        settings=files.get("settings.json"),
    )


@router.post("/preset", response_model=PresetSaveResponse)
@handle_api_errors
async def save_preset(request: PresetSaveRequest) -> PresetSaveResponse:
    """Save/update a preset (create or overwrite)."""
    validate_name_or_raise(request.name, "preset name")

    settings = validate_json(request.settings, "settings")
    if settings is None:
        settings = {}

    files = {
        "settings.json": settings if isinstance(settings, str) else json.dumps(settings, indent=4),
    }

    preset_manager.save_files(request.name, files)
    return PresetSaveResponse(message=f"Preset '{request.name}' saved")


@router.post("/preset/duplicate", response_model=PresetDuplicateResponse)
@handle_api_errors
async def duplicate_preset(
    request: PresetDuplicateRequest,
) -> PresetDuplicateResponse:
    """Duplicate an existing preset with a new name."""
    validate_name_or_raise(request.source_name, "source preset name")
    validate_name_or_raise(request.new_name, "new preset name")

    preset_manager.ensure_exists(request.source_name)
    preset_manager.ensure_not_exists(request.new_name)

    preset_manager.duplicate(request.source_name, request.new_name)
    return PresetDuplicateResponse(
        message=f"Preset '{request.source_name}' duplicated as '{request.new_name}'"
    )


@router.delete("/preset/{preset_name}", response_model=PresetDeleteResponse)
@handle_api_errors
async def delete_preset(preset_name: str) -> PresetDeleteResponse:
    """Delete a preset."""
    preset_manager.ensure_exists(preset_name)
    preset_manager.delete(preset_name)
    return PresetDeleteResponse(message=f"Preset '{preset_name}' deleted")


@router.post("/preset/rename", response_model=PresetRenameResponse)
@handle_api_errors
async def rename_preset(request: PresetRenameRequest) -> PresetRenameResponse:
    """Rename a preset."""
    validate_name_or_raise(request.old_name, "old preset name")
    validate_name_or_raise(request.new_name, "new preset name")

    preset_manager.ensure_exists(request.old_name)
    preset_manager.ensure_not_exists(request.new_name)

    preset_manager.rename(request.old_name, request.new_name)
    return PresetRenameResponse(
        message=f"Preset '{request.old_name}' renamed to '{request.new_name}'"
    )


@router.get("/download/{preset_name}")
@handle_api_errors
async def download_preset(preset_name: str):
    """Download a single preset as ZIP."""
    from fastapi.responses import FileResponse

    validate_name_or_raise(preset_name, "preset name")
    preset_manager.ensure_exists(preset_name)
    zip_path = preset_manager.create_zip(preset_name)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"{preset_name}.zip",
    )


@router.get("/download-all")
@handle_api_errors
async def download_all_presets():
    """Download all presets as ZIP."""
    from fastapi.responses import FileResponse

    zip_path = preset_manager.create_all_zip()
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="all_presets.zip",
    )
