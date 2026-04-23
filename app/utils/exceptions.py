"""Custom exception classes for the application."""

from typing import Optional


class AppException(Exception):
    """Base exception for application errors."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ProfileNotFoundError(AppException):
    """Raised when a profile is not found."""

    def __init__(self, profile_name: str) -> None:
        super().__init__(f"Profile '{profile_name}' not found", 404)


class ProfileAlreadyExistsError(AppException):
    """Raised when a profile already exists."""

    def __init__(self, profile_name: str) -> None:
        super().__init__(f"Profile '{profile_name}' already exists", 400)


class InvalidProfileNameError(AppException):
    """Raised when a profile name is invalid."""

    def __init__(self) -> None:
        super().__init__("Invalid profile name", 400)


class LLMError(AppException):
    """Raised when LLM analysis fails."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"LLM analysis failed: {reason}", 400)


class LLMConnectionError(AppException):
    """Raised when LLM connection fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Failed to connect to LLM endpoint: {detail}", 502)


class ComfyUIError(AppException):
    """Raised when ComfyUI workflow fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"ComfyUI error: {detail}", 500)


class ComfyUIConnectionError(AppException):
    """Raised when ComfyUI connection fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Failed to connect to ComfyUI: {detail}", 500)


class ConfigurationError(AppException):
    """Raised when configuration is invalid."""

    def __init__(self, message: str) -> None:
        super().__init__(message, 400)
