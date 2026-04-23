"""Pydantic models for API request/response validation."""


from pydantic import BaseModel, Field


class ProviderConfig(BaseModel):
    """Configuration for external services."""

    comfyui_endpoint: str = Field(..., description="ComfyUI server endpoint")
    llm_endpoint: str = Field(..., description="LLM API endpoint")
    llm_apikey: str = Field(..., description="API key for LLM access")
    llm_model: str = Field(..., description="LLM model name")
    system_prompt: str | None = Field(
        None, description="Custom system prompt for tool calling"
    )


class ProfileSaveRequest(BaseModel):
    """Request body for saving a profile."""

    name: str = Field(..., description="Profile name")
    extraction_prompt: str | None = Field(
        None, description="Extraction prompt content"
    )
    workflow: str | None = Field(None, description="Workflow JSON content or object")
    mappings: str | None = Field(None, description="Mappings JSON content or object")


class ProfileDuplicateRequest(BaseModel):
    """Request body for duplicating a profile."""

    source_name: str = Field(..., description="Source profile name")
    new_name: str = Field(..., description="New profile name")


class ProfileRenameRequest(BaseModel):
    """Request body for renaming a profile."""

    old_name: str = Field(..., description="Current profile name")
    new_name: str = Field(..., description="New profile name")


class AnalyzeResponse(BaseModel):
    """Response from image analysis."""

    success: bool = True
    prompt: str


class GenerateResponse(BaseModel):
    """Response from image generation."""

    success: bool = True
    image: str


class ModelListResponse(BaseModel):
    """Response containing available LLM models."""

    models: list[str]


class ProfileItem(BaseModel):
    """Single profile item in list response."""

    name: str


class ProfileListResponse(BaseModel):
    """Response containing list of available profiles."""

    profiles: list[ProfileItem]


class ProfileContent(BaseModel):
    """Full profile content for editor."""

    name: str
    extraction_prompt: str | None = None
    workflow: str | None = None
    mappings: str | None = None


class ProfileSaveResponse(BaseModel):
    """Response from profile save operation."""

    status: str = "success"
    message: str


class ProfileDeleteResponse(BaseModel):
    """Response from profile delete operation."""

    status: str = "success"
    message: str


class ProfileDuplicateResponse(BaseModel):
    """Response from profile duplicate operation."""

    status: str = "success"
    message: str


class ProfileRenameResponse(BaseModel):
    """Response from profile rename operation."""

    status: str = "success"
    message: str


class ConfigResponse(BaseModel):
    """Response containing providers configuration."""

    providers: dict


class ProviderSaveResponse(BaseModel):
    """Response from saving providers configuration."""

    success: bool = True
    providers: dict
