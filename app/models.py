"""Pydantic models for API request/response validation."""

from pydantic import BaseModel, Field


class ProviderConfig(BaseModel):
    """Configuration for external services."""

    llm_endpoint: str = Field(..., description="OpenAI-compatible API endpoint")
    llm_apikey: str = Field(..., description="API key for LLM access")
    llm_model: str = Field(..., description="LLM model name")
    system_prompt: str | None = Field(None, description="Custom system prompt for tool calling")


class ProfileSaveRequest(BaseModel):
    """Request body for saving a profile."""

    name: str = Field(..., description="Profile name")
    extraction_prompt: str | None = Field(None, description="Extraction prompt content")


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


# ---- Preset models ----


class PresetSaveRequest(BaseModel):
    """Request body for saving a preset."""

    name: str = Field(..., description="Preset name")
    settings: str | None = Field(None, description="Settings JSON content or object")


class PresetDuplicateRequest(BaseModel):
    """Request body for duplicating a preset."""

    source_name: str = Field(..., description="Source preset name")
    new_name: str = Field(..., description="New preset name")


class PresetRenameRequest(BaseModel):
    """Request body for renaming a preset."""

    old_name: str = Field(..., description="Current preset name")
    new_name: str = Field(..., description="New preset name")


class PresetItem(BaseModel):
    """Single preset item in list response."""

    name: str


class PresetListResponse(BaseModel):
    """Response containing list of available presets."""

    presets: list[PresetItem]


class PresetContent(BaseModel):
    """Full preset content for editor."""

    name: str
    settings: str | None = None


class PresetSaveResponse(BaseModel):
    """Response from preset save operation."""

    status: str = "success"
    message: str


class PresetDeleteResponse(BaseModel):
    """Response from preset delete operation."""

    status: str = "success"
    message: str


class PresetDuplicateResponse(BaseModel):
    """Response from preset duplicate operation."""

    status: str = "success"
    message: str


class PresetRenameResponse(BaseModel):
    """Response from preset rename operation."""

    status: str = "success"
    message: str


class ConfigResponse(BaseModel):
    """Response containing providers configuration."""

    providers: dict


class ProviderSaveResponse(BaseModel):
    """Response from saving providers configuration."""

    success: bool = True
    providers: dict


# ---- Gallery models ----


class GalleryItem(BaseModel):
    """Single saved image in the gallery."""

    filename: str
    size: int
    created_at: float


class GalleryListResponse(BaseModel):
    """Response containing list of saved images."""

    images: list[GalleryItem]


class GallerySaveResponse(BaseModel):
    """Response from saving an image to the gallery."""

    filename: str
