"""Gallery routes for managing saved generated images."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import OUTPUT_DIR
from app.models import GalleryItem, GalleryListResponse
from app.utils import handle_api_errors

router = APIRouter(prefix="/api/gallery", tags=["gallery"])


def _ensure_output_dir() -> None:
    """Ensure the output directory exists."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _list_output_files() -> list[GalleryItem]:
    """List all image files in the output directory, sorted by creation time (newest first)."""
    _ensure_output_dir()
    items = []
    for filepath in OUTPUT_DIR.iterdir():
        if filepath.is_file() and filepath.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
            items.append(
                GalleryItem(
                    filename=filepath.name,
                    size=filepath.stat().st_size,
                    created_at=filepath.stat().st_ctime,
                )
            )
    return sorted(items, key=lambda x: x.created_at, reverse=True)


@router.get("", response_model=GalleryListResponse)
@handle_api_errors
async def list_gallery() -> GalleryListResponse:
    """List all saved images in the gallery."""
    return GalleryListResponse(images=_list_output_files())


@router.get("/{filename}")
@handle_api_errors
async def get_image(filename: str) -> FileResponse:
    """Download a saved image from the gallery."""
    _ensure_output_dir()
    filepath = OUTPUT_DIR / filename
    if not filepath.is_file():
        raise HTTPException(status_code=404, detail=f"Image '{filename}' not found")
    return FileResponse(filepath, media_type="image/png", filename=filename)


@router.delete("")
@handle_api_errors
async def delete_all_images() -> dict:
    """Delete all saved images from the gallery."""
    _ensure_output_dir()
    count = 0
    for filepath in OUTPUT_DIR.iterdir():
        if filepath.is_file():
            filepath.unlink()
            count += 1
    return {"status": "success", "deleted": count}


@router.delete("/{filename}")
@handle_api_errors
async def delete_image(filename: str) -> dict:
    """Delete a specific saved image from the gallery."""
    _ensure_output_dir()
    filepath = OUTPUT_DIR / filename
    if not filepath.is_file():
        raise HTTPException(status_code=404, detail=f"Image '{filename}' not found")
    filepath.unlink()
    return {"status": "success", "deleted": filename}
