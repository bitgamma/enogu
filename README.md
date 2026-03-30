# Image Generation Webapp

A web application that processes uploaded images through an LLM for analysis and generates new images via ComfyUI integration. The application supports multiple profiles for different generation configurations.

## Features

- Image upload and analysis using LLM
- Automatic prompt extraction from uploaded images
- Image generation via ComfyUI workflows
- Multiple profile support for different configurations
- Custom resolution support for generated images
- CORS-enabled API for flexible frontend integration

## Prerequisites

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) package manager (recommended)
- ComfyUI server running with appropriate workflows
- LLM API access (configured per profile)

## Installation

Using `uv` (recommended):

```bash
uv sync
```

This will create a virtual environment and install all dependencies defined in `pyproject.toml`.

## Configuration

The application uses profile-based configuration stored in the `profiles/` directory. Each profile should contain:

- `config.json` - Profile configuration including LLM settings and ComfyUI endpoint
- `extraction_prompt.txt` - Prompt template for image analysis
- `workflow.json` - ComfyUI workflow definition

## Running the Application

```bash
uv run python app.py
```

The server will start on `http://localhost:8000`.

## API Endpoints

- `GET /` - Serves the frontend application
- `GET /api/profiles` - Lists all available profiles
- `POST /api/analyze` - Analyzes an uploaded image and returns a generation prompt
- `POST /api/generate` - Generates an image from a prompt using ComfyUI

## Dependencies

- FastAPI - Web framework
- Uvicorn - ASGI server
- Requests - HTTP client
- Pillow - Image processing
- python-multipart - Form data handling

## License

MIT
