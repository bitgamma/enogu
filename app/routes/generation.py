"""Image generation routes."""

import copy
import io

from fastapi import APIRouter, File, Form, UploadFile

from app.config import PROFILES_DIR
from app.models import AnalyzeResponse, GenerateResponse
from app.services.comfyui import create_comfyui_service
from app.services.llm import create_llm_service
from app.utils import (
    PARAM_HANDLERS,
    handle_api_errors,
    read_file_content,
)
from app.utils.image import Image

router = APIRouter(prefix="/api", tags=["generation"])


def get_profile(profile_name: str) -> dict:
    """Load a profile configuration by name."""
    profile_settings = {
        "name": profile_name,
    }

    # Load extraction prompt from profile directory
    prompt_file_path = PROFILES_DIR / profile_name / "extraction_prompt.txt"
    extraction_prompt = read_file_content(prompt_file_path, strip=True)
    if extraction_prompt is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Prompt file extraction_prompt.txt not found")
    profile_settings["extraction_prompt"] = extraction_prompt

    return profile_settings


def load_mappings(profile_name: str) -> dict:
    """Load parameter mappings from mappings.json in the profile directory."""
    mappings_path = PROFILES_DIR / profile_name / "mappings.json"
    return read_file_content(mappings_path, as_json=True) or {}


def apply_mappings(
    workflow: dict,
    mappings: dict,
    prompt: str,
    width: int,
    height: int,
    seed: int,
    upscale_switch: bool,
    upscale_resolution: int,
) -> dict:
    """Apply parameter mappings to the workflow."""
    workflow = copy.deepcopy(workflow)
    kwargs = {
        "prompt": prompt,
        "seed": seed,
        "width": width,
        "height": height,
        "upscale_switch": upscale_switch,
        "upscale_resolution": upscale_resolution,
    }

    for param_name, node_id in mappings.items():
        if node_id not in workflow or param_name not in PARAM_HANDLERS:
            continue

        node = workflow[node_id]
        node_inputs = node.get("inputs", {})

        if param_name == "resolution":
            if "width" in node_inputs:
                node_inputs["width"] = width
            if "height" in node_inputs:
                node_inputs["height"] = height
        else:
            input_key, value_fn = PARAM_HANDLERS[param_name]
            if input_key in node_inputs:
                node_inputs[input_key] = value_fn(**kwargs)

    return workflow


def get_workflow(profile_name: str) -> dict:
    """Load a workflow configuration by name without applying mappings."""
    from app.utils import ensure_file_exists

    workflow_path = PROFILES_DIR / profile_name / "workflow.json"
    ensure_file_exists(workflow_path, f"Workflow for profile '{profile_name}' not found")
    return read_file_content(workflow_path, as_json=True) or {}


def get_workflow_with_mappings(
    profile_name: str,
    prompt: str,
    width: int,
    height: int,
    seed: int = -1,
    upscale_switch: bool = False,
    upscale_resolution: int = 1024,
) -> dict:
    """Load workflow and apply parameter mappings."""
    workflow = get_workflow(profile_name)
    mappings = load_mappings(profile_name)
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


# Profile cache to avoid redundant file I/O
_profile_cache: dict[str, dict] = {}


def get_cached_profile(profile_name: str) -> dict:
    """Load a profile configuration, using cache to avoid redundant file I/O."""
    if profile_name not in _profile_cache:
        _profile_cache[profile_name] = get_profile(profile_name)
    return _profile_cache[profile_name]


def invalidate_profile_cache(profile_name: str | None = None) -> None:
    """Invalidate profile cache. If profile_name is provided, only invalidate that profile."""
    if profile_name:
        _profile_cache.pop(profile_name, None)
    else:
        _profile_cache.clear()


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
    profile_config = get_cached_profile(profile)
    image_data = await file.read()
    image = Image.open(io.BytesIO(image_data)).convert("RGB")

    llm_service = create_llm_service()
    result = llm_service.analyze_image(image, profile_config["extraction_prompt"])

    if result.get("status") != "OK":
        error_reason = result.get("error_reason", result.get("prompt", "Could not analyze image"))
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=error_reason)

    return AnalyzeResponse(prompt=result["prompt"])


@router.post("/generate", response_model=GenerateResponse)
@handle_api_errors
async def generate_image(
    prompt: str = Form(...),
    profile: str = Form(...),
    width: int = Form(1024),
    height: int = Form(1024),
    seed: int = Form(-1),
    upscale_switch: bool = Form(False),
    upscale_resolution: int = Form(1024),
) -> GenerateResponse:
    """
    Generate image from prompt using ComfyUI.
    Uses the specified profile configuration and custom resolution.
    """
    profile_config = get_cached_profile(profile)
    prompt_text = prompt

    if not prompt_text:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="No prompt provided")

    workflow = get_workflow_with_mappings(
        profile_config["name"],
        prompt_text,
        width,
        height,
        seed,
        upscale_switch,
        upscale_resolution,
    )

    comfyui_service = create_comfyui_service()
    image_base64 = await comfyui_service.execute_async(workflow)

    return GenerateResponse(image=f"data:image/png;base64,{image_base64}")
