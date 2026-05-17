"""API bundle — données de référence consolidées."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_bundle_service
from tracker.services.bundle_service import BundleService

router = APIRouter(prefix="/api/bundle", tags=["Bundle"])


@router.get("")
async def get_bundle(
    service: Annotated[BundleService, Depends(get_bundle_service)],
) -> dict[str, Any]:
    """Obtenir toutes les données de référence en un seul appel."""
    return service.get_bundle()
