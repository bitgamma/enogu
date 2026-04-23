"""Configuration routes."""

from fastapi import APIRouter, HTTPException

from app.config import get_providers, save_providers
from app.models import ConfigResponse, ModelListResponse, ProviderSaveResponse
from app.services.llm import create_llm_service

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/providers", response_model=ConfigResponse)
async def get_config_providers() -> ConfigResponse:
    """Get the providers section of the configuration."""
    return ConfigResponse(providers=get_providers())


@router.post("/providers", response_model=ProviderSaveResponse)
async def save_config_providers(request: dict) -> ProviderSaveResponse:
    """Save/update the providers section of the configuration. Applies immediately and persists to file."""
    providers = request.get("providers", {})

    # Validate required fields
    required_fields = ["comfyui_endpoint", "llm_endpoint", "llm_apikey", "llm_model"]
    for field in required_fields:
        if field not in providers:
            raise HTTPException(
                status_code=400, detail=f"Missing required field: {field}"
            )

    # Save to file (also updates in-memory via save_providers)
    save_providers(providers)

    return ProviderSaveResponse(providers=providers)


@router.get("/models", response_model=ModelListResponse)
async def get_llm_models() -> ModelListResponse:
    """Fetch available LLM models from the configured LLM endpoint."""
    providers = get_providers()
    llm_endpoint = providers.get("llm_endpoint", "")

    if not llm_endpoint:
        raise HTTPException(status_code=400, detail="LLM endpoint not configured")

    llm_service = create_llm_service()
    models = llm_service.list_models()
    return ModelListResponse(models=models)
