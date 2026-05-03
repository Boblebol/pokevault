"""tracker.api — trainer contact endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.trainer_contact_controller import router as trainer_router
from tracker.api.dependencies import get_trainer_contact_service
from tracker.repository.json_trainer_contact_repository import JsonTrainerContactRepository
from tracker.services.trainer_contact_service import TrainerContactService


def _client(tmp_path: Path) -> TestClient:
    service = TrainerContactService(
        JsonTrainerContactRepository(tmp_path / "data" / "trainer-contacts.json"),
    )
    app = FastAPI()
    app.include_router(trainer_router)
    app.dependency_overrides[get_trainer_contact_service] = lambda: service
    return TestClient(app)


def _payload(name: str = "Alex") -> dict:
    return {
        "schema_version": 1,
        "app": "pokevault",
        "kind": "trainer_card",
        "trainer_id": "trainer-123",
        "display_name": name,
        "favorite_region": "kanto",
        "favorite_pokemon_slug": "0025-pikachu",
        "public_note": "Local first",
        "contact_links": [{"kind": "discord", "label": "Discord", "value": "alex#0001"}],
        "wants": ["0001-bulbasaur"],
        "for_trade": ["0004-charmander"],
        "updated_at": "2026-04-30T10:00:00+00:00",
    }


def test_get_trainers_starts_empty(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.get("/api/trainers")

    assert response.status_code == 200
    assert response.json() == {"version": 1, "own_card": None, "contacts": {}}


def test_put_and_export_own_card(tmp_path: Path) -> None:
    client = _client(tmp_path)

    saved = client.put("/api/trainers/me", json=_payload()).json()
    exported = client.get("/api/trainers/card").json()

    assert saved["display_name"] == "Alex"
    assert exported["trainer_id"] == "trainer-123"


def test_put_own_card_accepts_social_contact_links(tmp_path: Path) -> None:
    client = _client(tmp_path)
    payload = _payload()
    payload["contact_links"] = [
        {"kind": "instagram", "label": "Instagram", "value": "@alex_cards"},
        {"kind": "facebook", "label": "Facebook", "value": "alex.cards"},
        {"kind": "phone", "label": "Téléphone", "value": "+33 6 12 34 56 78"},
    ]

    response = client.put("/api/trainers/me", json=payload)

    assert response.status_code == 200
    assert [link["kind"] for link in response.json()["contact_links"]] == [
        "instagram",
        "facebook",
        "phone",
    ]


def test_put_own_card_accepts_shared_badges(tmp_path: Path) -> None:
    client = _client(tmp_path)
    payload = _payload()
    payload["badges"] = [
        {"id": " kanto_brock ", "title": " Badge Roche "},
        {"id": "kanto_brock", "title": "Duplicate"},
        {"id": "kanto_misty", "title": "Badge Cascade"},
    ]

    response = client.put("/api/trainers/me", json=payload)

    assert response.status_code == 200
    assert response.json()["badges"] == [
        {"id": "kanto_brock", "title": "Badge Roche"},
        {"id": "kanto_misty", "title": "Badge Cascade"},
    ]


def test_import_card_creates_contact_then_updates(tmp_path: Path) -> None:
    client = _client(tmp_path)

    created = client.post("/api/trainers/import", json=_payload()).json()
    updated_payload = _payload("Alexandre")
    updated_payload["updated_at"] = "2026-05-01T10:00:00+00:00"
    updated = client.post("/api/trainers/import", json=updated_payload).json()

    assert created["action"] == "created"
    assert updated["action"] == "updated"
    contacts = client.get("/api/trainers").json()["contacts"]
    assert contacts["trainer-123"]["card"]["display_name"] == "Alexandre"


def test_patch_note_and_delete_contact(tmp_path: Path) -> None:
    client = _client(tmp_path)
    client.post("/api/trainers/import", json=_payload())

    note = client.patch("/api/trainers/trainer-123/note", json={"note": "Rencontré IRL"}).json()
    deleted = client.delete("/api/trainers/trainer-123").json()

    assert note["private_note"] == "Rencontré IRL"
    assert deleted == {"ok": True, "deleted": 1}
