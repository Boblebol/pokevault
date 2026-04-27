"""Contrôleur HTTP — liste de recherches Pokédex."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_hunt_service
from tracker.models import HuntList, HuntPatch
from tracker.services.hunt_service import HuntService

router = APIRouter(prefix="/api", tags=["hunts"])


@router.get("/hunts", response_model=HuntList)
def get_hunts(
    service: Annotated[HuntService, Depends(get_hunt_service)],
) -> HuntList:
    return service.list_hunts()


@router.patch("/hunts/{slug}", response_model=HuntList)
def patch_hunt(
    slug: str,
    body: HuntPatch,
    service: Annotated[HuntService, Depends(get_hunt_service)],
) -> HuntList:
    return service.patch_hunt(slug, body)

