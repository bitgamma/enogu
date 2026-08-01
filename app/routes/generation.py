"""Image generation routes."""

import io
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import OUTPUT_DIR, PROFILES_DIR, WORKFLOWS_DIR
from app.models import AnalyzeResponse, GenerateResponse
from app.services.comfyui import create_comfyui_service
from app.services.llm import create_llm_service
from app.services.profile import get_profile
from app.services.workflow import get_workflow_with_mappings
from app.utils import ProfileManager, WorkflowManager, handle_api_errors
from app.utils.image import Image

router = APIRouter(prefix="/api", tags=["generation"])


@router.get("/profiles")
@handle_api_errors
async def list_profiles() -> dict:
    """List all available profiles."""
    manager = ProfileManager(PROFILES_DIR)
    return {"profiles": manager.list_profiles()}


@router.get("/workflows")
@handle_api_errors
async def list_workflows() -> dict:
    """List all available workflows."""
    manager = WorkflowManager(WORKFLOWS_DIR)
    return {"workflows": manager.list_workflows()}


@router.post("/analyze", response_model=AnalyzeResponse)
@handle_api_errors
async def analyze_image(
    file: UploadFile = File(...),
    profile: str = Form(...),
) -> AnalyzeResponse:
    """
    Analyze uploaded image and return generation prompt.
    Uses the specified profile configuration.
    """
    profile_config = get_profile(profile)
    image_data = await file.read()
    image = Image.open(io.BytesIO(image_data)).convert("RGB")

    llm_service = create_llm_service()
    result = await llm_service.analyze_image(image, profile_config["extraction_prompt"])

    if result.get("status") != "OK":
        error_reason = result.get("error_reason", result.get("prompt", "Could not analyze image"))
        raise HTTPException(status_code=400, detail=error_reason)

    return AnalyzeResponse(prompt=result["prompt"])


@router.post("/generate", response_model=GenerateResponse)
@handle_api_errors
async def generate_image(
    prompt: str = Form(...),
    workflow: str = Form(...),
    width: int = Form(1024),
    height: int = Form(1024),
    seed: int = Form(-1),
    upscale_switch: bool = Form(False),
    upscale_resolution: int = Form(1024),
    save: bool = Form(False),
) -> GenerateResponse:
    """
    Generate image from prompt using ComfyUI.
    Uses the specified workflow for generation.
    Optionally saves the image to the output folder.
    """
    if not prompt:
        raise HTTPException(status_code=400, detail="No prompt provided")

    workflow_data = get_workflow_with_mappings(
        workflow,
        prompt,
        width,
        height,
        seed,
        upscale_switch,
        upscale_resolution,
    )

    # Determine save path if requested
    save_path = None
    if save:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = int(time.time() * 1000)
        filename = f"{workflow}-{timestamp}.png"
        save_path = str(OUTPUT_DIR / filename)

    comfyui_service = create_comfyui_service()
    image_base64 = await comfyui_service.execute_async(workflow_data, save_path=save_path)

    return GenerateResponse(image=f"data:image/png;base64,{image_base64}")
