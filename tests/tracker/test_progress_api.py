"""tracker.api — contrôleur progression + dépendances (TestClient)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.progress_controller import router as progress_router
from tracker.api.dependencies import get_progress_service
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.progress_service import ProgressService


def test_put_get_progress_integration(tmp_path: Path) -> None:
    _web = tmp_path / "web"
    _web.mkdir()
    (_web / "index.html").write_text("<html></html>", encoding="utf-8")
    prog = tmp_path / "data" / "collection-progress.json"
    prog.parent.mkdir(parents=True)

    def service_override() -> ProgressService:
        return ProgressService(JsonProgressRepository(prog))

    app = FastAPI()
    app.include_router(progress_router)
    app.dependency_overrides[get_progress_service] = service_override

    client = TestClient(app)
    assert client.get("/api/progress").json() == {"version": 1, "caught": {}}
    r = client.put("/api/progress", json={"caught": {"pikachu": True}})
    assert r.status_code == 200
    assert r.json() == {"ok": True, "saved": 1}
    assert client.get("/api/progress").json()["caught"] == {"pikachu": True}


def test_put_progress_validation_error() -> None:
    app = FastAPI()
    app.include_router(progress_router)
    client = TestClient(app)
    r = client.put("/api/progress", json={"caught": "bad"})
    assert r.status_code == 422


def test_patch_progress_merge(tmp_path: Path) -> None:
    _web = tmp_path / "web"
    _web.mkdir()
    (_web / "index.html").write_text("<html></html>", encoding="utf-8")
    prog = tmp_path / "data" / "collection-progress.json"
    prog.parent.mkdir(parents=True)

    def service_override() -> ProgressService:
        return ProgressService(JsonProgressRepository(prog))

    app = FastAPI()
    app.include_router(progress_router)
    app.dependency_overrides[get_progress_service] = service_override
    client = TestClient(app)
    assert client.put("/api/progress", json={"caught": {"a": True, "b": True}}).status_code == 200
    r = client.patch("/api/progress", json={"slug": "b", "caught": False})
    assert r.status_code == 200
    assert client.get("/api/progress").json()["caught"] == {"a": True}
    r2 = client.patch("/api/progress", json={"slug": "c", "caught": True})
    assert r2.status_code == 200
    assert client.get("/api/progress").json()["caught"] == {"a": True, "c": True}
