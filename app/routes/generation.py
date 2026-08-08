"""Image generation routes."""

import io
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import OUTPUT_DIR, PRESETS_DIR, PROFILES_DIR
from app.models import AnalyzeResponse, GenerateResponse
from app.services.llm import create_llm_service
from app.services.preset import get_preset
from app.services.profile import get_profile
from app.utils import PresetManager, ProfileManager, handle_api_errors
from app.utils.image import Image

router = APIRouter(prefix="/api", tags=["generation"])


@router.get("/profiles")
@handle_api_errors
async def list_profiles() -> dict:
    """List all available profiles."""
    manager = ProfileManager(PROFILES_DIR)
    return {"profiles": manager.list_profiles()}


@router.get("/presets")
@handle_api_errors
async def list_presets() -> dict:
    """List all available presets."""
    manager = PresetManager(PRESETS_DIR)
    return {"presets": manager.list_presets()}


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
    preset: str = Form(...),
    width: int = Form(1024),
    height: int = Form(1024),
    seed: int = Form(-1),
    upscale: bool = Form(False),
    save: bool = Form(False),
) -> GenerateResponse:
    """Generate image from prompt using the OpenAI-compatible endpoint.

    Uses the specified preset for the non-changing generation parameters;
    prompt, seed, width, height and upscale are filled from the request.
    Optionally saves the image to the output folder.
    """
    if not prompt:
        raise HTTPException(status_code=400, detail="No prompt provided")

    preset_params = get_preset(preset)

    # Determine save path if requested
    save_path = None
    if save:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = int(time.time() * 1000)
        filename = f"{preset}-{timestamp}.png"
        save_path = str(OUTPUT_DIR / filename)

    llm_service = create_llm_service()
    image_base64 = await llm_service.generate_image(
        prompt=prompt,
        seed=seed,
        width=width,
        height=height,
        upscale=upscale,
        preset_params=preset_params,
    )

    if save_path is not None:
        import base64 as _b64

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        try:
            image_bytes = _b64.b64decode(image_base64)
        except Exception:
            image_bytes = _b64.b64decode(image_base64.split(",", 1)[-1])
        with open(save_path, "wb") as f:
            f.write(image_bytes)

    return GenerateResponse(image=f"data:image/png;base64,{image_base64}")
