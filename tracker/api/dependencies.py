"""Injection de dépendances FastAPI."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from tracker.config import TrackerSettings, get_settings
from tracker.repository.base import (
    BinderConfigRepository,
    BinderPlacementsRepository,
    CardRepository,
    ProgressRepository,
)
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository
from tracker.repository.json_card_repository import JsonCardRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.badge_service import BadgeService
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService
from tracker.services.binder_workspace_service import BinderWorkspaceService
from tracker.services.card_service import CardService
from tracker.services.export_service import ExportService
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
) -> BinderConfigRepository:
    return JsonBinderConfigRepository(settings.binder_config_path)


def get_binder_config_service(
    repository: Annotated[BinderConfigRepository, Depends(get_binder_config_repository)],
) -> BinderConfigService:
    return BinderConfigService(repository)


def get_binder_placements_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> BinderPlacementsRepository:
    return JsonBinderPlacementsRepository(settings.binder_placements_path)


def get_binder_placements_service(
    repository: Annotated[
        BinderPlacementsRepository,
        Depends(get_binder_placements_repository),
    ],
) -> BinderPlacementsService:
    return BinderPlacementsService(repository)


def get_binder_workspace_service(
    cfg_repo: Annotated[BinderConfigRepository, Depends(get_binder_config_repository)],
    pl_repo: Annotated[BinderPlacementsRepository, Depends(get_binder_placements_repository)],
) -> BinderWorkspaceService:
    return BinderWorkspaceService(cfg_repo, pl_repo)


def get_card_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> CardRepository:
    return JsonCardRepository(settings.cards_path)


def get_card_service(
    repository: Annotated[CardRepository, Depends(get_card_repository)],
    progress_service: Annotated[ProgressService, Depends(get_progress_service)],
) -> CardService:
    return CardService(repository, progress_service)


def get_badge_service(
    progress_repo: Annotated[ProgressRepository, Depends(get_progress_repository)],
    card_repo: Annotated[CardRepository, Depends(get_card_repository)],
) -> BadgeService:
    return BadgeService(progress_repo, card_repo)


def get_export_service(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
    progress_repo: Annotated[ProgressRepository, Depends(get_progress_repository)],
    config_repo: Annotated[BinderConfigRepository, Depends(get_binder_config_repository)],
    placements_repo: Annotated[
        BinderPlacementsRepository,
        Depends(get_binder_placements_repository),
    ],
    card_repo: Annotated[CardRepository, Depends(get_card_repository)],
) -> ExportService:
    return ExportService(
        progress_repo,
        config_repo,
        placements_repo,
        card_repo,
        settings.pokedex_path,
    )
