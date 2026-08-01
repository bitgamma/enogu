# Enogu - Redraw Reality

> **Note** This project is vibecoded using various models (Qwen3.5-35B-A3B, Qwen3.5-122B-A3B, Qwen3.6-35B-A3B, Qwen3.6-27B, DeepSeek-V4-Flash-0731) with different tools (RooCode, KiloCode, OpenCode, pi) via Lemonade. It is a test bench to test new harnesses and models. It also happens to scratch an itch I had an am having lots of fun using it but that doesn't mean that it will be useful to you. It does nothing that you couldn't do using ComfyUI + your favorite LLM tool alone.

A web application that processes uploaded images through an LLM for analysis and generates new images via ComfyUI integration. The application supports multiple **profiles** (LLM analysis prompts) and **workflows** (ComfyUI configurations). When you upload a reference image, the profile's "extraction" prompt is sent to the LLM along with the image to produce an image-generation prompt; that prompt is then run through a ComfyUI workflow. By playing with the extraction prompt you can have the LLM generate interesting prompts, which makes the whole thing quite fun to use.

## Features

- Image upload and analysis using LLM with tool calling
- Automatic prompt extraction from uploaded images
- Image generation via ComfyUI workflows
- Separate **profile** (LLM extraction prompt) and **workflow** (ComfyUI graph + mappings) management
- Custom aspect ratio selection (1:1, 4:3, 16:9, 20:9 in portrait/landscape)
- Upscaling support with configurable resolution (1x, 1.5x, 2x)
- Image history (last 10 generated images)
- Re-analyze and regenerate capabilities
- **Gallery** for saving and browsing generated images
- In-app editors for profiles, workflows, and provider configuration (with LLM model refresh)
- Mobile-friendly with camera capture support

## Demo

<img src="enogu.webp" alt="Enogu Demo" width="50%">

## Prerequisites

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) package manager (recommended)
- ComfyUI server running with appropriate workflows
- LLM API access

## Installation

Using `uv` (recommended):

```bash
uv sync
```

This will create a virtual environment and install all dependencies defined in `pyproject.toml`.

## Configuration

### Global Configuration

Create a `config.json` file in the project root (use `config.template.json` as a starting point):

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
        "llm_model": "user.Qwen3.5-35B-A3B-NoThinking",
        "system_prompt": ""
    }
}
```

Missing keys fall back to defaults, and writes are atomic.

### Profile Configuration

Profiles are stored in the `profiles/` directory. Each profile directory contains only:

- `extraction_prompt.txt` - Prompt template for LLM image analysis

Profiles control how the LLM analyzes an image and what prompt it produces.

### Workflow Configuration

Workflows are stored in the `workflows/` directory (separate from profiles). Each workflow directory contains:

- `workflow.json` - ComfyUI workflow definition
- `mappings.json` - Parameter mappings for dynamic workflow configuration

The `mappings.json` file maps parameters like `prompt`, `seed`, `resolution`, `upscaler_switch`, and `upscale_resolution` to specific nodes in the workflow by their node IDs.

## Running the Application

```bash
uv run python app.py
```

The server will start on `http://localhost:8380` (or the port specified in `config.json`).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the frontend application |
| GET | `/api/profiles` | Lists all available profiles |
| GET | `/api/workflows` | Lists all available workflows |
| POST | `/api/analyze` | Analyzes an uploaded image and returns a generation prompt |
| POST | `/api/generate` | Generates an image from a prompt using a ComfyUI workflow |
| GET | `/api/gallery` | Lists saved generated images |
| GET | `/api/gallery/{filename}` | Downloads a saved image |
| DELETE | `/api/gallery` | Deletes all saved images |
| DELETE | `/api/gallery/{filename}` | Deletes a saved image |
| GET/POST | `/api/profile-editor/profile` | Get / save a profile |
| POST | `/api/profile-editor/profile/duplicate` | Duplicates a profile |
| DELETE | `/api/profile-editor/profile/{name}` | Deletes a profile |
| POST | `/api/profile-editor/profile/rename` | Renames a profile |
| GET | `/api/profile-editor/download/...` | Downloads profiles as ZIP |
| GET/POST | `/api/workflow-editor/workflow` | Get / save a workflow |
| POST | `/api/workflow-editor/workflow/duplicate` | Duplicates a workflow |
| DELETE | `/api/workflow-editor/workflow/{name}` | Deletes a workflow |
| POST | `/api/workflow-editor/workflow/rename` | Renames a workflow |
| GET | `/api/workflow-editor/download/...` | Downloads workflows as ZIP |
| GET/POST | `/api/config/providers` | Gets / updates provider configuration |
| GET | `/api/config/models` | Fetches available LLM models |

### Core Generation Endpoints

- `POST /api/analyze`
  - `file`: UploadFile - The image to analyze
  - `profile`: str - Profile name to use
  - Returns: `{"success": true, "prompt": "..."}` or error
- `POST /api/generate`
  - `prompt`: str - The generation prompt
  - `workflow`: str - Workflow name to use
  - `width`: int (default: 1024) - Image width
  - `height`: int (default: 1024) - Image height
  - `seed`: int (default: -1) - Random seed (-1 for random)
  - `upscale_switch`: bool (default: false) - Enable upscaling
  - `upscale_resolution`: int (default: 1024) - Upscaled resolution
  - `save`: bool (default: false) - Save to the gallery
  - Returns: `{"success": true, "image": "data:image/png;base64,..."}` or error

## Frontend Features

- **Generate View**: Select a profile + workflow, upload an image, and run the analyze → generate flow
- **Image Upload**: Drag-and-drop or click to upload images
- **Mobile Camera**: Direct camera capture on mobile devices
- **Aspect Ratio Selection**: Choose from predefined ratios (1:1, 4:3, 16:9, 20:9)
- **Upscaling**: Optional upscaling with configurable resolution
- **Image History**: View last 10 generated images
- **Re-analyze**: Re-run LLM analysis on the same image
- **Regenerate**: Generate a new image with the same prompt
- **Profile Editor**: Create/rename/duplicate/delete profiles and edit their extraction prompt
- **Workflow Editor**: Create/rename/duplicate/delete workflows and edit workflow JSON + mappings
- **Config Editor**: Edit provider endpoints/keys and refresh the LLM model list
- **Gallery**: Browse, download, and delete saved generated images

## Running the Tests

```bash
python -m pytest tests/ -v
```

Tests cover name validation, parameter mapping, image processing, profile/workflow managers, and the LLM/ComfyUI services (with mocked HTTP).

## Dependencies

- **FastAPI** - Async web framework for the API
- **Uvicorn** - ASGI server
- **httpx** - Async HTTP client for calling LLM and ComfyUI APIs
- **Pillow** - Image manipulation and resizing
- **python-multipart** - Handling file uploads in forms
- **Pydantic** - Request/response validation

## Project Structure

```
imagegen/
├── app.py              # Entry point
├── app/                # Backend package
│   ├── main.py         # FastAPI app setup, middleware, exception handlers
│   ├── config.py       # Configuration loading, constants, providers management
│   ├── models.py       # Pydantic request/response models
│   ├── routes/         # API route handlers (generation, gallery, profiles, workflows, config)
│   ├── services/       # Business logic (llm, comfyui, profile, workflow)
│   └── utils/          # Shared utilities (files, image, validation)
├── config.json         # Global configuration (created from config.template.json)
├── config.template.json # Configuration template
├── pyproject.toml      # Project dependencies
├── tests/              # Unit tests
├── frontend/           # Static frontend files (ES modules)
│   ├── index.html      # Main HTML page
│   ├── main.js         # Entry point, navigation, event binding
│   ├── api.js          # API call functions
│   ├── state.js        # State management and DOM registry
│   ├── ui.js           # UI operations and dialog components
│   ├── refresh.js      # Shared data-loading / refresh helpers
│   ├── editor.js       # Shared editor operation executor
│   ├── profile-editor.js # Profile editor logic
│   ├── workflow-editor.js # Workflow editor logic
│   ├── config-editor.js  # Configuration editor logic
│   ├── history.js      # Image history management
│   └── styles.css      # CSS styling
├── profiles/           # Prompt profiles (extraction_prompt.txt per profile)
└── workflows/          # ComfyUI workflows (workflow.json + mappings.json per workflow)
```

## Security Note

This is a local/LAN toy project. There is **no authentication** on any endpoint, including the config endpoints that read/write API keys, and CORS is wide open. If deployed beyond a trusted LAN, add authentication and restrict CORS.

## License

MIT
