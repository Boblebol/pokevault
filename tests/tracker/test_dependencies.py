"""tracker.api.dependencies — appels directs (hors requête HTTP)."""

from __future__ import annotations

from pathlib import Path

from tracker.api.dependencies import (
    get_badge_service,
    get_binder_config_repository,
    get_binder_config_service,
    get_binder_placements_repository,
    get_binder_placements_service,
    get_binder_workspace_service,
    get_card_repository,
    get_card_service,
    get_export_service,
    get_hunt_repository,
    get_hunt_service,
    get_profile_service,
    get_progress_repository,
    get_progress_service,
)
from tracker.config import TrackerSettings
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository
from tracker.repository.json_card_repository import JsonCardRepository
from tracker.repository.json_hunt_repository import JsonHuntRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.badge_service import BadgeService
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService
from tracker.services.binder_workspace_service import BinderWorkspaceService
from tracker.services.card_service import CardService
from tracker.services.export_service import ExportService
from tracker.services.hunt_service import HuntService
from tracker.services.profile_service import ProfileService
from tracker.services.progress_service import ProgressService


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
    card_repo = get_card_repository(
        settings=settings, profiles=_profiles(settings)
    )
    hunt_repo = get_hunt_repository(
        settings=settings, profiles=_profiles(settings)
    )
    svc = get_export_service(
        settings=settings,
        progress_repo=progress_repo,
        config_repo=cfg_repo,
        placements_repo=pl_repo,
        card_repo=card_repo,
        hunt_repo=hunt_repo,
    )
    assert isinstance(svc, ExportService)


def test_get_hunt_repository_and_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    repo = get_hunt_repository(settings=settings, profiles=_profiles(settings))
    assert isinstance(repo, JsonHuntRepository)
    svc = get_hunt_service(repository=repo)
    assert isinstance(svc, HuntService)


def test_get_card_repository_and_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    repo = get_card_repository(settings=settings, profiles=_profiles(settings))
    assert isinstance(repo, JsonCardRepository)
    progress_svc = get_progress_service(
        repository=get_progress_repository(
            settings=settings, profiles=_profiles(settings)
        ),
    )
    svc = get_card_service(repository=repo, progress_service=progress_svc)
    assert isinstance(svc, CardService)


def test_get_badge_service(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    progress_repo = get_progress_repository(
        settings=settings, profiles=_profiles(settings)
    )
    card_repo = get_card_repository(
        settings=settings, profiles=_profiles(settings)
    )
    svc = get_badge_service(progress_repo=progress_repo, card_repo=card_repo)
    assert isinstance(svc, BadgeService)
