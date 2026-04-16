"""tracker.api — export / import endpoints (TestClient)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.export_controller import router as export_router
from tracker.api.controllers.progress_controller import router as progress_router
from tracker.api.dependencies import (
    get_export_service,
    get_progress_service,
)
from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import (
    JsonBinderPlacementsRepository,
)
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.export_service import ExportService
from tracker.services.progress_service import ProgressService


def _setup(tmp_path: Path) -> TestClient:
    prog = tmp_path / "data" / "collection-progress.json"
    cfg = tmp_path / "data" / "binder-config.json"
    pl = tmp_path / "data" / "binder-placements.json"
    prog.parent.mkdir(parents=True, exist_ok=True)

    progress_repo = JsonProgressRepository(prog)
    config_repo = JsonBinderConfigRepository(cfg)
    placements_repo = JsonBinderPlacementsRepository(pl)

    def progress_override() -> ProgressService:
        return ProgressService(progress_repo)

    def export_override() -> ExportService:
        return ExportService(progress_repo, config_repo, placements_repo)

    app = FastAPI()
    app.include_router(progress_router)
    app.include_router(export_router)
    app.dependency_overrides[get_progress_service] = progress_override
    app.dependency_overrides[get_export_service] = export_override
    return TestClient(app)


def test_export_empty_collection(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    r = client.get("/api/export")
    assert r.status_code == 200
    data = r.json()
    assert data["schema_version"] == 1
    assert data["app"] == "pokevault"
    assert "exported_at" in data
    assert data["progress"]["caught"] == {}
    assert data["binder_config"]["binders"] == []
    assert data["binder_placements"]["by_binder"] == {}


def test_export_with_data(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    client.put("/api/progress", json={"caught": {"pikachu": True, "bulbasaur": True}})

    r = client.get("/api/export")
    assert r.status_code == 200
    data = r.json()
    assert data["progress"]["caught"] == {"pikachu": True, "bulbasaur": True}


def test_import_restores_collection(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    payload = {
        "schema_version": 1,
        "progress": {"version": 1, "caught": {"charmander": True}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [{"id": "kanto", "name": "Kanto", "rows": 3, "cols": 3}],
            "form_rules": [],
        },
        "binder_placements": {
            "version": 1,
            "by_binder": {"kanto": {"charmander": {"page": 0, "slot": 3}}},
        },
    }
    r = client.post("/api/import", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["caught_count"] == 1
    assert body["binder_count"] == 1

    exported = client.get("/api/export").json()
    assert exported["progress"]["caught"] == {"charmander": True}
    assert len(exported["binder_config"]["binders"]) == 1
    assert exported["binder_config"]["binders"][0]["id"] == "kanto"
    assert "charmander" in exported["binder_placements"]["by_binder"]["kanto"]


def test_import_overwrites_existing(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    client.put("/api/progress", json={"caught": {"old-pokemon": True}})

    payload = {
        "schema_version": 1,
        "progress": {"version": 1, "caught": {"new-pokemon": True}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [],
            "form_rules": [],
        },
        "binder_placements": {"version": 1, "by_binder": {}},
    }
    client.post("/api/import", json=payload)

    exported = client.get("/api/export").json()
    assert exported["progress"]["caught"] == {"new-pokemon": True}
    assert "old-pokemon" not in exported["progress"]["caught"]


def test_import_rejects_bad_schema_version(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    payload = {
        "schema_version": 99,
        "progress": {"version": 1, "caught": {}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [],
            "form_rules": [],
        },
        "binder_placements": {"version": 1, "by_binder": {}},
    }
    r = client.post("/api/import", json=payload)
    assert r.status_code == 422


def test_import_rejects_malformed_json(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    r = client.post("/api/import", json={"garbage": True})
    assert r.status_code == 422


def test_roundtrip_export_import(tmp_path: Path) -> None:
    """Export then re-import should yield identical state."""
    client = _setup(tmp_path)
    client.put("/api/progress", json={"caught": {"pikachu": True, "eevee": True}})

    exported = client.get("/api/export").json()
    client.put("/api/progress", json={"caught": {}})

    assert client.get("/api/export").json()["progress"]["caught"] == {}

    r = client.post("/api/import", json=exported)
    assert r.status_code == 200

    restored = client.get("/api/export").json()
    assert restored["progress"]["caught"] == {"pikachu": True, "eevee": True}
