"""API — collection export and import."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_export_service
from tracker.models import ExportPayload, ImportPayload, ImportResponse
from tracker.services.export_service import ExportService

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/export", response_model=ExportPayload)
def export_collection(
    service: Annotated[ExportService, Depends(get_export_service)],
) -> ExportPayload:
    return service.export_all()


@router.post("/import", response_model=ImportResponse)
def import_collection(
    body: ImportPayload,
    service: Annotated[ExportService, Depends(get_export_service)],
) -> ImportResponse:
    return service.import_all(body)
