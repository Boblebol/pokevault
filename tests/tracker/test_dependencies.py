"""tracker.api.dependencies — appels directs (hors requête HTTP)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from tracker.api.dependencies import (
    get_badge_service,
    get_binder_config_repository,
    get_binder_config_service,
    get_binder_placements_repository,
    get_binder_placements_service,
    get_binder_workspace_service,
    get_export_service,
    get_profile_service,
    get_progress_repository,
    get_progress_service,
    get_trainer_contact_repository,
    get_trainer_contact_service,
)
from tracker.config import TrackerSettings
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.repository.json_trainer_contact_repository import JsonTrainerContactRepository
from tracker.services.badge_service import BadgeService
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService
from tracker.services.binder_workspace_service import BinderWorkspaceService
from tracker.services.export_service import ExportService
from tracker.services.profile_service import ProfileService
from tracker.services.progress_service import ProgressService
from tracker.services.trainer_contact_service import TrainerContactService


def _profiles(settings: TrackerSettings) -> ProfileService:
    return get_profile_service(settings=settings)


def test_get_profile_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    svc = get_profile_service(settings=settings)
    assert isinstance(svc, ProfileService)


def test_get_progress_repository_and_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    repo = get_progress_repository(settings=settings, profiles=_profiles(settings))
    assert isinstance(repo, JsonProgressRepository)
    svc = get_progress_service(repository=repo)
    assert isinstance(svc, ProgressService)


def test_get_binder_repositories_and_services(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    cfg_repo = get_binder_config_repository(
        settings=settings, profiles=_profiles(settings)
    )
    assert isinstance(cfg_repo, JsonBinderConfigRepository)
    cfg_svc = get_binder_config_service(repository=cfg_repo)
    assert isinstance(cfg_svc, BinderConfigService)
    pl_repo = get_binder_placements_repository(
        settings=settings, profiles=_profiles(settings)
    )
    assert isinstance(pl_repo, JsonBinderPlacementsRepository)
    pl_svc = get_binder_placements_service(repository=pl_repo)
    assert isinstance(pl_svc, BinderPlacementsService)


def test_get_binder_workspace_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    cfg_repo = get_binder_config_repository(
        settings=settings, profiles=_profiles(settings)
    )
    pl_repo = get_binder_placements_repository(
        settings=settings, profiles=_profiles(settings)
    )
    ws = get_binder_workspace_service(cfg_repo=cfg_repo, pl_repo=pl_repo)
    assert isinstance(ws, BinderWorkspaceService)


def test_get_export_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    progress_repo = get_progress_repository(
        settings=settings, profiles=_profiles(settings)
    )
    cfg_repo = get_binder_config_repository(
        settings=settings, profiles=_profiles(settings)
    )
    pl_repo = get_binder_placements_repository(
        settings=settings, profiles=_profiles(settings)
    )
    svc = get_export_service(
        settings=settings,
        progress_repo=progress_repo,
        config_repo=cfg_repo,
        placements_repo=pl_repo,
    )
    assert isinstance(svc, ExportService)


def test_get_trainer_contact_repository_and_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    repo = get_trainer_contact_repository(settings=settings, profiles=_profiles(settings))
    assert isinstance(repo, JsonTrainerContactRepository)
    svc = get_trainer_contact_service(repository=repo)
    assert isinstance(svc, TrainerContactService)


def test_get_badge_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    progress_repo = get_progress_repository(
        settings=settings, profiles=_profiles(settings)
    )
    svc = get_badge_service(settings=settings, progress_repo=progress_repo)
    assert isinstance(svc, BadgeService)


def test_get_badge_service_loads_battle_catalog_from_settings_data_dir(
    tmp_path: Path,
    brock_battle_catalog_data: dict[str, Any],
) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    settings.data_dir.mkdir(parents=True)
    (settings.data_dir / "badge-battles.json").write_text(
        json.dumps(brock_battle_catalog_data, ensure_ascii=False),
        encoding="utf-8",
    )
    progress_repo = get_progress_repository(
        settings=settings, profiles=_profiles(settings)
    )

    service = get_badge_service(settings=settings, progress_repo=progress_repo)

    by_id = {badge.id: badge for badge in service.state().catalog}
    assert by_id["kanto_brock"].battle is not None
    assert by_id["kanto_brock"].battle.trainer.name.en == "Brock"
    assert by_id["first_catch"].battle is None
