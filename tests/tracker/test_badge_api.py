"""API HTTP — /api/badges (roadmap F12)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers import badge_router, card_router, progress_router
from tracker.api.dependencies import (
    get_badge_service,
    get_card_service,
    get_progress_service,
)
from tracker.repository.json_card_repository import JsonCardRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.badge_service import BadgeService
from tracker.services.card_service import CardService
from tracker.services.progress_service import ProgressService


def _build_app(tmp_path: Path) -> TestClient:
    progress_repo = JsonProgressRepository(tmp_path / "progress.json")
    card_repo = JsonCardRepository(tmp_path / "cards.json")
    progress_svc = ProgressService(progress_repo)
    card_svc = CardService(card_repo, progress_svc)
    badge_svc = BadgeService(progress_repo, card_repo)

    app = FastAPI()
    app.include_router(progress_router)
    app.include_router(card_router)
    app.include_router(badge_router)
    app.dependency_overrides[get_progress_service] = lambda: progress_svc
    app.dependency_overrides[get_card_service] = lambda: card_svc
    app.dependency_overrides[get_badge_service] = lambda: badge_svc
    return TestClient(app)


def test_badges_endpoint_empty_state(tmp_path: Path) -> None:
    client = _build_app(tmp_path)
    r = client.get("/api/badges")
    assert r.status_code == 200
    body = r.json()
    assert body["unlocked"] == []
    assert len(body["catalog"]) >= 10
    assert all(b["unlocked"] is False for b in body["catalog"])


def test_badges_endpoint_exposes_progress_metadata(tmp_path: Path) -> None:
    client = _build_app(tmp_path)
    pr = client.patch(
        "/api/progress/status",
        json={"slug": "0025-pikachu", "state": "caught"},
    )
    assert pr.status_code == 200

    body = client.get("/api/badges").json()

    by_id = {b["id"]: b for b in body["catalog"]}
    assert by_id["first_catch"] == {
        "id": "first_catch",
        "title": "Premier Pokéball",
        "description": "Attraper ton premier Pokémon.",
        "unlocked": True,
        "current": 1,
        "target": 1,
        "percent": 100,
        "hint": "Badge obtenu.",
    }
    assert by_id["century"]["current"] == 1
    assert by_id["century"]["target"] == 100
    assert by_id["century"]["percent"] == 1
    assert by_id["century"]["hint"] == "Encore 99 Pokémon à attraper."


def test_badges_auto_sync_on_read(tmp_path: Path) -> None:
    client = _build_app(tmp_path)
    pr = client.patch(
        "/api/progress/status",
        json={"slug": "0025-pikachu", "state": "caught", "shiny": True},
    )
    assert pr.status_code == 200
    body = client.get("/api/badges").json()
    assert set(body["unlocked"]) >= {"first_encounter", "first_catch", "first_shiny"}
    by_id = {b["id"]: b for b in body["catalog"]}
    assert by_id["first_catch"]["unlocked"] is True


def test_badges_first_card_triggers_unlock(tmp_path: Path) -> None:
    client = _build_app(tmp_path)
    cr = client.post(
        "/api/cards",
        json={"pokemon_slug": "0025-pikachu", "set_id": "sv01", "num": "1/1"},
    )
    assert cr.status_code == 201
    body = client.get("/api/badges").json()
    assert "first_card" in body["unlocked"]
    assert "first_catch" in body["unlocked"]
