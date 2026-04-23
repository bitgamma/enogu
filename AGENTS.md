# Project Structure and Architecture

## Overview

This project is a web application that combines LLM-based image analysis with ComfyUI image generation. It provides a REST API backend built with FastAPI and a simple frontend for user interaction. The application is named "Enogu" and focuses on "redrawing reality" by analyzing uploaded images and generating new variations.

## Directory Structure

```
imagegen/
├── app.py              # Entry point - imports from app package
├── app/                # Main application package
│   ├── __init__.py     # Package init
│   ├── main.py         # FastAPI app setup, middleware, exception handlers
│   ├── config.py       # Configuration loading, constants, providers management
│   ├── models.py       # Pydantic models for API request/response validation
│   ├── routes/         # API route handlers
│   │   ├── __init__.py
│   │   ├── profiles.py     # Profile CRUD endpoints
│   │   ├── generation.py   # /api/analyze, /api/generate
│   │   └── config.py       # /api/config/* endpoints
│   ├── services/       # Business logic services
│   │   ├── __init__.py
│   │   ├── llm.py          # LLMService for image analysis
│   │   └── comfyui.py      # ComfyUIService for workflow execution
│   └── utils/          # Shared utilities
│       ├── __init__.py
│       ├── files.py        # ProfileManager, file I/O helpers
│       ├── image.py        # Image processing (resize, encode)
│       ├── validation.py   # Validation, parameter mapping, decorators
│       └── exceptions.py   # Custom exception classes
├── config.json         # Global configuration (created from template)
├── config.template.json # Configuration template file
├── pyproject.toml      # Project dependencies and configuration
├── tests/              # Unit tests
│   ├── __init__.py
│   ├── test_image.py
│   ├── test_profile_manager.py
│   └── test_validation.py
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

## Core Architecture Principles

### Separation of Concerns

The backend follows a clear layered architecture:

1. **Routes** (`app/routes/`): HTTP layer - handles request/response, validation via Pydantic models
2. **Services** (`app/services/`): Business logic layer - independent of HTTP, testable with mocks
3. **Utils** (`app/utils/`): Shared utilities - file I/O, image processing, validation helpers
4. **Config** (`app/config.py`): Configuration management - in-memory mutable config with file persistence

### Service Pattern

External integrations are encapsulated in service classes:

- **`LLMService`** (`app/services/llm.py`): Handles LLM API interactions for image analysis and model listing
- **`ComfyUIService`** (`app/services/comfyui.py`): Handles ComfyUI workflow execution, polling, and image extraction

Services are instantiated via factory functions (`create_llm_service()`, `create_comfyui_service()`) that read from the global configuration.

### Configuration Management

- Configuration is loaded into a mutable dict (`_config`) at import time
- `save_providers()` updates both in-memory state and persists to file
- Constants are defined in `app/config.py` (replaces magic numbers)
- Pydantic models provide request validation at the route layer

### Error Handling

- Custom exception classes in `app/utils/exceptions.py` (`AppException`, `ProfileNotFoundError`, `LLMError`, etc.)
- Global exception handlers in `app/main.py` convert exceptions to consistent JSON responses
- `@handle_api_errors` decorator catches non-HTTP exceptions in route handlers

## Core Components

### Backend Package Structure

#### Routes (`app/routes/`)

Route modules handle HTTP requests and responses:

- **`profiles.py`**: Profile CRUD endpoints (`/api/profile-editor/*`)
- **`generation.py`**: Image analysis and generation (`/api/analyze`, `/api/generate`)
- **`config.py`**: Configuration management (`/api/config/*`)

Each route module defines a FastAPI `APIRouter` with appropriate prefix and tags.

#### Services (`app/services/`)

Service classes encapsulate external API interactions:

- **`LLMService.analyze_image()`**: Sends image to LLM using tool calling
- **`LLMService.list_models()`**: Fetches available LLM models
- **`ComfyUIService.execute_async()`**: Queues workflow, polls for completion, extracts result

#### Utils (`app/utils/`)

Shared utilities organized by concern:

- **`files.py`**: `ProfileManager` class for profile file operations
- **`image.py`**: `resize_image_for_llm()`, `encode_image_to_base64()`
- **`validation.py`**: `validate_profile_name()`, `apply_mappings()`, `PARAM_HANDLERS`, decorators
- **`exceptions.py`**: Custom exception hierarchy

#### Models (`app/models.py`)

Pydantic models for API validation:

- `ProviderConfig`, `ProfileSaveRequest`, `ProfileDuplicateRequest`, etc.
- Response models: `AnalyzeResponse`, `GenerateResponse`, `ModelListResponse`, etc.

#### Configuration (`app/config.py`)

Central configuration module:

- Constants: `MAX_LLM_IMAGE_PIXELS`, `LLM_TIMEOUT_SECONDS`, `COMFYUI_POLL_TIMEOUT_SECONDS`, etc.
- Functions: `get_config()`, `get_providers()`, `save_providers()`

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
   - Profile editor and configuration management

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
3. `LLMService.analyze_image()` sends image to LLM with the profile's extraction prompt and a tool definition
4. LLM returns a tool call with `generate_image` function containing:
   - `status`: "OK" or "NOK"
   - `prompt`: The generation prompt (if status is "OK")
   - `error_reason`: Error explanation (if status is "NOK")
5. Backend returns the prompt to the frontend

### Image Generation Flow

1. User reviews/modifies the extracted prompt
2. User selects aspect ratio and optional upscaling settings
3. Backend loads workflow via `get_workflow_with_mappings()` which applies parameter mappings
4. `ComfyUIService.execute_async()` queues the workflow and polls for completion
5. Generated image is retrieved from ComfyUI and returned as base64
6. Image is displayed in the frontend and added to history

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the frontend application |
| GET | `/api/profiles` | Lists all available profiles |
| POST | `/api/analyze` | Analyzes an uploaded image and returns a generation prompt |
| POST | `/api/generate` | Generates an image from a prompt using ComfyUI |
| GET | `/api/profile-editor/profile/{name}` | Gets full profile content for editing |
| POST | `/api/profile-editor/profile` | Creates or updates a profile |
| POST | `/api/profile-editor/profile/duplicate` | Duplicates a profile |
| DELETE | `/api/profile-editor/profile/{name}` | Deletes a profile |
| POST | `/api/profile-editor/profile/rename` | Renames a profile |
| GET | `/api/profile-editor/download/{name}` | Downloads a profile as ZIP |
| GET | `/api/profile-editor/download-all` | Downloads all profiles as ZIP |
| GET | `/api/config/providers` | Gets providers configuration |
| POST | `/api/config/providers` | Updates providers configuration (applies immediately) |
| GET | `/api/config/models` | Fetches available LLM models |

## Testing

Unit tests are located in `tests/` and use pytest:

```bash
python -m pytest tests/ -v
```

Test modules:
- `test_validation.py`: Profile name validation, parameter mapping
- `test_image.py`: Image resizing and base64 encoding
- `test_profile_manager.py`: Profile CRUD operations

## Linting

Ruff is configured for linting and formatting:

```bash
ruff check .
ruff format .
```

## Key Dependencies

- **FastAPI**: Async web framework for the API
- **Uvicorn**: ASGI server for running the application
- **Requests**: HTTP client for calling LLM and ComfyUI APIs
- **Pillow**: Image manipulation and resizing
- **python-multipart**: Handling file uploads in forms
- **Pydantic**: Request/response validation

## Development Commands

```bash
# Run the application
python app.py

# Run tests
python -m pytest tests/ -v

# Lint code
ruff check .

# Format code
ruff format .
```

## Environment Variables

The application reads configuration from `config.json` rather than environment variables. Profile configurations should be secured appropriately when deploying.

## Running in Production

For production deployment:

1. Ensure ComfyUI is running and accessible
2. Create `config.json` from `config.template.json` with production endpoints and secure API keys
3. Configure profiles with appropriate workflows and prompts
4. Run the application with a production ASGI server (e.g., `uvicorn app.main:app --host 0.0.0.0 --port 8000`)
5. Set up proper CORS policies if needed
6. Consider adding authentication for sensitive endpoints
7. Use a reverse proxy (nginx, Apache) for SSL termination and additional security
