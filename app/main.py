"""Main FastAPI application entry point."""

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_DIR, get_server_config
from app.routes import config_router, gallery_router, generation_router, profiles_router, workflows_router

app = FastAPI(title="Image Generation Webapp")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle FastAPI validation errors."""
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc.errors())},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# CORS configuration - LAN usage, allow all origins without credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")


# Serve index.html at root
@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    """Serve the frontend HTML."""
    with open(FRONTEND_DIR / "index.html") as f:
        return HTMLResponse(content=f.read())


# Register routers
app.include_router(generation_router)
app.include_router(gallery_router)
app.include_router(profiles_router)
app.include_router(workflows_router)
app.include_router(config_router)


if __name__ == "__main__":
    server_config = get_server_config()
    host = server_config.get("host", "0.0.0.0")
    port = server_config.get("port", 8000)
    uvicorn.run(app, host=host, port=port)
