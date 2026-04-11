"""
Image Generation Webapp Backend
Processes uploaded images through an LLM and generates new images via ComfyUI.
Supports multiple profiles for different generation configurations.
"""

import asyncio
import base64
import io
import json
import re
import shutil
import tempfile
import zipfile
from pathlib import Path

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

# Default system prompt for tool calling
DEFAULT_SYSTEM_PROMPT = "You are an image analysis assistant specialized in extracting image generation prompts. Your task is to analyze the uploaded image and extract a detailed prompt for image generation. When you analyze the image, call the generate_image tool with your extracted prompt and status."

app = FastAPI(title="Image Generation Webapp")

# Paths
BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR / "frontend"
PROFILES_DIR = BASE_DIR / "profiles"
CONFIG_FILE = BASE_DIR / "config.json"

# Load global configuration
with open(CONFIG_FILE) as f:
    CONFIG = json.load(f)

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
    # Load global connection parameters from providers section
    providers = CONFIG.get("providers", {})
    profile_settings = {
        "comfyui_endpoint": providers["comfyui_endpoint"],
        "llm_endpoint": providers["llm_endpoint"],
        "llm_apikey": providers["llm_apikey"],
        "llm_model": providers["llm_model"],
        "name": profile_name
    }
    
    # Load system prompt from config if available, otherwise use default
    profile_settings["system_prompt"] = providers.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    
    # Load extraction prompt from profile directory
    prompt_file_path = PROFILES_DIR / profile_name / "extraction_prompt.txt"
    if prompt_file_path.exists():
        with open(prompt_file_path) as f:
            profile_settings["extraction_prompt"] = f.read().strip()
    else:
        raise HTTPException(status_code=404, detail=f"Prompt file extraction_prompt.txt not found")
    
    return profile_settings


def load_mappings(profile_name: str) -> dict:
    """Load parameter mappings from mappings.json in the profile directory."""
    mappings_path = PROFILES_DIR / profile_name / "mappings.json"
    if not mappings_path.exists():
        return {}
    
    with open(mappings_path) as f:
        return json.load(f)


def apply_mappings(workflow: dict, mappings: dict, prompt: str, width: int, height: int, seed: int, upscale_switch: bool, upscale_resolution: int) -> dict:
    """
    Apply parameter mappings to the workflow.
    
    Mappings format: {"param_name": "node_id"}
    The node_id is used directly as a key in the workflow to find the node to replace.
    """
    workflow = json.loads(json.dumps(workflow))  # Deep copy
    
    for param_name, node_id in mappings.items():
        if node_id not in workflow:
            continue
        
        node = workflow[node_id]
        node_inputs = node.get("inputs", {})
        
        # Determine what value to set based on parameter name
        if param_name == "prompt":
            if "text" in node_inputs:
                node_inputs["text"] = prompt
        elif param_name == "seed":
            if "seed" in node_inputs:
                node_inputs["seed"] = seed
        elif param_name == "resolution":
            if "width" in node_inputs:
                node_inputs["width"] = width
            if "height" in node_inputs:
                node_inputs["height"] = height
        elif param_name == "upscaler_switch":
            if "switch" in node_inputs:
                node_inputs["switch"] = upscale_switch
        elif param_name == "upscale_resolution":
            if "value" in node_inputs:
                node_inputs["value"] = upscale_resolution
    
    return workflow


def get_workflow_with_mappings(profile_name: str, prompt: str, width: int, height: int, seed: int = -1, upscale_switch: bool = False, upscale_resolution: int = 1024) -> dict:
    """Load workflow and apply parameter mappings."""
    workflow = get_workflow(profile_name)
    mappings = load_mappings(profile_name)
    return apply_mappings(workflow, mappings, prompt, width, height, seed, upscale_switch, upscale_resolution)


def get_workflow(profile_name: str) -> dict:
    """Load a workflow configuration by name without applying mappings."""
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
                prompt_file_path = item / "extraction_prompt.txt"
                if prompt_file_path.exists():
                    profiles.append({"name": item.name})
    # Sort profiles alphabetically by name
    profiles.sort(key=lambda x: x["name"])
    return profiles


# ============== Profile Editor Helper Functions ==============

def validate_profile_name(name: str) -> bool:
    """Validate profile name to prevent directory traversal attacks."""
    # Allow only alphanumeric characters, hyphens, and underscores
    return bool(re.match(r'^[a-zA-Z0-9_-]+$', name))


def get_profile_content(profile_name: str) -> dict:
    """Read all files from a profile directory."""
    profile_path = PROFILES_DIR / profile_name
    
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail=f"Profile '{profile_name}' not found")
    
    files = {}
    for filename in ["extraction_prompt.txt", "workflow.json", "mappings.json"]:
        filepath = profile_path / filename
        if filepath.exists():
            with open(filepath, 'r') as f:
                files[filename] = f.read()
        else:
            files[filename] = None
    
    return files


def save_profile_files(profile_name: str, files: dict) -> None:
    """Save all files to a profile directory."""
    profile_path = PROFILES_DIR / profile_name
    profile_path.mkdir(parents=True, exist_ok=True)
    
    for filename, content in files.items():
        if content is not None:
            filepath = profile_path / filename
            with open(filepath, 'w') as f:
                f.write(content)


def delete_profile(profile_name: str) -> None:
    """Delete a profile directory."""
    profile_path = PROFILES_DIR / profile_name
    if profile_path.exists():
        shutil.rmtree(profile_path)


def rename_profile(old_name: str, new_name: str) -> None:
    """Rename a profile directory."""
    old_path = PROFILES_DIR / old_name
    new_path = PROFILES_DIR / new_name
    shutil.move(str(old_path), str(new_path))


def duplicate_profile(source_name: str, new_name: str) -> None:
    """Duplicate a profile directory with a new name."""
    source_path = PROFILES_DIR / source_name
    dest_path = PROFILES_DIR / new_name
    shutil.copytree(str(source_path), str(dest_path))


def create_profile_zip(profile_name: str) -> str:
    """Create a ZIP file for a single profile."""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    profile_path = PROFILES_DIR / profile_name
    
    with zipfile.ZipFile(temp_file.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for filepath in profile_path.iterdir():
            zipf.write(filepath, filepath.name)
    
    return temp_file.name


def create_all_profiles_zip() -> str:
    """Create a ZIP file containing all profiles."""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    
    with zipfile.ZipFile(temp_file.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for profile_dir in PROFILES_DIR.iterdir():
            if profile_dir.is_dir():
                for filepath in profile_dir.iterdir():
                    zipf.write(filepath, f"{profile_dir.name}/{filepath.name}")
    
    return temp_file.name


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
    Send image to LLM for analysis using tool calling.
    Returns JSON with 'prompt' and 'status' fields.
    """
    # Resize image to max 1.5 megapixel before sending to LLM
    resized_image = resize_image_for_llm(image)
    base64_image = encode_image_to_base64(resized_image)
    
    # Define the generate_image tool
    tools = [
        {
            "type": "function",
            "function": {
                "name": "generate_image",
                "description": "Extract a prompt for image generation from an image. Use status 'OK' for successful analysis or 'NOK' if you cannot generate a prompt.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["OK", "NOK"],
                            "description": "Analysis status. 'OK' if successful, 'NOK' if the analysis failed"
                        },
                        "prompt": {
                            "type": "string",
                            "description": "The generation prompt. If status is 'OK', provide a detailed description. If status is 'NOK', provide an empty string"
                        },
                        "error_reason": {
                            "type": "string",
                            "description": "If status is 'NOK', explain why the analysis failed. Can be omitted if status is 'OK'"
                        }
                    },
                    "required": ["status", "prompt"]
                }
            }
        }
    ]
    
    payload = {
        "messages": [
            {
                "role": "system",
                "content": profile.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": profile["extraction_prompt"]},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_image}"}}
                ]
            }
        ],
        "tools": tools,
        "tool_choice": {"type": "function", "function": {"name": "generate_image"}},
        "model": profile["llm_model"]
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
    message = result["choices"][0]["message"]
    
    # Handle tool call response
    if "tool_calls" in message and message["tool_calls"]:
        tool_call = message["tool_calls"][0]
        if tool_call["function"]["name"] == "generate_image":
            arguments = json.loads(tool_call["function"]["arguments"])
            return {
                "status": arguments.get("status", "NOK"),
                "prompt": arguments.get("prompt", ""),
                "error_reason": arguments.get("error_reason")
            }
    
    raise HTTPException(status_code=500, detail="LLM did not return a valid tool call")


async def execute_comfyui_workflow(prompt: str, profile: dict, width: int, height: int, seed: int, upscale_switch: bool, upscale_resolution: int) -> str:
    """
    Execute ComfyUI workflow with the given prompt and custom resolution.
    Returns the base64 encoded result image.
    """
    workflow = get_workflow_with_mappings(profile["name"], prompt, width, height, seed, upscale_switch, upscale_resolution)
    
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


@app.get("/api/profiles")
async def list_profiles_api():
    """List all available profiles."""
    return {"profiles": list_profiles()}


# ============== Profile Editor API Endpoints ==============

@app.get("/api/profile-editor/profile/{profile_name}")
async def get_profile_api(profile_name: str):
    """Get full profile content (all 3 files)."""
    if not validate_profile_name(profile_name):
        raise HTTPException(status_code=400, detail="Invalid profile name")
    
    files = get_profile_content(profile_name)
    return {
        "name": profile_name,
        "extraction_prompt": files.get("extraction_prompt.txt"),
        "workflow": files.get("workflow.json"),
        "mappings": files.get("mappings.json")
    }


@app.post("/api/profile-editor/profile")
async def save_profile_api(request: dict):
    """Save/update a profile (create or overwrite)."""
    profile_name = request.get("name")
    if not profile_name or not validate_profile_name(profile_name):
        raise HTTPException(status_code=400, detail="Invalid profile name")
    
    extraction_prompt = request.get("extraction_prompt")
    workflow = request.get("workflow")
    mappings = request.get("mappings")
    
    # Validate JSON files if provided
    if workflow:
        try:
            if isinstance(workflow, str):
                json.loads(workflow)
            else:
                json.dumps(workflow)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid workflow JSON")
    
    if mappings:
        try:
            if isinstance(mappings, str):
                json.loads(mappings)
            else:
                json.dumps(mappings)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid mappings JSON")
    
    files = {
        "extraction_prompt.txt": extraction_prompt,
        "workflow.json": workflow if isinstance(workflow, str) else json.dumps(workflow, indent=4),
        "mappings.json": mappings if isinstance(mappings, str) else json.dumps(mappings, indent=4)
    }
    
    save_profile_files(profile_name, files)
    return {"status": "success", "message": f"Profile '{profile_name}' saved"}


@app.post("/api/profile-editor/profile/duplicate")
async def duplicate_profile_api(request: dict):
    """Duplicate an existing profile with a new name."""
    source_name = request.get("source_name")
    new_name = request.get("new_name")
    
    if not source_name or not validate_profile_name(source_name):
        raise HTTPException(status_code=400, detail="Invalid source profile name")
    
    if not new_name or not validate_profile_name(new_name):
        raise HTTPException(status_code=400, detail="Invalid new profile name")
    
    # Check if source exists
    source_path = PROFILES_DIR / source_name
    if not source_path.exists():
        raise HTTPException(status_code=404, detail=f"Source profile '{source_name}' not found")
    
    # Check if destination already exists
    dest_path = PROFILES_DIR / new_name
    if dest_path.exists():
        raise HTTPException(status_code=400, detail=f"Profile '{new_name}' already exists")
    
    duplicate_profile(source_name, new_name)
    return {"status": "success", "message": f"Profile '{source_name}' duplicated as '{new_name}'"}


@app.delete("/api/profile-editor/profile/{profile_name}")
async def delete_profile_api(profile_name: str):
    """Delete a profile."""
    if not validate_profile_name(profile_name):
        raise HTTPException(status_code=400, detail="Invalid profile name")
    
    # Check if profile exists
    profile_path = PROFILES_DIR / profile_name
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail=f"Profile '{profile_name}' not found")
    
    delete_profile(profile_name)
    return {"status": "success", "message": f"Profile '{profile_name}' deleted"}


@app.post("/api/profile-editor/profile/rename")
async def rename_profile_api(request: dict):
    """Rename a profile."""
    old_name = request.get("old_name")
    new_name = request.get("new_name")
    
    if not old_name or not validate_profile_name(old_name):
        raise HTTPException(status_code=400, detail="Invalid old profile name")
    
    if not new_name or not validate_profile_name(new_name):
        raise HTTPException(status_code=400, detail="Invalid new profile name")
    
    # Check if old profile exists
    old_path = PROFILES_DIR / old_name
    if not old_path.exists():
        raise HTTPException(status_code=404, detail=f"Profile '{old_name}' not found")
    
    # Check if new name already exists
    new_path = PROFILES_DIR / new_name
    if new_path.exists():
        raise HTTPException(status_code=400, detail=f"Profile '{new_name}' already exists")
    
    rename_profile(old_name, new_name)
    return {"status": "success", "message": f"Profile '{old_name}' renamed to '{new_name}'"}


@app.get("/api/profile-editor/download/{profile_name}")
async def download_profile_api(profile_name: str):
    """Download a single profile as ZIP."""
    if not validate_profile_name(profile_name):
        raise HTTPException(status_code=400, detail="Invalid profile name")
    
    # Check if profile exists
    profile_path = PROFILES_DIR / profile_name
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail=f"Profile '{profile_name}' not found")
    
    zip_path = create_profile_zip(profile_name)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"{profile_name}.zip"
    )


@app.get("/api/profile-editor/download-all")
async def download_all_profiles_api():
    """Download all profiles as ZIP."""
    zip_path = create_all_profiles_zip()
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="all_profiles.zip"
    )


# ============== Configuration Editor API Endpoints ==============

@app.get("/api/config/providers")
async def get_config_providers():
    """Get the providers section of the configuration."""
    return {"providers": CONFIG.get("providers", {})}


@app.post("/api/config/providers")
async def save_config_providers(request: dict):
    """Save/update the providers section of the configuration. Applies immediately and persists to file."""
    providers = request.get("providers", {})
    
    # Validate required fields
    required_fields = ["comfyui_endpoint", "llm_endpoint", "llm_apikey", "llm_model"]
    for field in required_fields:
        if field not in providers:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Update the in-memory configuration
    if "providers" not in CONFIG:
        CONFIG["providers"] = {}
    
    CONFIG["providers"] = providers
    
    # Persist to file
    with open(CONFIG_FILE, 'w') as f:
        json.dump(CONFIG, f, indent=4)
    
    return {"success": True, "providers": providers}


@app.get("/api/config/models")
async def get_llm_models():
    """Fetch available LLM models from the configured LLM endpoint."""
    providers = CONFIG.get("providers", {})
    llm_endpoint = providers.get("llm_endpoint", "")
    llm_apikey = providers.get("llm_apikey", "")
    
    if not llm_endpoint:
        raise HTTPException(status_code=400, detail="LLM endpoint not configured")
    
    # Build headers with optional Bearer authentication
    headers = {}
    if llm_apikey:
        headers["Authorization"] = f"Bearer {llm_apikey}"
    
    try:
        # Try common endpoints for listing models
        models_endpoint = f"{llm_endpoint}/models"
        if not llm_endpoint.endswith("/api/v1"):
            # If endpoint doesn't end with /api/v1, try appending /models directly
            models_endpoint = llm_endpoint.rstrip("/") + "/models"
        
        response = requests.get(models_endpoint, headers=headers, timeout=10)
        
        if response.ok:
            data = response.json()
            
            # Handle different response formats
            models = []
            if isinstance(data, list):
                models = data
            elif isinstance(data, dict):
                if "models" in data and isinstance(data["models"], list):
                    models = data["models"]
                elif "data" in data and isinstance(data["data"], list):
                    models = data["data"]
            
            # Extract model names/IDs
            model_list = []
            for model in models:
                if isinstance(model, str):
                    model_list.append(model)
                elif isinstance(model, dict):
                    model_id = model.get("id") or model.get("name") or model.get("model")
                    if model_id:
                        model_list.append(model_id)
            
            return {"models": model_list}
        else:
            # Try alternative endpoint format
            alt_endpoint = llm_endpoint.replace("/api/v1", "").rstrip("/") + "/models"
            alt_response = requests.get(alt_endpoint, headers=headers, timeout=10)
            
            if alt_response.ok:
                data = alt_response.json()
                models = data.get("models") or data.get("data") or []
                
                model_list = []
                for model in models:
                    if isinstance(model, str):
                        model_list.append(model)
                    elif isinstance(model, dict):
                        model_id = model.get("id") or model.get("name") or model.get("model")
                        if model_id:
                            model_list.append(model_id)
                
                return {"models": model_list}
            else:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to fetch models from LLM endpoint: {alt_response.status_code} {alt_response.text}"
                )
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to connect to LLM endpoint: {str(e)}")


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
    height: int = Form(1024),
    seed: int = Form(-1),
    upscale_switch: bool = Form(False),
    upscale_resolution: int = Form(1024)
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
        
        image_base64 = await execute_comfyui_workflow(
            prompt_text, profile_config, width, height, seed, upscale_switch, upscale_resolution
        )
        
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
    server_config = CONFIG.get("server", {})
    host = server_config.get("host", "0.0.0.0")
    port = server_config.get("port", 8000)
    uvicorn.run(app, host=host, port=port)
