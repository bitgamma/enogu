"""Configuration and constants for the application."""

import json
import os
import tempfile
from pathlib import Path
from typing import Any

# Paths
BASE_DIR = Path(__file__).parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
PROFILES_DIR = BASE_DIR / "profiles"
PRESETS_DIR = BASE_DIR / "presets"
OUTPUT_DIR = BASE_DIR / "output"
CONFIG_FILE = BASE_DIR / "config.json"

_DEFAULT_CONFIG: dict[str, Any] = {
    "server": {"host": "0.0.0.0", "port": 8380},
    "providers": {
        "llm_endpoint": "http://localhost:8000/api/v1",
        "llm_apikey": "",
        "llm_model": "",
    },
}


def _load_config() -> dict[str, Any]:
    """Load configuration from file, merging over defaults. Falls back to defaults."""
    defaults = json.loads(json.dumps(_DEFAULT_CONFIG))
    if not CONFIG_FILE.exists():
        return defaults
    try:
        with open(CONFIG_FILE) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        raise RuntimeError(f"Invalid or unreadable {CONFIG_FILE}: {e}") from e

    for section, values in data.items():
        if section in defaults and isinstance(defaults[section], dict):
            defaults[section].update(values if isinstance(values, dict) else {})
        else:
            defaults[section] = values
    return defaults


# Load global configuration into mutable dict
_config: dict[str, Any] = _load_config()


# LLM tool definition for image analysis
GENERATE_IMAGE_TOOL = {
    "type": "function",
    "function": {
        "name": "generate_image",
        "description": "Extract a prompt for image generation from an image. Use status 'OK' for successful analysis or 'NOK' if you cannot generate a prompt.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["OK", "NOK"],
                    "description": "Analysis status. 'OK' if successful, 'NOK' if the analysis failed",
                },
                "prompt": {
                    "type": "string",
                    "description": "The generation prompt. If status is 'OK', provide a detailed description. If status is 'NOK', provide an empty string",
                },
                "error_reason": {
                    "type": "string",
                    "description": "If status is 'NOK', explain why the analysis failed. Can be omitted if status is 'OK'",
                },
            },
            "required": ["status", "prompt"],
        },
    },
}

# Default system prompt for tool calling
DEFAULT_SYSTEM_PROMPT = (
    "You are an image analysis assistant specialized in extracting image generation prompts. "
    "Your task is to analyze the uploaded image and extract a detailed prompt for image generation. "
    "You MUST call the generate_image tool with your extracted prompt and status."
)

# Constants
MAX_LLM_IMAGE_PIXELS = 1_500_000
LLM_TIMEOUT_SECONDS = 60
IMAGE_GEN_TIMEOUT_SECONDS = 300
MAX_SEED_VALUE = (1 << 32) - 1


def get_config() -> dict[str, Any]:
    """Get the in-memory configuration dict."""
    return _config


def get_providers() -> dict[str, Any]:
    """Get the providers section of the configuration."""
    return _config.get("providers", {})


def get_server_config() -> dict[str, Any]:
    """Get the server section of the configuration."""
    return _config.get("server", {})


def save_providers(providers: dict[str, Any]) -> None:
    """Save the providers section of the configuration to file and in memory (atomic write)."""
    _config["providers"] = providers
    with tempfile.NamedTemporaryFile("w", dir=str(BASE_DIR), delete=False) as tf:
        json.dump(_config, tf, indent=4)
        temp_name = tf.name
    os.replace(temp_name, CONFIG_FILE)
