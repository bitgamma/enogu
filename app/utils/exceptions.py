"""Custom exception classes for the application."""


class AppError(Exception):
    """Base exception for application errors."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ProfileNotFoundError(AppError):
    """Raised when a profile is not found."""

    def __init__(self, profile_name: str) -> None:
        super().__init__(f"Profile '{profile_name}' not found", 404)


class ProfileAlreadyExistsError(AppError):
    """Raised when a profile already exists."""

    def __init__(self, profile_name: str) -> None:
        super().__init__(f"Profile '{profile_name}' already exists", 400)


class InvalidProfileNameError(AppError):
    """Raised when a profile name is invalid."""

    def __init__(self) -> None:
        super().__init__("Invalid profile name", 400)


class LLMError(AppError):
    """Raised when LLM analysis fails."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"LLM analysis failed: {reason}", 400)


class LLMConnectionError(AppError):
    """Raised when LLM connection fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Failed to connect to LLM endpoint: {detail}", 502)


class ComfyUIError(AppError):
    """Raised when ComfyUI workflow fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"ComfyUI error: {detail}", 500)


class ComfyUIConnectionError(AppError):
    """Raised when ComfyUI connection fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Failed to connect to ComfyUI: {detail}", 500)


class ConfigurationError(AppError):
    """Raised when configuration is invalid."""

    def __init__(self, message: str) -> None:
        super().__init__(message, 400)
