"""Route modules."""

from app.routes.config import router as config_router
from app.routes.gallery import router as gallery_router
from app.routes.generation import router as generation_router
from app.routes.presets import router as presets_router
from app.routes.profiles import router as profiles_router

__all__ = [
    "config_router",
    "generation_router",
    "gallery_router",
    "presets_router",
    "profiles_router",
]
