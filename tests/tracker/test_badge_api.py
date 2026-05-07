"""API HTTP — /api/badges (roadmap F12)."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers import badge_router, progress_router
from tracker.api.dependencies import (
    get_badge_service,
    get_progress_service,
)
from tracker.badge_battle_models import BadgeBattleCatalog
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.badge_service import BadgeService
from tracker.services.progress_service import ProgressService


def _build_app(tmp_path: Path) -> TestClient:
    progress_repo = JsonProgressRepository(tmp_path / "progress.json")
    progress_svc = ProgressService(progress_repo)
    badge_svc = BadgeService(progress_repo)

    app = FastAPI()
    app.include_router(progress_router)
    app.include_router(badge_router)
    app.dependency_overrides[get_progress_service] = lambda: progress_svc
    app.dependency_overrides[get_badge_service] = lambda: badge_svc
    return TestClient(app)


def _assert_badge_contains(actual: dict, expected: dict) -> None:
    assert {key: actual[key] for key in expected} == expected


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
    _assert_badge_contains(
        by_id["first_catch"],
        {
            "id": "first_catch",
            "title": "Premier Pokéball",
            "description": "Attraper ton premier Pokémon.",
            "unlocked": True,
            "current": 1,
            "target": 1,
            "percent": 100,
            "hint": "Badge obtenu.",
        },
    )
    assert by_id["century"]["current"] == 1
    assert by_id["century"]["target"] == 100
    assert by_id["century"]["percent"] == 1
    assert by_id["century"]["hint"] == "Encore 99 Pokémon à attraper."


def test_badges_endpoint_exposes_battle_data_when_catalog_is_configured(
    tmp_path: Path,
) -> None:
    progress_repo = JsonProgressRepository(tmp_path / "progress.json")
    progress_svc = ProgressService(progress_repo)
    battle_catalog = BadgeBattleCatalog.model_validate(
        {
            "version": 1,
            "badges": {
                "kanto_brock": {
                    "trainer": {
                        "name": {"fr": "Pierre", "en": "Brock"},
                        "role": {"fr": "Champion d'Arène", "en": "Gym Leader"},
                        "history": {
                            "fr": "Champion d'Argenta.",
                            "en": "Pewter Gym Leader.",
                        },
                    },
                    "location": {
                        "region": "kanto",
                        "city": {"fr": "Argenta", "en": "Pewter City"},
                        "place": {"fr": "Arène d'Argenta", "en": "Pewter Gym"},
                    },
                    "encounters": [
                        {
                            "id": "red-blue",
                            "label": {"fr": "Rouge / Bleu", "en": "Red / Blue"},
                            "games": ["red", "blue"],
                            "variant": {"kind": "version"},
                            "team": [
                                {
                                    "slug": "0074-geodude",
                                    "level": 12,
                                    "moves": [{"fr": "Charge", "en": "Tackle"}],
                                }
                            ],
                        }
                    ],
                }
            },
        }
    )
    badge_svc = BadgeService(progress_repo, battle_catalog=battle_catalog)
    app = FastAPI()
    app.include_router(progress_router)
    app.include_router(badge_router)
    app.dependency_overrides[get_progress_service] = lambda: progress_svc
    app.dependency_overrides[get_badge_service] = lambda: badge_svc
    client = TestClient(app)

    body = client.get("/api/badges").json()
    by_id = {badge["id"]: badge for badge in body["catalog"]}

    assert by_id["kanto_brock"]["battle"]["trainer"]["name"]["en"] == "Brock"
    assert by_id["kanto_brock"]["battle"]["encounters"][0]["team"][0]["level"] == 12
    assert by_id["first_catch"]["battle"] is None


def test_badges_auto_sync_on_read(tmp_path: Path) -> None:
    client = _build_app(tmp_path)
    pr = client.patch(
        "/api/progress/status",
        json={"slug": "0025-pikachu", "state": "caught", "shiny": True},
    )
    assert pr.status_code == 200
    body = client.get("/api/badges").json()
    assert "first_encounter" not in body["unlocked"]
    assert body["unlocked"] == ["first_catch"]
    by_id = {b["id"]: b for b in body["catalog"]}
    assert "first_encounter" not in by_id
    assert "first_shiny" not in by_id
    assert by_id["first_catch"]["unlocked"] is True


def test_badges_endpoint_filters_removed_legacy_unlocked_ids(
    tmp_path: Path,
) -> None:
    progress_path = tmp_path / "progress.json"
    progress_path.write_text(
        json.dumps(
            {
                "caught": {},
                "statuses": {},
                "badges_unlocked": ["first_encounter", "first_catch"],
            }
        ),
        encoding="utf-8",
    )
    client = _build_app(tmp_path)

    body = client.get("/api/badges").json()

    by_id = {b["id"]: b for b in body["catalog"]}
    assert "first_encounter" not in body["unlocked"]
    assert "first_encounter" not in by_id
    assert body["unlocked"] == ["first_catch"]
    assert by_id["first_catch"]["unlocked"] is True
    persisted = json.loads(progress_path.read_text(encoding="utf-8"))
    assert persisted["badges_unlocked"] == ["first_catch"]


def test_badges_endpoint_exposes_kanto_trainer_badges(tmp_path: Path) -> None:
    client = _build_app(tmp_path)
    for slug in ["0074-geodude", "0095-onix"]:
        pr = client.patch(
            "/api/progress/status",
            json={"slug": slug, "state": "caught"},
        )
        assert pr.status_code == 200

    body = client.get("/api/badges").json()
    by_id = {b["id"]: b for b in body["catalog"]}

    _assert_badge_contains(
        by_id["kanto_brock"],
        {
            "id": "kanto_brock",
            "title": "Pierre - Roche de Kanto",
            "description": "Capturer l'equipe de Pierre dans Pokemon Rouge/Bleu.",
            "unlocked": True,
            "current": 2,
            "target": 2,
            "percent": 100,
            "hint": "Badge obtenu.",
        },
    )
    assert by_id["kanto_brock"]["category"] == "gym"
    assert by_id["kanto_brock"]["region"] == "kanto"
    assert by_id["kanto_brock"]["effect"] == "gloss"
    assert by_id["kanto_brock"]["reveal"] == "mystery"
    assert by_id["kanto_brock"]["i18n"]["en"]["mystery_title"]
    assert "kanto_brock" in body["unlocked"]


def test_badges_endpoint_exposes_gold_silver_trainer_badges(tmp_path: Path) -> None:
    client = _build_app(tmp_path)
    for slug in ["0016-pidgey", "0017-pidgeotto"]:
        pr = client.patch(
            "/api/progress/status",
            json={"slug": slug, "state": "caught"},
        )
        assert pr.status_code == 200

    body = client.get("/api/badges").json()
    by_id = {b["id"]: b for b in body["catalog"]}

    _assert_badge_contains(
        by_id["gs_falkner"],
        {
            "id": "gs_falkner",
            "title": "Albert - Zephyr",
            "description": "Capturer l'equipe d'Albert dans Pokemon Or/Argent.",
            "unlocked": True,
            "current": 2,
            "target": 2,
            "percent": 100,
            "hint": "Badge obtenu.",
        },
    )
    assert "gs_falkner" in body["unlocked"]


def test_badges_endpoint_exposes_base_generation_trainer_badges(
    tmp_path: Path,
) -> None:
    client = _build_app(tmp_path)
    for slug in ["0829-gossifleur", "0830-eldegoss"]:
        pr = client.patch(
            "/api/progress/status",
            json={"slug": slug, "state": "caught"},
        )
        assert pr.status_code == 200
    for slug in ["0919-nymble", "0917-tarountula", "0216-teddiursa"]:
        pr = client.patch(
            "/api/progress/status",
            json={"slug": slug, "state": "caught"},
        )
        assert pr.status_code == 200

    body = client.get("/api/badges").json()
    by_id = {b["id"]: b for b in body["catalog"]}

    _assert_badge_contains(
        by_id["swsh_milo"],
        {
            "id": "swsh_milo",
            "title": "Milo - Plante",
            "description": "Capturer l'equipe de Milo dans Pokemon Epee/Bouclier.",
            "unlocked": True,
            "current": 2,
            "target": 2,
            "percent": 100,
            "hint": "Badge obtenu.",
        },
    )
    _assert_badge_contains(
        by_id["sv_katy"],
        {
            "id": "sv_katy",
            "title": "Katy - Insecte",
            "description": "Capturer l'equipe de Katy dans Pokemon Ecarlate/Violet.",
            "unlocked": True,
            "current": 3,
            "target": 3,
            "percent": 100,
            "hint": "Badge obtenu.",
        },
    )
    assert {"swsh_milo", "sv_katy"} <= set(body["unlocked"])
