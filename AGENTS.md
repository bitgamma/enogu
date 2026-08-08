# Project Structure and Architecture

## Overview

This project is a web application that combines LLM-based image analysis with image generation through a single OpenAI-compatible endpoint. It provides a REST API backend built with FastAPI and a simple frontend for user interaction. The application is named "Enogu" and focuses on "redrawing reality" by analyzing uploaded images and generating new variations.

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
│   │   ├── generation.py   # /api/analyze, /api/generate, /api/profiles, /api/presets
│   │   ├── gallery.py      # /api/gallery/* (saved generated images)
│   │   ├── profiles.py     # /api/profile-editor/* (prompt profile CRUD)
│   │   ├── presets.py      # /api/preset-editor/* (generation preset CRUD)
│   │   └── config.py       # /api/config/* endpoints
│   ├── services/       # Business logic services (HTTP-independent, testable)
│   │   ├── __init__.py
│   │   ├── llm.py          # LLMService for image analysis and generation (async httpx)
│   │   ├── preset.py       # Preset loading
│   │   └── profile.py      # Profile loading + extraction-prompt cache
│   └── utils/          # Shared utilities
│       ├── __init__.py
│       ├── files.py        # FileSetManager base + ProfileManager/PresetManager
│       ├── image.py        # Image processing (resize, encode)
│       ├── validation.py   # Validation, decorators
├── config.json         # Global configuration (created from template)
├── config.template.json # Configuration template file
├── pyproject.toml      # Project dependencies and configuration
├── tests/              # Unit tests
│   ├── test_image.py
│   ├── test_profile_manager.py
│   ├── test_preset_manager.py
│   ├── test_validation.py
│   └── test_llm.py
├── frontend/           # Static frontend files (ES modules)
│   ├── index.html
│   ├── main.js         # Entry point, navigation handlers, event binding
│   ├── api.js          # API call functions with unified error handling
│   ├── state.js        # Centralized state management and DOM registry
│   ├── ui.js           # UI operations and custom dialog components
│   ├── history.js      # Image history management
│   ├── profile-editor.js # Profile editor logic + profile operation config
│   ├── preset-editor.js # Preset editor logic + preset operation config
│   ├── config-editor.js  # Configuration editor logic
│   ├── refresh.js      # Shared data-loading / refresh helpers
│   ├── editor.js       # Shared editor operation executor
│   └── styles.css
├── profiles/           # Prompt profiles (LLM analysis prompts only)
│   └── <profile_name>/extraction_prompt.txt
└── presets/            # Generation presets (separate from profiles)
    └── <preset_name>/settings.json
```

## Core Architecture Principles

### Separation of Concerns

The backend follows a clear layered architecture:

1. **Routes** (`app/routes/`): HTTP layer - handles request/response, validation via Pydantic models
2. **Services** (`app/services/`): Business logic layer - independent of HTTP, testable with mocks
3. **Utils** (`app/utils/`): Shared utilities - file I/O, image processing, validation helpers
4. **Config** (`app/config.py`): Configuration management - in-memory mutable config with file persistence

Business logic (profile/preset loading, caches) lives in `services/`, not routes.

### Service Pattern

External integrations and business logic are encapsulated in service modules:

- **`LLMService`** (`services/llm.py`): Async `httpx` client for image analysis (tool calling), image generation, and model listing
- **`services/profile.py`**: `get_profile()` (cached extraction prompt) + `invalidate_profile_cache()`
- **`services/preset.py`**: `get_preset()` loads a preset's `settings.json`

Services are instantiated via factory functions (`create_llm_service()`) that read from the global configuration. External HTTP calls use `httpx` (async) so they don't block the event loop.

### Configuration Management

- Configuration is loaded into a mutable dict (`_config`) at import time
- Missing/partial config falls back to defaults defined in `app/config.py`
- `save_providers()` writes atomically (temp file + `os.replace`) and updates both memory and file
- Constants are defined in `app/config.py` (replaces magic numbers)
- Pydantic models provide request validation at the route layer

### Error Handling

- Routes raise `HTTPException` directly
- `@handle_api_errors` decorator (in `app/utils/validation.py`) catches non-HTTP exceptions, logs them, and returns a generic 500 JSON response
- Global exception handlers in `app/main.py` convert validation errors and unexpected exceptions to consistent JSON responses

## Core Components

### Backend Package Structure

#### Routes (`app/routes/`)

Route modules handle HTTP requests and responses:

- **`generation.py`**: `/api/analyze`, `/api/generate`, plus `/api/profiles` and `/api/presets` listing
- **`gallery.py`**: Saved image listing, serving, deletion (`/api/gallery/*`)
- **`profiles.py`**: Prompt profile CRUD (`/api/profile-editor/*`)
- **`presets.py`**: Generation preset CRUD (`/api/preset-editor/*`)
- **`config.py`**: Provider configuration (`/api/config/*`)

#### Services (`app/services/`)

- **`LLMService.analyze_image()`**: Sends image to LLM using tool calling (async)
- **`LLMService.generate_image()`**: Sends prompt + seed + width/height/upscale + preset parameters to the generation endpoint (async)
- **`LLMService.list_models()`**: Fetches available LLM models (async)
- **`profile.get_profile()`**: Loads extraction prompt with a cache
- **`preset.get_preset()`**: Loads a preset's generation parameters

#### Utils (`app/utils/`)

- **`files.py`**: `FileSetManager` generic base + `ProfileManager`/`PresetManager` subclasses
- **`image.py`**: `resize_image_for_llm()`, `encode_image_to_base64()`
- **`validation.py`**: `validate_name()`, `validate_name_or_raise()`, `validate_filename_or_raise()`, `handle_api_errors()`, `build_llm_headers()`, `validate_json()`

#### Models (`app/models.py`)

Pydantic models for API validation and responses: `ProviderConfig`, `ProfileSaveRequest`, `PresetSaveRequest`, `GalleryItem`, `AnalyzeResponse`, `GenerateResponse`, etc.

### Frontend

The frontend is a modular ES module architecture. Key modules:

1. **index.html**: Three main views (Generate, Editor, Settings) plus a Gallery view.
2. **main.js**: Entry point - navigation, event binding, generation flow, action-button wiring (keyed by `ACTION_BUTTONS` config, not array index).
3. **api.js**: API calls with unified `apiCall`/`fetchJson` error handling.
4. **state.js**: `DOM` registry, `RESOLUTIONS`, `state`, `ACTION_BUTTONS`, `generateRandomSeed()`.
5. **ui.js**: View/screen switching, notifications, custom dialog components (`showPrompt`, `showConfirm`), `createAsyncHandler`.
6. **refresh.js**: Shared `loadProfilesAndUI`/`loadPresetsAndUI`/`refreshProfilesAndUI`/`refreshPresetsAndUI` - avoids circular imports between `main.js` and the editors.
7. **editor.js**: Shared `executeOperation()` used by both profile and preset editors.
8. **profile-editor.js** / **preset-editor.js**: Editor logic + operation configs (moved out of `state.js`).
9. **config-editor.js**: Config loading/saving, LLM model refresh.

### Profiles vs. Presets

Profiles and presets are **separate concepts**:

- **Profiles** (`profiles/`) contain only `extraction_prompt.txt` - the prompt template for LLM image analysis.
- **Presets** (`presets/`) contain `settings.json` - the generation parameters that do not change per-request (e.g. `model`, `steps`, `cfg_scale`, `sampler`, `negative_prompt`, `lora_specs`).

### Generation Parameters

The generation endpoint accepts standard `prompt` and `seed` fields plus the non-standard parameters: `model`, `steps`, `cfg_scale`, `width`, `height`, `sampler` (`euler | er_sde`), `negative_prompt`, `upscale` (boolean), `qwen_vae_enhance` (boolean), `film_grain`, `sharpening`, `lora_specs` (array of `name:weight` strings). Additional custom fields in a preset are passed through as-is.

Presets configure the parameters that stay fixed across requests (e.g. `model`, `steps`, `cfg_scale`, `sampler`, `negative_prompt`, `lora_specs`); `prompt`, `seed`, `width`, `height` and `upscale` are filled in from the request. The `LLMService.generate_image()` method merges them into the payload sent to `{llm_endpoint}/images/generations`.

## Data Flow

### Image Analysis Flow

1. User uploads an image through the frontend
2. Backend receives the image and resizes it for LLM processing (max 1.5MP)
3. `LLMService.analyze_image()` sends image to LLM with the profile's extraction prompt and a tool definition
4. LLM returns a tool call with `generate_image` function containing `status`, `prompt`, `error_reason`
5. Backend returns the prompt to the frontend

### Image Generation Flow

1. User reviews/modifies the extracted prompt
2. User selects aspect ratio and optional upscaling (boolean 2x)
3. Backend loads the preset via `preset.get_preset()`
4. `LLMService.generate_image()` merges request params (prompt, seed, width, height, upscale) with the preset params and POSTs to `{llm_endpoint}/images/generations` (async `httpx`)
5. The generated image base64 is returned
6. Image is displayed in the frontend and added to history; optionally saved to the gallery

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the frontend application |
| GET | `/api/profiles` | Lists all available profiles |
| GET | `/api/presets` | Lists all available presets |
| POST | `/api/analyze` | Analyzes an uploaded image and returns a generation prompt |
| POST | `/api/generate` | Generates an image from a prompt using the OpenAI-compatible endpoint |
| GET | `/api/gallery` | Lists saved generated images |
| GET | `/api/gallery/{filename}` | Downloads a saved image |
| DELETE | `/api/gallery` | Deletes all saved images |
| DELETE | `/api/gallery/{filename}` | Deletes a saved image |
| GET | `/api/profile-editor/profile/{name}` | Gets profile content |
| POST | `/api/profile-editor/profile` | Creates or updates a profile |
| POST | `/api/profile-editor/profile/duplicate` | Duplicates a profile |
| DELETE | `/api/profile-editor/profile/{name}` | Deletes a profile |
| POST | `/api/profile-editor/profile/rename` | Renames a profile |
| GET | `/api/profile-editor/download/{name}` | Downloads a profile as ZIP |
| GET | `/api/profile-editor/download-all` | Downloads all profiles as ZIP |
| GET | `/api/preset-editor/preset/{name}` | Gets preset content |
| POST | `/api/preset-editor/preset` | Creates or updates a preset |
| POST | `/api/preset-editor/preset/duplicate` | Duplicates a preset |
| DELETE | `/api/preset-editor/preset/{name}` | Deletes a preset |
| POST | `/api/preset-editor/preset/rename` | Renames a preset |
| GET | `/api/preset-editor/download/{name}` | Downloads a preset as ZIP |
| GET | `/api/preset-editor/download-all` | Downloads all presets as ZIP |
| GET | `/api/config/providers` | Gets providers configuration |
| POST | `/api/config/providers` | Updates providers configuration (applies immediately) |
| GET | `/api/config/models` | Fetches available LLM models |

## Testing

Unit tests are located in `tests/` and use pytest:

```bash
python -m pytest tests/ -v
```

Test modules:
- `test_validation.py`: Name validation
- `test_image.py`: Image resizing and base64 encoding
- `test_profile_manager.py`: Profile CRUD operations
- `test_preset_manager.py`: Preset CRUD operations
- `test_llm.py`: LLM service tool-call parsing, image generation, and model listing (mocked `httpx`)

## Linting

Ruff is configured for linting and formatting:

```bash
ruff check .
ruff format .
```

## Key Dependencies

- **FastAPI**: Async web framework for the API
- **Uvicorn**: ASGI server for running the application
- **httpx**: Async HTTP client for calling the LLM endpoint
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

## Security Notes

This is a local/LAN toy project. **There is no authentication** on any endpoint, including the config endpoints that read/write API keys. CORS is wide open (`allow_origins=["*"]`, no credentials). If deployed beyond a trusted LAN, add authentication and restrict CORS. Filenames and profile/preset names are validated against directory-traversal patterns.

## Running in Production

For production deployment:

1. Ensure the OpenAI-compatible endpoint is running and accessible
2. Create `config.json` from `config.template.json` with production endpoints and secure API keys
3. Configure profiles and presets appropriately
4. Run the application with a production ASGI server (e.g., `uvicorn app.main:app --host 0.0.0.0 --port 8000`)
5. Add authentication for sensitive endpoints
6. Use a reverse proxy (nginx, Apache) for SSL termination and additional security
