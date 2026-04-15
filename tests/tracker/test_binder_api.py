"""API v2 classeurs — config et placements (fichiers séparés)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.binder_controller import router as binder_router
from tracker.api.dependencies import get_binder_config_service, get_binder_placements_service
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository
from tracker.services.binder_config_service import BinderConfigService
from tracker.services.binder_placements_service import BinderPlacementsService


def _app(tmp_path: Path) -> TestClient:
    cfg_path = tmp_path / "binder-config.json"
    pl_path = tmp_path / "binder-placements.json"

    def cfg_svc() -> BinderConfigService:
        return BinderConfigService(JsonBinderConfigRepository(cfg_path))

    def pl_svc() -> BinderPlacementsService:
        return BinderPlacementsService(JsonBinderPlacementsRepository(pl_path))

    app = FastAPI()
    app.include_router(binder_router)
    app.dependency_overrides[get_binder_config_service] = cfg_svc
    app.dependency_overrides[get_binder_placements_service] = pl_svc
    return TestClient(app)


def test_get_default_config_and_placements(tmp_path: Path) -> None:
    client = _app(tmp_path)
    assert client.get("/api/binder/config").json() == {
        "version": 1,
        "convention": "sheet_recto_verso",
        "binders": [],
        "form_rules": [],
    }
    assert client.get("/api/binder/placements").json() == {"version": 1, "by_binder": {}}


def test_put_get_config_roundtrip(tmp_path: Path) -> None:
    client = _app(tmp_path)
    body = {
        "version": 1,
        "convention": "sheet_recto_verso",
        "binders": [{"id": "main", "name": "Principal"}],
        "form_rules": [],
    }
    r = client.put("/api/binder/config", json=body)
    assert r.status_code == 200
    assert r.json() == body
    assert client.get("/api/binder/config").json() == body


def test_put_get_placements_roundtrip(tmp_path: Path) -> None:
    client = _app(tmp_path)
    body = {"version": 1, "by_binder": {"main": {"pikachu": {"page": 0, "slot": 3}}}}
    r = client.put("/api/binder/placements", json=body)
    assert r.status_code == 200
    assert r.json() == body
    assert client.get("/api/binder/placements").json() == body


def test_put_config_validation_error() -> None:
    app = FastAPI()
    app.include_router(binder_router)
    client = TestClient(app)
    r = client.put("/api/binder/config", json={"version": 1, "binders": "invalid"})
    assert r.status_code == 422
