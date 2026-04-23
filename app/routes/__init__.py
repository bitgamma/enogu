"""Route modules."""

from app.routes.config import router as config_router
from app.routes.generation import router as generation_router
from app.routes.profiles import router as profiles_router

__all__ = [
    "config_router",
    "generation_router",
    "profiles_router",
]
