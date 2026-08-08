"""Preset service for loading image generation presets."""

from app.config import PRESETS_DIR
from app.utils import ensure_file_exists, read_file_content


def get_preset(preset_name: str) -> dict:
    """Load a preset's settings.json as a dict of generation parameters.

    Presets configure the generation parameters that do not change per-request
    (e.g. steps, cfg_scale, sampler, negative_prompt, lora_specs). Per-request
    parameters (prompt, seed, width, height, upscale) are filled by the caller.
    """
    settings_path = PRESETS_DIR / preset_name / "settings.json"
    ensure_file_exists(settings_path, f"Preset '{preset_name}' not found")
    settings = read_file_content(settings_path, as_json=True)
    if not isinstance(settings, dict):
        settings = {}
    return settings
