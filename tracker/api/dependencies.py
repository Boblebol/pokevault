"""Injection de dépendances FastAPI."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from tracker.config import TrackerSettings, get_settings
from tracker.repository.base import ProgressRepository
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService
from tracker.services.binder_workspace_service import BinderWorkspaceService
from tracker.services.progress_service import ProgressService

def get_progress_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> ProgressRepository:
    return JsonProgressRepository(settings.progress_path)


def get_progress_service(
    repository: Annotated[ProgressRepository, Depends(get_progress_repository)],
) -> ProgressService:
    return ProgressService(repository)


def get_binder_config_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> JsonBinderConfigRepository:
    return JsonBinderConfigRepository(settings.binder_config_path)


def get_binder_config_service(
    repository: Annotated[JsonBinderConfigRepository, Depends(get_binder_config_repository)],
) -> BinderConfigService:
    return BinderConfigService(repository)


def get_binder_placements_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> JsonBinderPlacementsRepository:
    return JsonBinderPlacementsRepository(settings.binder_placements_path)


def get_binder_placements_service(
    repository: Annotated[
        JsonBinderPlacementsRepository,
        Depends(get_binder_placements_repository),
    ],
) -> BinderPlacementsService:
    return BinderPlacementsService(repository)


def get_binder_workspace_service(
    cfg_repo: Annotated[JsonBinderConfigRepository, Depends(get_binder_config_repository)],
    pl_repo: Annotated[JsonBinderPlacementsRepository, Depends(get_binder_placements_repository)],
) -> BinderWorkspaceService:
    return BinderWorkspaceService(cfg_repo, pl_repo)
