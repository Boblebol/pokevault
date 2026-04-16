"""tracker.services — classeurs (délégation vers les repositories)."""

from __future__ import annotations

from unittest.mock import MagicMock

from tracker.binder_models import BinderConfigPayload, BinderPlacementsPayload
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService


def test_binder_config_service_get_delegates_to_repository() -> None:
    repo = MagicMock()
    expected = BinderConfigPayload(binders=[{"id": "x"}])
    repo.load.return_value = expected
    svc = BinderConfigService(repo)
    assert svc.get_config() is expected
    repo.load.assert_called_once_with()


def test_binder_config_service_replace_saves_and_returns_body() -> None:
    repo = MagicMock()
    body = BinderConfigPayload(binders=[{"id": "z"}])
    svc = BinderConfigService(repo)
    out = svc.replace_config(body)
    assert out is body
    repo.save.assert_called_once_with(body)


def test_binder_placements_service_get_and_replace() -> None:
    repo = MagicMock()
    payload = BinderPlacementsPayload(by_binder={"m": {"a": {"page": 1}}})
    repo.load.return_value = payload
    svc = BinderPlacementsService(repo)
    assert svc.get_placements() is payload
    assert svc.replace_placements(payload) is payload
    repo.save.assert_called_once_with(payload)


def test_workspace_list_summaries_skips_entries_without_id() -> None:
    from tracker.services.binder_workspace_service import BinderWorkspaceService

    cfg_repo = MagicMock()
    pl_repo = MagicMock()
    cfg_repo.load.return_value = BinderConfigPayload(
        binders=[
            {"name": "no-id"},
            {"id": "", "name": "empty-id"},
            {"id": "ok", "name": "Good"},
        ],
    )
    ws = BinderWorkspaceService(cfg_repo, pl_repo)
    result = ws.list_summaries()
    assert len(result) == 1
    assert result[0]["id"] == "ok"


def test_workspace_delete_nonexistent_returns_false() -> None:
    from tracker.services.binder_workspace_service import BinderWorkspaceService

    cfg_repo = MagicMock()
    pl_repo = MagicMock()
    cfg_repo.load.return_value = BinderConfigPayload(binders=[])
    pl_repo.load.return_value = BinderPlacementsPayload()
    ws = BinderWorkspaceService(cfg_repo, pl_repo)
    assert ws.delete_one("ghost") is False
