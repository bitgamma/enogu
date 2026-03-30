"""
Image Generation Webapp Backend
Processes uploaded images through an LLM and generates new images via ComfyUI.
Supports multiple profiles for different generation configurations.
"""

import asyncio
import base64
import io
import json
import os
from pathlib import Path
from typing import Optional

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

app = FastAPI(title="Image Generation Webapp")

# Paths
BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR / "frontend"
PROFILES_DIR = BASE_DIR / "profiles"

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")

# Serve index.html at root
@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the frontend HTML."""
    with open(FRONTEND_DIR / "index.html") as f:
        return HTMLResponse(content=f.read())


def get_profile(profile_name: str) -> dict:
    """Load a profile configuration by name."""
    profile_path = PROFILES_DIR / profile_name / "config.json"
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail=f"Profile '{profile_name}' not found")
    
    with open(profile_path) as f:
        config = json.load(f)
    
    config["name"] = profile_name
    
    prompt_file_path = profile_path.parent / "extraction_prompt.txt"
    if prompt_file_path.exists():
        with open(prompt_file_path) as f:
            config["extraction_prompt"] = f.read().strip()
    else:
        raise HTTPException(status_code=404, detail=f"Prompt file extraction_prompt.txt not found")
    
    return config


def get_workflow(profile_name: str) -> dict:
    """Load a workflow configuration by name."""
    workflow_path = PROFILES_DIR / profile_name / "workflow.json"
    if not workflow_path.exists():
        raise HTTPException(status_code=404, detail=f"Workflow for profile '{profile_name}' not found")
    
    with open(workflow_path) as f:
        return json.load(f)


def list_profiles() -> list:
    """List all available profiles."""
    profiles = []
    if PROFILES_DIR.exists():
        for item in PROFILES_DIR.iterdir():
            if item.is_dir():
                config_path = item / "config.json"
                if config_path.exists():
                    profiles.append({"name": item.name})
    return profiles


def resize_image_for_llm(image: Image.Image, max_pixels: int = 1500000) -> Image.Image:
    """
    Resize image to no more than max_pixels while preserving aspect ratio.
    Does not upscale smaller images.
    """
    width, height = image.size
    current_pixels = width * height
    
    # Don't upscale if already below the limit
    if current_pixels <= max_pixels:
        return image
    
    # Calculate new dimensions preserving aspect ratio
    new_width = int(width * (max_pixels / current_pixels) ** 0.5)
    new_height = int(height * (max_pixels / current_pixels) ** 0.5)
    
    # Ensure dimensions are at least 1
    new_width = max(1, new_width)
    new_height = max(1, new_height)
    
    return image.resize((new_width, new_height), Image.Resampling.LANCZOS)


def encode_image_to_base64(image: Image.Image) -> str:
    """Encode a PIL Image to base64 string."""
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


async def llm_analyze_image(image: Image.Image, profile: dict) -> dict:
    """
    Send image to LLM for analysis.
    Returns JSON with 'prompt' and 'status' fields.
    """
    # Resize image to max 1.5 megapixel before sending to LLM
    resized_image = resize_image_for_llm(image)
    base64_image = encode_image_to_base64(resized_image)
    
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": profile["extraction_prompt"]},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_image}"}}
                ]
            }
        ],
        "model": profile["llm_model"],
        "response_format": {"type": "json_object"}
    }
    
    headers = {
        "Authorization": f"Bearer {profile['llm_apikey']}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(
        f"{profile['llm_endpoint']}/chat/completions",
        headers=headers,
        json=payload,
        timeout=60
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"LLM API error: {response.text}")
    
    result = response.json()
    content = result["choices"][0]["message"]["content"]

    content = content.strip()
    
    # Try to extract JSON from markdown code blocks
    if "```json" in content:
        # Extract content between ```json and ```
        start_idx = content.find("```json") + 7
        end_idx = content.find("```", start_idx)
        if end_idx != -1:
            content = content[start_idx:end_idx].strip()
    elif content.startswith("```") and content.endswith("```"):
        # Fallback: strip generic code block markers
        content = content[3:-3].strip()
        # Remove 'json' prefix if present
        if content.startswith("json"):
            content = content[4:].strip()
    
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"LLM returned invalid JSON: {str(e)}")


async def execute_comfyui_workflow(prompt: str, profile: dict, width: int = 768, height: int = 1024) -> str:
    """
    Execute ComfyUI workflow with the given prompt and custom resolution.
    Returns the base64 encoded result image.
    """
    workflow = get_workflow(profile["name"])
    
    # Replace {PROMPT} placeholder in workflow
    for node_id, node_data in workflow.items():
        if node_data.get("class_type") == "CLIPTextEncode":
            inputs = node_data.get("inputs", {})
            if "text" in inputs and "{PROMPT}" in str(inputs["text"]):
                inputs["text"] = prompt
                break
    
    # Update EmptyLatentImage node with custom resolution
    for node_id, node_data in workflow.items():
        if node_data.get("class_type") == "EmptyLatentImage":
            inputs = node_data.get("inputs", {})
            if "width" in inputs:
                inputs["width"] = width
            if "height" in inputs:
                inputs["height"] = height
            break
    
    # Queue the workflow
    queue_response = requests.post(
        f"{profile['comfyui_endpoint']}/prompt",
        json={"prompt": workflow, "client_id": "webapp"}
    )
    
    if queue_response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"ComfyUI queue error: {queue_response.text}")
    
    prompt_id = queue_response.json()["prompt_id"]
    
    # Wait for completion
    while True:
        history_response = requests.get(
            f"{profile['comfyui_endpoint']}/history/{prompt_id}"
        )
        
        if history_response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"ComfyUI history error: {history_response.text}")
        
        history = history_response.json()
        
        if prompt_id in history and history[prompt_id]:
            # Workflow completed
            outputs = history[prompt_id]["outputs"]
            
            # Find the PreviewImage node output
            for node_id, node_data in outputs.items():
                if "images" in node_data:
                    image_data = node_data["images"][0]
                    image_bytes = requests.get(
                        f"{profile['comfyui_endpoint']}/view?filename={image_data['filename']}&type={image_data['type']}&subfolder={image_data.get('subfolder', '')}"
                    ).content
                    return base64.b64encode(image_bytes).decode("utf-8")
            
            raise HTTPException(status_code=500, detail="No image output from ComfyUI")
        
        # Check if workflow failed
        if prompt_id in history and "errors" in history[prompt_id]:
            raise HTTPException(status_code=500, detail=f"ComfyUI workflow failed: {history[prompt_id]['errors']}")
        
        # Wait before polling again
        await asyncio.sleep(0.5)


@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the frontend HTML."""
    with open(FRONTEND_DIR / "index.html") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/profiles")
async def list_profiles_api():
    """List all available profiles."""
    return {"profiles": list_profiles()}


@app.post("/api/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    profile: str = Form(...)
):
    """
    Analyze uploaded image and return generation prompt.
    Uses the specified profile configuration.
    """
    try:
        profile_config = get_profile(profile)
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        
        result = await llm_analyze_image(image, profile_config)
        
        if result.get("status") != "OK":
            # Return error_reason if provided by LLM, otherwise use prompt field
            error_reason = result.get("error_reason", result.get("prompt", "Could not analyze image"))
            raise HTTPException(status_code=400, detail=error_reason)
        
        return JSONResponse(content={
            "success": True,
            "prompt": result["prompt"]
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate_image(
    prompt: str = Form(...),
    profile: str = Form(...),
    width: int = Form(1024),
    height: int = Form(1024)
):
    """
    Generate image from prompt using ComfyUI.
    Uses the specified profile configuration and custom resolution.
    """
    try:
        profile_config = get_profile(profile)
        prompt_text = prompt
        
        if not prompt_text:
            raise HTTPException(status_code=400, detail="No prompt provided")
        
        image_base64 = await execute_comfyui_workflow(prompt_text, profile_config, width, height)
        
        return JSONResponse(content={
            "success": True,
            "image": f"data:image/png;base64,{image_base64}"
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
