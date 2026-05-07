"""Injection de dépendances FastAPI."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from tracker.config import TrackerSettings, get_settings
from tracker.repository.base import (
    BinderConfigRepository,
    BinderPlacementsRepository,
    ProgressRepository,
    TrainerContactRepository,
)
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.repository.json_trainer_contact_repository import JsonTrainerContactRepository
from tracker.services.badge_battle_catalog import load_badge_battle_catalog
from tracker.services.badge_service import BadgeService
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService
from tracker.services.binder_workspace_service import BinderWorkspaceService
from tracker.services.export_service import ExportService
from tracker.services.profile_service import ProfileService
from tracker.services.progress_service import ProgressService
from tracker.services.trainer_contact_service import TrainerContactService


def get_profile_service(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> ProfileService:
    return ProfileService(
        data_root=settings.data_dir,
        registry_path=settings.profiles_registry_path,
    )


def get_progress_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
) -> ProgressRepository:
    return JsonProgressRepository(profiles.progress_path())


def get_progress_service(
    repository: Annotated[ProgressRepository, Depends(get_progress_repository)],
) -> ProgressService:
    return ProgressService(repository)


def get_binder_config_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
) -> BinderConfigRepository:
    return JsonBinderConfigRepository(profiles.binder_config_path())


def get_binder_config_service(
    repository: Annotated[BinderConfigRepository, Depends(get_binder_config_repository)],
) -> BinderConfigService:
    return BinderConfigService(repository)


def get_binder_placements_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
) -> BinderPlacementsRepository:
    return JsonBinderPlacementsRepository(profiles.binder_placements_path())


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


def get_trainer_contact_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
) -> TrainerContactRepository:
    return JsonTrainerContactRepository(profiles.trainer_contacts_path())


def get_trainer_contact_service(
    repository: Annotated[TrainerContactRepository, Depends(get_trainer_contact_repository)],
) -> TrainerContactService:
    return TrainerContactService(repository)


def get_badge_service(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
    progress_repo: Annotated[ProgressRepository, Depends(get_progress_repository)],
) -> BadgeService:
    battle_catalog = load_badge_battle_catalog(settings.data_dir / "badge-battles.json")
    return BadgeService(progress_repo, battle_catalog=battle_catalog)


def get_export_service(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
    progress_repo: Annotated[ProgressRepository, Depends(get_progress_repository)],
    config_repo: Annotated[BinderConfigRepository, Depends(get_binder_config_repository)],
    placements_repo: Annotated[
        BinderPlacementsRepository,
        Depends(get_binder_placements_repository),
    ],
) -> ExportService:
    return ExportService(
        progress_repo,
        config_repo,
        placements_repo,
        settings.pokedex_path,
    )
