"""GET/PUT/DELETE /api/binder et GET /api/binder — REST par classeur."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.binder_controller import router as binder_router
from tracker.api.dependencies import (
    get_binder_config_service,
    get_binder_placements_service,
    get_binder_workspace_service,
)
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService
from tracker.services.binder_workspace_service import BinderWorkspaceService


def _app(tmp_path: Path) -> TestClient:
    cfg_path = tmp_path / "binder-config.json"
    pl_path = tmp_path / "binder-placements.json"

    def cfg_svc() -> BinderConfigService:
        return BinderConfigService(JsonBinderConfigRepository(cfg_path))

    def pl_svc() -> BinderPlacementsService:
        return BinderPlacementsService(JsonBinderPlacementsRepository(pl_path))

    def ws_svc() -> BinderWorkspaceService:
        return BinderWorkspaceService(
            JsonBinderConfigRepository(cfg_path),
            JsonBinderPlacementsRepository(pl_path),
        )

    app = FastAPI()
    app.include_router(binder_router)
    app.dependency_overrides[get_binder_config_service] = cfg_svc
    app.dependency_overrides[get_binder_placements_service] = pl_svc
    app.dependency_overrides[get_binder_workspace_service] = ws_svc
    return TestClient(app)


def test_list_binders_empty(tmp_path: Path) -> None:
    client = _app(tmp_path)
    assert client.get("/api/binder").json() == []


def test_put_get_delete_roundtrip(tmp_path: Path) -> None:
    client = _app(tmp_path)
    bid = "main-b"
    body = {
        "binder": {
            "id": bid,
            "name": "Test",
            "rows": 3,
            "cols": 3,
            "sheet_count": 10,
            "form_rule_id": "fr1",
            "organization": "national",
        },
        "form_rule": {
            "id": "fr1",
            "label": "Base",
            "include_base": True,
            "include_mega": False,
            "include_gigamax": False,
            "include_regional": True,
            "include_other_named_forms": False,
        },
        "placements": {"0001-bulb": {"page": 0, "slot": 0}},
    }
    r = client.put(f"/api/binder/{bid}", json=body)
    assert r.status_code == 200
    assert r.json()["id"] == bid
    lst = client.get("/api/binder").json()
    assert len(lst) == 1 and lst[0]["id"] == bid
    one = client.get(f"/api/binder/{bid}").json()
    assert one["placements"]["0001-bulb"]["page"] == 0
    assert client.delete(f"/api/binder/{bid}").status_code == 204
    assert client.get("/api/binder").json() == []


def test_reserved_paths_not_binder_ids(tmp_path: Path) -> None:
    client = _app(tmp_path)
    assert client.get("/api/binder/config").status_code == 200
    assert client.get("/api/binder/config-not-real").status_code == 404


def test_reserved_ids_rejected_on_delete(tmp_path: Path) -> None:
    client = _app(tmp_path)
    assert client.delete("/api/binder/config").status_code == 400
    assert client.delete("/api/binder/placements").status_code == 400


def test_delete_nonexistent_binder_returns_404(tmp_path: Path) -> None:
    client = _app(tmp_path)
    assert client.delete("/api/binder/does-not-exist").status_code == 404


def test_get_nonexistent_binder_returns_404(tmp_path: Path) -> None:
    client = _app(tmp_path)
    assert client.get("/api/binder/nope").status_code == 404
