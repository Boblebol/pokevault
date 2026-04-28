"""tracker.app — factory FastAPI et montages."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tracker.api.dependencies import (
    get_binder_config_service,
    get_binder_placements_service,
    get_binder_workspace_service,
    get_progress_repository,
    get_progress_service,
)
from tracker.app import app as default_app
from tracker.app import create_app
from tracker.config import TrackerSettings, get_settings
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService
from tracker.services.binder_workspace_service import BinderWorkspaceService
from tracker.services.progress_service import ProgressService
from tracker.version import APP_VERSION


def _minimal_layout(root: Path) -> None:
    web = root / "web"
    web.mkdir()
    (web / "index.html").write_text("<!DOCTYPE html><html></html>", encoding="utf-8")
    data = root / "data"
    data.mkdir()
    (data / "hello.txt").write_text("hi", encoding="utf-8")


def test_create_app_serves_static_and_api(tmp_path: Path) -> None:
    _minimal_layout(tmp_path)
    settings = TrackerSettings(repo_root=tmp_path)
    application = create_app(settings)
    application.dependency_overrides[get_settings] = lambda: settings
    application.dependency_overrides[get_progress_repository] = lambda: JsonProgressRepository(
        settings.progress_path,
    )
    application.dependency_overrides[get_progress_service] = lambda: ProgressService(
        JsonProgressRepository(settings.progress_path),
    )
    application.dependency_overrides[get_binder_config_service] = lambda: BinderConfigService(
        JsonBinderConfigRepository(settings.binder_config_path),
    )

    def _binder_placements() -> BinderPlacementsService:
        return BinderPlacementsService(
            JsonBinderPlacementsRepository(settings.binder_placements_path),
        )

    def _binder_workspace() -> BinderWorkspaceService:
        return BinderWorkspaceService(
            JsonBinderConfigRepository(settings.binder_config_path),
            JsonBinderPlacementsRepository(settings.binder_placements_path),
        )

    application.dependency_overrides[get_binder_placements_service] = _binder_placements
    application.dependency_overrides[get_binder_workspace_service] = _binder_workspace
    (tmp_path / "data" / "pokedex.json").write_text(
        '{"meta":{"total":0},"pokemon":[]}', encoding="utf-8"
    )
    client = TestClient(application)
    assert client.get("/api/progress").status_code == 200
    assert client.get("/api/progress").json() == {
        "version": 1,
        "caught": {},
        "statuses": {},
        "notes": {},
        "badges_unlocked": [],
    }
    assert client.get("/api/binder/config").status_code == 200
    assert client.get("/api/binder/config").json()["version"] == 1
    assert client.get("/api/binder/placements").status_code == 200
    assert client.get("/api/binder/placements").json() == {"version": 1, "by_binder": {}}
    assert client.get("/api/binder").json() == []
    r_dex = client.get("/data/pokedex.json")
    assert r_dex.status_code == 200
    assert "max-age=86400" in r_dex.headers.get("cache-control", "").lower()
    assert client.get("/data/hello.txt").status_code == 200
    assert client.get("/data/hello.txt").text == "hi"
    assert client.get("/").status_code == 200


def test_create_app_web_dir_missing(tmp_path: Path) -> None:
    settings = TrackerSettings(repo_root=tmp_path)
    with pytest.raises(RuntimeError, match="web introuvable"):
        create_app(settings)


def test_pokedex_json_absent_returns_404(tmp_path: Path) -> None:
    _minimal_layout(tmp_path)
    (tmp_path / "data" / "pokedex.json").unlink(missing_ok=True)
    settings = TrackerSettings(repo_root=tmp_path)
    application = create_app(settings)
    client = TestClient(application)
    assert client.get("/data/pokedex.json").status_code == 404


def test_default_app_module_loads() -> None:
    assert default_app.title == "pokevault"
    assert default_app.version == APP_VERSION
