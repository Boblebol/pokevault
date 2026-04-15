"""API v2 classeurs — deux fichiers JSON indépendants."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from tracker.api.dependencies import (
    get_binder_config_service,
    get_binder_placements_service,
    get_binder_workspace_service,
)
from tracker.binder_models import BinderConfigPayload, BinderPlacementsPayload
from tracker.models import BinderRestPutBody
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService
from tracker.services.binder_workspace_service import BinderWorkspaceService

router = APIRouter(prefix="/api/binder", tags=["binder"])

_RESERVED_IDS = frozenset({"config", "placements"})


def _reject_reserved(binder_id: str) -> None:
    if binder_id in _RESERVED_IDS:
        raise HTTPException(status_code=400, detail=f"'{binder_id}' is a reserved endpoint")


@router.get("/config", response_model=BinderConfigPayload)
def get_binder_config(
    service: Annotated[BinderConfigService, Depends(get_binder_config_service)],
) -> BinderConfigPayload:
    return service.get_config()


@router.put("/config", response_model=BinderConfigPayload)
def put_binder_config(
    body: BinderConfigPayload,
    service: Annotated[BinderConfigService, Depends(get_binder_config_service)],
) -> BinderConfigPayload:
    return service.replace_config(body)


@router.get("/placements", response_model=BinderPlacementsPayload)
def get_binder_placements(
    service: Annotated[BinderPlacementsService, Depends(get_binder_placements_service)],
) -> BinderPlacementsPayload:
    return service.get_placements()


@router.put("/placements", response_model=BinderPlacementsPayload)
def put_binder_placements(
    body: BinderPlacementsPayload,
    service: Annotated[BinderPlacementsService, Depends(get_binder_placements_service)],
) -> BinderPlacementsPayload:
    return service.replace_placements(body)


@router.get("", response_model=list[dict[str, Any]])
def list_binders(
    workspace: Annotated[BinderWorkspaceService, Depends(get_binder_workspace_service)],
) -> list[dict[str, Any]]:
    return workspace.list_summaries()


@router.get("/{binder_id}", response_model=dict[str, Any])
def get_binder_detail(
    binder_id: str,
    workspace: Annotated[BinderWorkspaceService, Depends(get_binder_workspace_service)],
) -> dict[str, Any]:
    _reject_reserved(binder_id)
    data = workspace.get_one(binder_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Binder not found")
    return data


@router.put("/{binder_id}", response_model=dict[str, Any])
def put_binder_detail(
    binder_id: str,
    body: BinderRestPutBody,
    workspace: Annotated[BinderWorkspaceService, Depends(get_binder_workspace_service)],
) -> dict[str, Any]:
    _reject_reserved(binder_id)
    workspace.upsert_with_rules(binder_id, body.binder, body.form_rule, body.placements)
    data = workspace.get_one(binder_id)
    if data is None:
        raise HTTPException(status_code=500, detail="Upsert failed")
    return data


@router.delete("/{binder_id}", status_code=204)
def delete_binder_detail(
    binder_id: str,
    workspace: Annotated[BinderWorkspaceService, Depends(get_binder_workspace_service)],
) -> None:
    _reject_reserved(binder_id)
    if not workspace.delete_one(binder_id):
        raise HTTPException(status_code=404, detail="Binder not found")
