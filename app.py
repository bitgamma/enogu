"""
Image Generation Webapp Backend
Processes uploaded images through an LLM and generates new images via ComfyUI.
Supports multiple profiles for different generation configurations.
"""

import asyncio
import base64
import copy
import io
import json
import re
import shutil
import tempfile
import zipfile
from functools import wraps
from pathlib import Path

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

# Default system prompt for tool calling
DEFAULT_SYSTEM_PROMPT = "You are an image analysis assistant specialized in extracting image generation prompts. Your task is to analyze the uploaded image and extract a detailed prompt for image generation. You MUST call the generate_image tool with your extracted prompt and status."

# LLM tool definition for image analysis
GENERATE_IMAGE_TOOL = {
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
    extraction_prompt = read_file_content(prompt_file_path, strip=True)
    if extraction_prompt is None:
        raise HTTPException(status_code=404, detail="Prompt file extraction_prompt.txt not found")
    profile_settings["extraction_prompt"] = extraction_prompt
    
    return profile_settings


def load_mappings(profile_name: str) -> dict:
    """Load parameter mappings from mappings.json in the profile directory."""
    mappings_path = PROFILES_DIR / profile_name / "mappings.json"
    return read_file_content(mappings_path, as_json=True) or {}


def apply_mappings(workflow: dict, mappings: dict, prompt: str, width: int, height: int, seed: int, upscale_switch: bool, upscale_resolution: int) -> dict:
    """
    Apply parameter mappings to the workflow.
    
    Mappings format: {"param_name": "node_id"}
    The node_id is used directly as a key in the workflow to find the node to replace.
    """
    workflow = copy.deepcopy(workflow)
    
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
    ensure_file_exists(workflow_path, f"Workflow for profile '{profile_name}' not found")
    return read_file_content(workflow_path, as_json=True) or {}


# list_profiles() removed - API endpoint calls profile_manager.list_profiles() directly


# ============== Profile Editor Helper Functions ==============

def validate_profile_name(name: str) -> bool:
    """Validate profile name to prevent directory traversal attacks."""
    return bool(re.match(r'^[a-zA-Z0-9_-]+$', name))


def validate_profile_name_or_raise(name: str | None, field: str = "profile name") -> None:
    """Validate profile name and raise HTTPException if invalid."""
    if not name or not validate_profile_name(name):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")


# ============== Reusable Helper Functions ==============

def read_file_content(path: Path, strip: bool = False, as_json: bool = False):
    """Read file content with optional processing. Returns None if file doesn't exist."""
    if not path.exists():
        return None
    with open(path) as f:
        content = f.read()
    if strip:
        content = content.strip()
    if as_json:
        return json.loads(content)
    return content


def ensure_file_exists(path: Path, context: str) -> Path:
    """Ensure a file exists, raising HTTPException if not. Returns the path."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=context)
    return path


def validate_json(value, field_name="field"):
    """Validate and parse JSON string or return dict as-is. Returns None if value is None."""
    if value is None:
        return None
    try:
        if isinstance(value, str):
            return json.loads(value)
        return value  # Already a dict
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} JSON")


def extract_model_names(models):
    """Extract model names from various API response formats (list of strings or dicts)."""
    model_list = []
    for model in models:
        if isinstance(model, str):
            model_list.append(model)
        elif isinstance(model, dict):
            model_id = model.get("id") or model.get("name") or model.get("model")
            if model_id:
                model_list.append(model_id)
    return model_list


def create_zip(profiles_dir: Path, zip_path: str, single_profile: str | None = None) -> None:
    """Create a ZIP file containing profile files.
    
    If single_profile is specified, only that profile's files are included.
    Otherwise, all profile directories are included.
    """
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        if single_profile:
            profile_path = profiles_dir / single_profile
            if profile_path.is_dir():
                for filepath in profile_path.iterdir():
                    zipf.write(filepath, filepath.name)
        else:
            for profile_dir in profiles_dir.iterdir():
                if profile_dir.is_dir():
                    for filepath in profile_dir.iterdir():
                        zipf.write(filepath, f"{profile_dir.name}/{filepath.name}")


# ============== Decorators ==============

def require_valid_profile_name(func):
    """Decorator that validates profile_name parameter in kwargs."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        profile_name = kwargs.get('profile_name')
        if profile_name and not validate_profile_name(profile_name):
            raise HTTPException(status_code=400, detail="Invalid profile name")
        return await func(*args, **kwargs)
    return wrapper


def handle_api_errors(func):
    """Decorator that catches non-HTTP exceptions and converts them to 500 errors."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return wrapper


class ProfileManager:
    """Manages profile file operations."""
    
    def __init__(self, profiles_dir: Path):
        self.profiles_dir = profiles_dir
    
    def ensure_exists(self, profile_name: str) -> None:
        """Raise HTTPException if profile does not exist."""
        if not (self.profiles_dir / profile_name).exists():
            raise HTTPException(status_code=404, detail=f"Profile '{profile_name}' not found")
    
    def ensure_not_exists(self, profile_name: str) -> None:
        """Raise HTTPException if profile already exists."""
        if (self.profiles_dir / profile_name).exists():
            raise HTTPException(status_code=400, detail=f"Profile '{profile_name}' already exists")
    
    def list_profiles(self) -> list[dict]:
        """List all profiles that have an extraction_prompt.txt file."""
        profiles = []
        for item in self.profiles_dir.iterdir():
            if item.is_dir() and (item / "extraction_prompt.txt").exists():
                profiles.append({"name": item.name})
        return sorted(profiles, key=lambda x: x["name"])
    
    def get_content(self, profile_name: str) -> dict:
        """Read all files from a profile directory."""
        profile_path = self.profiles_dir / profile_name
        if not profile_path.exists():
            raise HTTPException(status_code=404, detail=f"Profile '{profile_name}' not found")
        files = {}
        for filename in ["extraction_prompt.txt", "workflow.json", "mappings.json"]:
            filepath = profile_path / filename
            files[filename] = filepath.read_text() if filepath.exists() else None
        return files
    
    def save_files(self, profile_name: str, files: dict) -> None:
        """Save all files to a profile directory."""
        profile_path = self.profiles_dir / profile_name
        profile_path.mkdir(parents=True, exist_ok=True)
        for filename, content in files.items():
            if content is not None:
                (profile_path / filename).write_text(content)
    
    def delete(self, profile_name: str) -> None:
        """Delete a profile directory."""
        profile_path = self.profiles_dir / profile_name
        if profile_path.exists():
            shutil.rmtree(profile_path)
    
    def rename(self, old_name: str, new_name: str) -> None:
        """Rename a profile directory."""
        shutil.move(str(self.profiles_dir / old_name), str(self.profiles_dir / new_name))
    
    def duplicate(self, source_name: str, new_name: str) -> None:
        """Duplicate a profile directory with a new name."""
        shutil.copytree(str(self.profiles_dir / source_name), str(self.profiles_dir / new_name))
    
    def _create_temp_zip(self) -> str:
        """Create a temporary zip file and return its path."""
        return tempfile.NamedTemporaryFile(delete=False, suffix='.zip').name
    
    def create_zip(self, profile_name: str) -> str:
        """Create a ZIP file for a single profile."""
        zip_path = self._create_temp_zip()
        create_zip(self.profiles_dir, zip_path, single_profile=profile_name)
        return zip_path
    
    def create_all_zip(self) -> str:
        """Create a ZIP file containing all profiles."""
        zip_path = self._create_temp_zip()
        create_zip(self.profiles_dir, zip_path)
        return zip_path


# Create profile manager instance
profile_manager = ProfileManager(PROFILES_DIR)


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
    
    # Use the predefined tool definition
    tools = [GENERATE_IMAGE_TOOL]
    
    payload = {
        "messages": [
            {
                "role": "system",
                "content": profile.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
            },
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_image}"}},
                    {"type": "text", "text": profile["extraction_prompt"]}
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
    return {"profiles": profile_manager.list_profiles()}


# ============== Profile Editor API Endpoints ==============

@app.get("/api/profile-editor/profile/{profile_name}")
@require_valid_profile_name
async def get_profile_api(profile_name: str):
    """Get full profile content (all 3 files)."""
    files = profile_manager.get_content(profile_name)
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
    validate_profile_name_or_raise(profile_name, "profile name")
    
    extraction_prompt = request.get("extraction_prompt")
    
    # Validate and parse JSON files if provided
    workflow = validate_json(request.get("workflow"), "workflow")
    mappings = validate_json(request.get("mappings"), "mappings")
    
    files = {
        "extraction_prompt.txt": extraction_prompt,
        "workflow.json": workflow if isinstance(workflow, str) else json.dumps(workflow, indent=4),
        "mappings.json": mappings if isinstance(mappings, str) else json.dumps(mappings, indent=4)
    }
    
    profile_manager.save_files(profile_name, files)
    return {"status": "success", "message": f"Profile '{profile_name}' saved"}


@app.post("/api/profile-editor/profile/duplicate")
async def duplicate_profile_api(request: dict):
    """Duplicate an existing profile with a new name."""
    source_name = request.get("source_name")
    new_name = request.get("new_name")
    
    validate_profile_name_or_raise(source_name, "source profile name")
    validate_profile_name_or_raise(new_name, "new profile name")
    
    profile_manager.ensure_exists(source_name)
    profile_manager.ensure_not_exists(new_name)
    
    profile_manager.duplicate(source_name, new_name)
    return {"status": "success", "message": f"Profile '{source_name}' duplicated as '{new_name}'"}


@app.delete("/api/profile-editor/profile/{profile_name}")
@require_valid_profile_name
async def delete_profile_api(profile_name: str):
    """Delete a profile."""
    profile_manager.ensure_exists(profile_name)
    profile_manager.delete(profile_name)
    return {"status": "success", "message": f"Profile '{profile_name}' deleted"}


@app.post("/api/profile-editor/profile/rename")
async def rename_profile_api(request: dict):
    """Rename a profile."""
    old_name = request.get("old_name")
    new_name = request.get("new_name")
    
    validate_profile_name_or_raise(old_name, "old profile name")
    validate_profile_name_or_raise(new_name, "new profile name")
    
    profile_manager.ensure_exists(old_name)
    profile_manager.ensure_not_exists(new_name)
    
    profile_manager.rename(old_name, new_name)
    return {"status": "success", "message": f"Profile '{old_name}' renamed to '{new_name}'"}


@app.get("/api/profile-editor/download/{profile_name}")
@require_valid_profile_name
async def download_profile_api(profile_name: str):
    """Download a single profile as ZIP."""
    profile_manager.ensure_exists(profile_name)
    zip_path = profile_manager.create_zip(profile_name)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"{profile_name}.zip"
    )


@app.get("/api/profile-editor/download-all")
async def download_all_profiles_api():
    """Download all profiles as ZIP."""
    zip_path = profile_manager.create_all_zip()
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


# ============== Image Analysis & Generation API Endpoints ==============


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
            
            return {"models": extract_model_names(models)}
        else:
            # Try alternative endpoint format
            alt_endpoint = llm_endpoint.replace("/api/v1", "").rstrip("/") + "/models"
            alt_response = requests.get(alt_endpoint, headers=headers, timeout=10)
            
            if alt_response.ok:
                data = alt_response.json()
                models = data.get("models") or data.get("data") or []
                return {"models": extract_model_names(models)}
            else:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to fetch models from LLM endpoint: {alt_response.status_code} {alt_response.text}"
                )
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to connect to LLM endpoint: {str(e)}")


@app.post("/api/analyze")
@handle_api_errors
async def analyze_image(
    file: UploadFile = File(...),
    profile: str = Form(...)
):
    """
    Analyze uploaded image and return generation prompt.
    Uses the specified profile configuration.
    """
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


@app.post("/api/generate")
@handle_api_errors
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


if __name__ == "__main__":
    import uvicorn
    server_config = CONFIG.get("server", {})
    host = server_config.get("host", "0.0.0.0")
    port = server_config.get("port", 8000)
    uvicorn.run(app, host=host, port=port)
