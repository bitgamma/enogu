"""Profile editor routes."""

from fastapi import APIRouter

from app.config import PROFILES_DIR
from app.models import (
    ProfileContent,
    ProfileDeleteResponse,
    ProfileDuplicateRequest,
    ProfileDuplicateResponse,
    ProfileRenameRequest,
    ProfileRenameResponse,
    ProfileSaveRequest,
    ProfileSaveResponse,
)
from app.routes.generation import invalidate_profile_cache
from app.utils import (
    ProfileManager,
    validate_profile_name_or_raise,
)

router = APIRouter(prefix="/api/profile-editor", tags=["profile-editor"])

profile_manager = ProfileManager(PROFILES_DIR)


@router.get("/profile/{profile_name}")
async def get_profile(profile_name: str) -> ProfileContent:
    """Get full profile content (extraction_prompt.txt only)."""
    files = profile_manager.get_content(profile_name)
    return ProfileContent(
        name=profile_name,
        extraction_prompt=files.get("extraction_prompt.txt"),
    )


@router.post("/profile", response_model=ProfileSaveResponse)
async def save_profile(request: ProfileSaveRequest) -> ProfileSaveResponse:
    """Save/update a profile (create or overwrite)."""
    validate_profile_name_or_raise(request.name, "profile name")

    files = {
        "extraction_prompt.txt": request.extraction_prompt,
    }

    profile_manager.save_files(request.name, files)
    invalidate_profile_cache(request.name)
    return ProfileSaveResponse(message=f"Profile '{request.name}' saved")


@router.post("/profile/duplicate", response_model=ProfileDuplicateResponse)
async def duplicate_profile(
    request: ProfileDuplicateRequest,
) -> ProfileDuplicateResponse:
    """Duplicate an existing profile with a new name."""
    validate_profile_name_or_raise(request.source_name, "source profile name")
    validate_profile_name_or_raise(request.new_name, "new profile name")

    profile_manager.ensure_exists(request.source_name)
    profile_manager.ensure_not_exists(request.new_name)

    profile_manager.duplicate(request.source_name, request.new_name)
    invalidate_profile_cache(request.source_name)
    invalidate_profile_cache(request.new_name)
    return ProfileDuplicateResponse(message=f"Profile '{request.source_name}' duplicated as '{request.new_name}'")


@router.delete("/profile/{profile_name}", response_model=ProfileDeleteResponse)
async def delete_profile(profile_name: str) -> ProfileDeleteResponse:
    """Delete a profile."""
    profile_manager.ensure_exists(profile_name)
    profile_manager.delete(profile_name)
    invalidate_profile_cache(profile_name)
    return ProfileDeleteResponse(message=f"Profile '{profile_name}' deleted")


@router.post("/profile/rename", response_model=ProfileRenameResponse)
async def rename_profile(request: ProfileRenameRequest) -> ProfileRenameResponse:
    """Rename a profile."""
    validate_profile_name_or_raise(request.old_name, "old profile name")
    validate_profile_name_or_raise(request.new_name, "new profile name")

    profile_manager.ensure_exists(request.old_name)
    profile_manager.ensure_not_exists(request.new_name)

    profile_manager.rename(request.old_name, request.new_name)
    invalidate_profile_cache(request.old_name)
    invalidate_profile_cache(request.new_name)
    return ProfileRenameResponse(message=f"Profile '{request.old_name}' renamed to '{request.new_name}'")


@router.get("/download/{profile_name}")
async def download_profile(profile_name: str):
    """Download a single profile as ZIP."""
    from fastapi.responses import FileResponse

    profile_manager.ensure_exists(profile_name)
    zip_path = profile_manager.create_zip(profile_name)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"{profile_name}.zip",
    )


@router.get("/download-all")
async def download_all_profiles():
    """Download all profiles as ZIP."""
    from fastapi.responses import FileResponse

    zip_path = profile_manager.create_all_zip()
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="all_profiles.zip",
    )
