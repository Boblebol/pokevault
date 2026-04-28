"""tracker.api — carnet de cartes (F08) + auto-derive (F09)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.card_controller import router as card_router
from tracker.api.controllers.progress_controller import router as progress_router
from tracker.api.dependencies import get_card_service, get_progress_service
from tracker.repository.json_card_repository import JsonCardRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.card_service import CardService
from tracker.services.progress_service import ProgressService


def _client(tmp_path: Path) -> TestClient:
    cards_path = tmp_path / "data" / "collection-cards.json"
    prog_path = tmp_path / "data" / "collection-progress.json"
    cards_path.parent.mkdir(parents=True, exist_ok=True)
    progress = ProgressService(JsonProgressRepository(prog_path))
    cards = CardService(JsonCardRepository(cards_path), progress)

    app = FastAPI()
    app.include_router(card_router)
    app.include_router(progress_router)
    app.dependency_overrides[get_card_service] = lambda: cards
    app.dependency_overrides[get_progress_service] = lambda: progress
    return TestClient(app)


def _body(**overrides: object) -> dict:
    base: dict = {
        "pokemon_slug": "0025-pikachu",
        "set_id": "sv01",
        "num": "025/165",
        "variant": "holo",
        "lang": "fr",
        "condition": "near_mint",
        "qty": 1,
        "acquired_at": "2026-04-20",
        "note": "",
        "image_url": "https://images.example/sv01-025_hires.png",
        "tcg_api_id": "sv01-025",
    }
    base.update(overrides)
    return base


def test_create_card_promotes_caught(tmp_path: Path) -> None:
    client = _client(tmp_path)
    r = client.post("/api/cards", json=_body())
    assert r.status_code == 201
    card = r.json()
    assert card["pokemon_slug"] == "0025-pikachu"
    assert card["image_url"] == "https://images.example/sv01-025_hires.png"
    assert card["tcg_api_id"] == "sv01-025"
    progress = client.get("/api/progress").json()
    assert progress["statuses"]["0025-pikachu"]["state"] == "caught"


def test_list_and_by_pokemon(tmp_path: Path) -> None:
    client = _client(tmp_path)
    a = client.post("/api/cards", json=_body(pokemon_slug="0001-bulbasaur")).json()
    b = client.post("/api/cards", json=_body(pokemon_slug="0025-pikachu")).json()
    all_cards = client.get("/api/cards").json()
    assert {c["id"] for c in all_cards["cards"]} == {a["id"], b["id"]}
    by = client.get("/api/cards/by-pokemon/0001-bulbasaur").json()
    assert [c["id"] for c in by["cards"]] == [a["id"]]


def test_get_update_delete_flow(tmp_path: Path) -> None:
    client = _client(tmp_path)
    created = client.post("/api/cards", json=_body()).json()
    got = client.get(f"/api/cards/{created['id']}")
    assert got.status_code == 200
    updated = client.put(
        f"/api/cards/{created['id']}",
        json=_body(variant="reverse", qty=3, condition="mint"),
    ).json()
    assert updated["variant"] == "reverse"
    assert updated["qty"] == 3
    deleted = client.delete(f"/api/cards/{created['id']}").json()
    assert deleted == {"ok": True, "deleted": 1}
    assert client.get(f"/api/cards/{created['id']}").status_code == 404


def test_delete_missing_card_is_zero(tmp_path: Path) -> None:
    client = _client(tmp_path)
    r = client.delete("/api/cards/does-not-exist")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "deleted": 0}


def test_update_not_found_returns_404(tmp_path: Path) -> None:
    client = _client(tmp_path)
    r = client.put("/api/cards/nope", json=_body())
    assert r.status_code == 404


def test_validation_errors(tmp_path: Path) -> None:
    client = _client(tmp_path)
    assert client.post("/api/cards", json=_body(pokemon_slug="")).status_code == 422
    assert client.post("/api/cards", json=_body(qty=0)).status_code == 422
    assert client.post("/api/cards", json=_body(condition="rekt")).status_code == 422
