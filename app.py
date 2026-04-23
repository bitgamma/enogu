"""
Image Generation Webapp Backend
Processes uploaded images through an LLM and generates new images via ComfyUI.
Supports multiple profiles for different generation configurations.

This module re-exports the FastAPI app from the new modular structure.
"""

from app.main import app

if __name__ == "__main__":
    from app.main import app
    from app.config import get_server_config
    import uvicorn

    server_config = get_server_config()
    host = server_config.get("host", "0.0.0.0")
    port = server_config.get("port", 8000)
    uvicorn.run(app, host=host, port=port)
