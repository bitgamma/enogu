# Project Structure and Architecture

## Overview

This project is a web application that combines LLM-based image analysis with ComfyUI image generation. It provides a REST API backend built with FastAPI and a simple frontend for user interaction. The application is named "Enogu" and focuses on "redrawing reality" by analyzing uploaded images and generating new variations.

## Directory Structure

```
imagegen/
├── app.py              # Main FastAPI application and API endpoints
├── config.json         # Global configuration (created from template)
├── config.template.json # Configuration template file
├── pyproject.toml      # Project dependencies and configuration
├── .gitignore          # Git ignore rules
├── frontend/           # Static frontend files
│   ├── index.html      # Main HTML page
│   ├── app.js          # Frontend JavaScript logic
│   └── styles.css      # CSS styling
└── profiles/           # Profile configurations
    └── <profile_name>/ # Individual profile directories
        ├── extraction_prompt.txt  # LLM analysis prompt
        ├── workflow.json    # ComfyUI workflow definition
        └── mappings.json    # Parameter mappings
```

## Core Components

### Backend (app.py)

The backend is a FastAPI application that handles:

1. **Static File Serving**: Serves the frontend HTML, CSS, and JavaScript files from the `frontend/` directory
2. **Profile Management**: Loads and validates profile configurations from the `profiles/` directory
3. **Image Processing**: Resizes images for LLM analysis using Pillow (max 1.5 megapixels, preserves aspect ratio)
4. **LLM Integration**: Sends images to an LLM API using tool calling for analysis and prompt extraction
5. **ComfyUI Integration**: Executes workflows and retrieves generated images

#### Key Functions

- [`get_profile()`](app.py:55) - Loads a profile configuration by name
- [`load_mappings()`](app.py:81) - Loads parameter mappings from `mappings.json`
- [`apply_mappings()`](app.py:91) - Applies parameter mappings to the workflow
- [`get_workflow()`](app.py:136) - Loads a workflow configuration by name
- [`list_profiles()`](app.py:146) - Lists all available profiles
- [`resize_image_for_llm()`](app.py:158) - Resizes image for LLM processing
- [`encode_image_to_base64()`](app.py:181) - Encodes PIL Image to base64
- [`llm_analyze_image()`](app.py:188) - Sends image to LLM using tool calling
- [`execute_comfyui_workflow()`](app.py:278) - Executes ComfyUI workflow and returns base64 image

### Frontend

The frontend consists of three files:

1. **index.html**: The main user interface with three screens:
   - Screen 1: Profile selection and image upload
   - Screen 2: Processing (analysis + generation)
   - Screen 3: Result display with controls

2. **app.js**: Handles user interactions, API calls, and UI updates
   - Profile loading and selection
   - Image upload (drag-and-drop, file input, mobile camera)
   - Progress bar with step indicators
   - Image history management (last 10 images)
   - Resolution and upscaling controls

3. **styles.css**: Visual styling and layout

### Profiles

Profiles are configuration units that define:

- **extraction_prompt.txt**: Prompt template for image analysis sent to the LLM
- **workflow.json**: ComfyUI workflow definition
- **mappings.json**: Parameter mappings for dynamic workflow configuration

Each profile is stored in its own directory under `profiles/`. The mappings file uses the format:
```json
{
    "prompt": "node_id_for_prompt",
    "seed": "node_id_for_seed",
    "resolution": "node_id_for_resolution",
    "upscaler_switch": "node_id_for_switch",
    "upscale_resolution": "node_id_for_value"
}
```

### Configuration

#### Global Configuration (config.json)

```json
{
    "server": {
        "host": "0.0.0.0",
        "port": 8380
    },
    "providers": {
        "comfyui_endpoint": "http://localhost:8188",
        "llm_endpoint": "http://localhost:8000/api/v1",
        "llm_apikey": "your-api-key",
        "llm_model": "user.Qwen3.5-35B-A3B-NoThinking"
    }
}
```

- **server.host**: Listening host
- **server.port**: Listening port
- **providers.comfyui_endpoint**: ComfyUI server endpoint
- **providers.llm_endpoint**: LLM API endpoint
- **providers.llm_apikey**: API key for LLM access
- **providers.llm_model**: Model name for LLM
- **providers.system_prompt** (optional): Custom system prompt for tool calling

## Data Flow

### Image Analysis Flow

1. User uploads an image through the frontend
2. Backend receives the image and resizes it for LLM processing (max 1.5MP)
3. Image is sent to the LLM with the profile's extraction prompt and a tool definition
4. LLM returns a tool call with `generate_image` function containing:
   - `status`: "OK" or "NOK"
   - `prompt`: The generation prompt (if status is "OK")
   - `error_reason`: Error explanation (if status is "NOK")
5. Backend returns the prompt to the frontend

### Image Generation Flow

1. User reviews/modifies the extracted prompt
2. User selects aspect ratio and optional upscaling settings
3. Backend executes the ComfyUI workflow with the prompt and parameters
4. Workflow is queued and polling waits for completion
5. Generated image is retrieved from ComfyUI and returned as base64
6. Image is displayed in the frontend and added to history

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the frontend application |
| GET | `/api/profiles` | Lists all available profiles |
| POST | `/api/analyze` | Analyzes an uploaded image and returns a generation prompt |
| POST | `/api/generate` | Generates an image from a prompt using ComfyUI |

## Frontend Features

- **Profile Selection**: Dropdown to choose from available profiles
- **Image Upload**: Drag-and-drop or click-to-upload with preview
- **Mobile Camera**: Direct camera capture on mobile devices (shown only on mobile)
- **Aspect Ratio Selection**: Predefined ratios (1:1, 4:3, 16:9, 20:9 in portrait/landscape)
- **Upscaling**: Optional upscaling with configurable resolution (1x, 2x, 4x)
- **Image History**: Grid display of last 10 generated images with download capability
- **Re-analyze**: Re-run LLM analysis on the same image
- **Regenerate**: Generate a new image with the same prompt and settings
- **Progress Bar**: Visual feedback with step indicators (Select, Processing, Result)

## Key Dependencies

- **FastAPI**: Async web framework for the API
- **Uvicorn**: ASGI server for running the application
- **Requests**: HTTP client for calling LLM and ComfyUI APIs
- **Pillow**: Image manipulation and resizing
- **python-multipart**: Handling file uploads in forms

## Environment Variables

The application reads configuration from `config.json` rather than environment variables. Profile configurations should be secured appropriately when deploying.

## Running in Production

For production deployment:

1. Ensure ComfyUI is running and accessible
2. Create `config.json` from `config.template.json` with production endpoints and secure API keys
3. Configure profiles with appropriate workflows and prompts
4. Run the application with a production ASGI server (e.g., `uvicorn app:app --host 0.0.0.0 --port 8000`)
5. Set up proper CORS policies if needed
6. Consider adding authentication for sensitive endpoints
7. Use a reverse proxy (nginx, Apache) for SSL termination and additional security
