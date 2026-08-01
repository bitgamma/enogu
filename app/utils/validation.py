"""Validation utilities and parameter mapping handlers."""

import copy
import json
import logging
import re
from collections.abc import Callable
from functools import wraps
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Directory/entity names may contain alphanumerics, dash and underscore (no traversal).
NAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
# Filenames additionally allow a dot (extension).
FILENAME_RE = re.compile(r"^[a-zA-Z0-9._-]+$")

# Parameter mapping handlers - maps param names to their input keys and values
PARAM_HANDLERS = {
    "prompt": ("text", lambda **kw: kw["prompt"]),
    "seed": ("seed", lambda **kw: kw["seed"]),
    "resolution": None,  # Special case: sets both width and height
    "upscaler_switch": ("switch", lambda **kw: kw["upscale_switch"]),
    "upscale_resolution": ("value", lambda **kw: kw["upscale_resolution"]),
}


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


def apply_mappings(
    workflow: dict,
    mappings: dict,
    prompt: str,
    width: int,
    height: int,
    seed: int,
    upscale_switch: bool,
    upscale_resolution: int,
) -> dict:
    """
    Apply parameter mappings to the workflow.

    Mappings format: {"param_name": "node_id"}
    The node_id is used directly as a key in the workflow to find the node to replace.
    """
    workflow = copy.deepcopy(workflow)
    kwargs = {
        "prompt": prompt,
        "seed": seed,
        "width": width,
        "height": height,
        "upscale_switch": upscale_switch,
        "upscale_resolution": upscale_resolution,
    }

    for param_name, node_id in mappings.items():
        if node_id not in workflow or param_name not in PARAM_HANDLERS:
            continue

        node = workflow[node_id]
        node_inputs = node.get("inputs", {})

        if param_name == "resolution":
            if "width" in node_inputs:
                node_inputs["width"] = width
            if "height" in node_inputs:
                node_inputs["height"] = height
        else:
            input_key, value_fn = PARAM_HANDLERS[param_name]
            if input_key in node_inputs:
                node_inputs[input_key] = value_fn(**kwargs)

    return workflow


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
