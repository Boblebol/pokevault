"""Contrôleur HTTP — recherche catalogue Pokémon TCG externe."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from tracker.api.dependencies import get_tcg_catalog_service
from tracker.models import TcgCardSearchResponse
from tracker.services.tcg_catalog_service import TcgCatalogService

router = APIRouter(prefix="/api/tcg", tags=["tcg"])


@router.get("/cards/search", response_model=TcgCardSearchResponse)
def search_cards(
    service: Annotated[TcgCatalogService, Depends(get_tcg_catalog_service)],
    q: str = Query(default=""),
    page_size: int = Query(default=12, ge=1, le=24),
) -> TcgCardSearchResponse:
    if not q.strip():
        return TcgCardSearchResponse()
    return service.search(q, page_size=page_size)
