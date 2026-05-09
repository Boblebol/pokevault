"""API — local data maintenance."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_data_maintenance_service
from tracker.models import DataMaintenanceActionResponse, DataMaintenanceStatus
from tracker.services.data_maintenance_service import DataMaintenanceService

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/status", response_model=DataMaintenanceStatus)
def data_status(
    service: Annotated[DataMaintenanceService, Depends(get_data_maintenance_service)],
) -> DataMaintenanceStatus:
    return service.status()


@router.post("/refresh", response_model=DataMaintenanceActionResponse)
def refresh_reference_data(
    service: Annotated[DataMaintenanceService, Depends(get_data_maintenance_service)],
) -> DataMaintenanceActionResponse:
    return service.refresh_reference_data()


@router.post("/reset-local", response_model=DataMaintenanceActionResponse)
def reset_local_data(
    service: Annotated[DataMaintenanceService, Depends(get_data_maintenance_service)],
) -> DataMaintenanceActionResponse:
    return service.reset_local_data()
