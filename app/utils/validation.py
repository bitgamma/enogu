"""Validation utilities."""

import json
import logging
import re
from collections.abc import Callable
from functools import wraps
from typing import Any

from fastapi import HTTPException

from app.config import RESOLUTION_DIVISOR_KEY, TARGET_MEGAPIXELS_KEY

logger = logging.getLogger(__name__)

# Directory/entity names may contain alphanumerics, dash and underscore (no traversal).
NAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
# Filenames additionally allow a dot (extension).
FILENAME_RE = re.compile(r"^[a-zA-Z0-9._-]+$")


def validate_name(name: str) -> bool:
    """Validate a directory/entity name to prevent directory traversal attacks."""
    return bool(NAME_RE.match(name or ""))


def validate_name_or_raise(name: str | None, field: str = "name") -> None:
    """Validate a name and raise HTTPException if invalid."""
    if not name or not validate_name(name):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")


def validate_filename_or_raise(filename: str | None, field: str = "filename") -> None:
    """Validate a filename and raise HTTPException if invalid."""
    if not filename or not FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")


def handle_api_errors(func: Callable) -> Callable:
    """Decorator that catches non-HTTP exceptions and converts them to 500 errors."""

    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception:
            logger.exception("Unhandled error in API handler")
            raise HTTPException(status_code=500, detail="Internal server error") from None

    return wrapper


def build_llm_headers(apikey: str, content_type: str = "application/json") -> dict:
    """Build HTTP headers for LLM API requests with optional Bearer authentication."""
    headers = {"Content-Type": content_type}
    if apikey:
        headers["Authorization"] = f"Bearer {apikey}"
    return headers


def coerce_preset_resolution_fields(settings: Any) -> tuple[float | None, int | None]:
    """Extract `(target_megapixels, resolution_divisor)` from a preset's settings.

    Purely a type-safety net for the list endpoint: values the frontend cannot
    use (missing, wrong type, non-positive) are reported as null so the client
    falls back to its own defaults. No range is enforced here - the preset is
    free to ask for any resolution.
    """
    if not isinstance(settings, dict):
        return None, None

    def _is_number(value: Any) -> bool:
        # bool is an int subclass in Python, so exclude it explicitly.
        return isinstance(value, int | float) and not isinstance(value, bool)

    megapixels = settings.get(TARGET_MEGAPIXELS_KEY)
    target = float(megapixels) if _is_number(megapixels) and megapixels > 0 else None

    divisor = settings.get(RESOLUTION_DIVISOR_KEY)
    aligned = int(divisor) if _is_number(divisor) and int(divisor) >= 1 else None

    return target, aligned


def validate_json(value: Any, field_name: str = "field") -> dict | None:
    """Validate and parse JSON string or return dict as-is. Returns None if value is None."""
    if value is None:
        return None
    try:
        if isinstance(value, str):
            return json.loads(value)
        return value  # Already a dict
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} JSON") from None
