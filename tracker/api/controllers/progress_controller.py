"""Contrôleur HTTP — progression collection."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_progress_service
from tracker.models import CollectionProgress, ProgressPatch, ProgressPutBody, ProgressSaveResponse
from tracker.services.progress_service import ProgressService

router = APIRouter(prefix="/api", tags=["progress"])


@router.get("/progress", response_model=CollectionProgress)
def get_progress(
    service: Annotated[ProgressService, Depends(get_progress_service)],
) -> CollectionProgress:
    return service.get_progress()


@router.put("/progress", response_model=ProgressSaveResponse)
def put_progress(
    body: ProgressPutBody,
    service: Annotated[ProgressService, Depends(get_progress_service)],
) -> ProgressSaveResponse:
    return service.replace_caught(body)


@router.patch("/progress", response_model=ProgressSaveResponse)
def patch_progress(
    body: ProgressPatch,
    service: Annotated[ProgressService, Depends(get_progress_service)],
) -> ProgressSaveResponse:
    return service.patch_caught(body)
