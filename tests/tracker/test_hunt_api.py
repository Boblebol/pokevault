"""tracker.api — hunt list endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.hunt_controller import router as hunt_router
from tracker.api.dependencies import get_hunt_service
from tracker.repository.json_hunt_repository import JsonHuntRepository
from tracker.services.hunt_service import HuntService


def _client(tmp_path: Path) -> TestClient:
    service = HuntService(JsonHuntRepository(tmp_path / "data" / "hunts.json"))
    app = FastAPI()
    app.include_router(hunt_router)
    app.dependency_overrides[get_hunt_service] = lambda: service
    return TestClient(app)


def test_get_hunts_starts_empty(tmp_path: Path) -> None:
    client = _client(tmp_path)
    r = client.get("/api/hunts")
    assert r.status_code == 200
    assert r.json() == {"version": 1, "hunts": {}}


def test_patch_hunt_roundtrip(tmp_path: Path) -> None:
    client = _client(tmp_path)
    r = client.patch(
        "/api/hunts/0025-pikachu",
        json={"wanted": True, "priority": "high", "note": "Holo FR"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["hunts"]["0025-pikachu"]["wanted"] is True
    assert body["hunts"]["0025-pikachu"]["priority"] == "high"
    assert body["hunts"]["0025-pikachu"]["note"] == "Holo FR"

    listed = client.get("/api/hunts").json()
    assert "0025-pikachu" in listed["hunts"]


def test_patch_hunt_wanted_false_removes(tmp_path: Path) -> None:
    client = _client(tmp_path)
    client.patch("/api/hunts/0025-pikachu", json={"wanted": True})
    r = client.patch("/api/hunts/0025-pikachu", json={"wanted": False})
    assert r.status_code == 200
    assert r.json()["hunts"] == {}

