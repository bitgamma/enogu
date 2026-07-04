"""Utility modules."""

from app.utils.exceptions import (
    AppError,
    ComfyUIConnectionError,
    ComfyUIError,
    ConfigurationError,
    InvalidProfileNameError,
    LLMConnectionError,
    LLMError,
    ProfileAlreadyExistsError,
    ProfileNotFoundError,
)
from app.utils.files import ProfileManager, WorkflowManager, ensure_file_exists, read_file_content
from app.utils.image import encode_image_to_base64, resize_image_for_llm
from app.utils.validation import (
    PARAM_HANDLERS,
    apply_mappings,
    build_llm_headers,
    extract_model_names,
    handle_api_errors,
    require_valid_profile_name,
    success_response,
    validate_json,
    validate_profile_name,
    validate_profile_name_or_raise,
)

__all__ = [
    "AppError",
    "ComfyUIConnectionError",
    "ComfyUIError",
    "ConfigurationError",
    "InvalidProfileNameError",
    "LLMConnectionError",
    "LLMError",
    "PARAM_HANDLERS",
    "ProfileAlreadyExistsError",
    "ProfileManager",
    "ProfileNotFoundError",
    "WorkflowManager",
    "apply_mappings",
    "build_llm_headers",
    "encode_image_to_base64",
    "ensure_file_exists",
    "extract_model_names",
    "handle_api_errors",
    "read_file_content",
    "resize_image_for_llm",
    "require_valid_profile_name",
    "success_response",
    "validate_json",
    "validate_profile_name",
    "validate_profile_name_or_raise",
]
