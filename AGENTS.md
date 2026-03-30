# Project Structure and Architecture

## Overview

This project is a web application that combines LLM-based image analysis with ComfyUI image generation. It provides a REST API backend built with FastAPI and a simple frontend for user interaction.

## Directory Structure

```
imagegen/
├── app.py              # Main FastAPI application and API endpoints
├── pyproject.toml      # Project dependencies and configuration
├── .gitignore          # Git ignore rules
├── frontend/           # Static frontend files
│   ├── index.html      # Main HTML page
│   ├── app.js          # Frontend JavaScript logic
│   └── styles.css      # CSS styling
├── profiles/           # Profile configurations (created at runtime)
│   └── <profile_name>/ # Individual profile directories
│       ├── config.json      # Profile configuration
│       ├── extraction_prompt.txt  # LLM analysis prompt
│       └── workflow.json    # ComfyUI workflow definition
└── plans/              # Project planning documents
```

## Core Components

### Backend (app.py)

The backend is a FastAPI application that handles:

1. **Static File Serving**: Serves the frontend HTML, CSS, and JavaScript files
2. **Profile Management**: Loads and validates profile configurations from the profiles directory
3. **Image Processing**: Resizes images for LLM analysis using Pillow
4. **LLM Integration**: Sends images to an LLM API for analysis and prompt extraction
5. **ComfyUI Integration**: Executes workflows and retrieves generated images

### Frontend

The frontend consists of three files:

1. **index.html**: The main user interface
2. **app.js**: Handles user interactions, API calls, and UI updates
3. **styles.css**: Visual styling and layout

### Profiles

Profiles are configuration units that define:

- LLM endpoint and model settings
- API key for LLM access
- ComfyUI server endpoint
- Workflow JSON for image generation
- Extraction prompt for image analysis

Each profile is stored in its own directory under `profiles/` with three required files.

## Data Flow

1. User uploads an image through the frontend
2. Backend receives the image and resizes it for LLM processing
3. Image is sent to the LLM with the profile's extraction prompt
4. LLM returns a JSON response with a generation prompt
5. User can review/modify the prompt and generate an image
6. Backend executes the ComfyUI workflow with the prompt
7. Generated image is returned to the frontend

## Key Dependencies

- **FastAPI**: Async web framework for the API
- **Uvicorn**: ASGI server for running the application
- **Requests**: HTTP client for calling LLM and ComfyUI APIs
- **Pillow**: Image manipulation and resizing
- **python-multipart**: Handling file uploads in forms

## Environment Variables

The application reads configuration from profile files rather than environment variables. Profile configurations should be secured appropriately when deploying.

## Running in Production

For production deployment:

1. Ensure ComfyUI is running and accessible
2. Configure profiles with production endpoints and secure API keys
3. Run the application with a production ASGI server
4. Set up proper CORS policies if needed
5. Consider adding authentication for sensitive endpoints
