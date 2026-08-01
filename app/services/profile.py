"""Profile service for loading profile configuration with caching."""

from fastapi import HTTPException

from app.config import PROFILES_DIR
from app.utils import read_file_content

_profile_cache: dict[str, dict] = {}


def get_profile(profile_name: str) -> dict:
    """Load a profile configuration by name (extraction prompt only), using a cache."""
    if profile_name in _profile_cache:
        return _profile_cache[profile_name]

    prompt_file_path = PROFILES_DIR / profile_name / "extraction_prompt.txt"
    extraction_prompt = read_file_content(prompt_file_path, strip=True)
    if extraction_prompt is None:
        raise HTTPException(status_code=404, detail="Prompt file extraction_prompt.txt not found")

    config = {"name": profile_name, "extraction_prompt": extraction_prompt}
    _profile_cache[profile_name] = config
    return config


def invalidate_profile_cache(profile_name: str | None = None) -> None:
    """Invalidate the profile cache. If profile_name is provided, only invalidate that profile."""
    if profile_name:
        _profile_cache.pop(profile_name, None)
    else:
        _profile_cache.clear()
