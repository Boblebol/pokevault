"""API HTTP — /api/profiles (roadmap F15)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers import profile_router
from tracker.api.dependencies import get_profile_service
from tracker.services.profile_service import DEFAULT_ID, ProfileService


def _build(tmp_path: Path) -> tuple[TestClient, ProfileService]:
    svc = ProfileService(
        data_root=tmp_path,
        registry_path=tmp_path / "profiles.json",
    )
    app = FastAPI()
    app.include_router(profile_router)
    app.dependency_overrides[get_profile_service] = lambda: svc
    return TestClient(app), svc


def test_list_returns_default_profile(tmp_path: Path) -> None:
    client, _ = _build(tmp_path)
    r = client.get("/api/profiles")
    assert r.status_code == 200
    body = r.json()
    assert body["active_id"] == DEFAULT_ID
    assert any(p["id"] == DEFAULT_ID for p in body["profiles"])


def test_create_profile_returns_201(tmp_path: Path) -> None:
    client, _ = _build(tmp_path)
    r = client.post("/api/profiles", json={"name": "Shiny Hunt"})
    assert r.status_code == 201
    body = r.json()
    assert body["id"] == "shiny-hunt"
    assert body["name"] == "Shiny Hunt"
    listing = client.get("/api/profiles").json()
    assert {p["id"] for p in listing["profiles"]} == {DEFAULT_ID, "shiny-hunt"}


def test_switch_active_profile(tmp_path: Path) -> None:
    client, _ = _build(tmp_path)
    client.post("/api/profiles", json={"name": "Alt"})
    r = client.put("/api/profiles/active", json={"id": "alt"})
    assert r.status_code == 200
    assert r.json()["active_id"] == "alt"


def test_switch_unknown_profile_404(tmp_path: Path) -> None:
    client, _ = _build(tmp_path)
    r = client.put("/api/profiles/active", json={"id": "ghost"})
    assert r.status_code == 404


def test_delete_profile(tmp_path: Path) -> None:
    client, _ = _build(tmp_path)
    client.post("/api/profiles", json={"name": "Alt"})
    r = client.delete("/api/profiles/alt")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "deleted": 1}


def test_delete_default_forbidden(tmp_path: Path) -> None:
    client, _ = _build(tmp_path)
    r = client.delete(f"/api/profiles/{DEFAULT_ID}")
    assert r.status_code == 400


def test_delete_unknown_returns_zero(tmp_path: Path) -> None:
    client, _ = _build(tmp_path)
    r = client.delete("/api/profiles/ghost")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "deleted": 0}
