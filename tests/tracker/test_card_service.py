"""tracker.services.card_service (roadmap F08 + F09)."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from tracker.models import CardCreate, CardUpdate
from tracker.repository.json_card_repository import JsonCardRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.card_service import CardService
from tracker.services.progress_service import ProgressService


def _make(tmp_path: Path, with_progress: bool = True) -> CardService:
    repo = JsonCardRepository(tmp_path / "cards.json")
    progress = (
        ProgressService(JsonProgressRepository(tmp_path / "progress.json"))
        if with_progress
        else None
    )
    return CardService(repo, progress)


def _payload(**overrides: object) -> CardCreate:
    base: dict = {
        "pokemon_slug": "0025-pikachu",
        "set_id": "sv01",
        "num": "025/165",
        "variant": "holo",
        "lang": "FR",
        "condition": "near_mint",
        "qty": 2,
        "acquired_at": "2026-04-20",
        "note": "  gift from a friend  ",
    }
    base.update(overrides)
    return CardCreate(**base)


def test_create_generates_id_and_timestamps(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    card = svc.create(_payload())
    assert card.id
    assert card.created_at == card.updated_at
    assert card.lang == "fr"
    assert card.note == "gift from a friend"


def test_create_auto_promotes_caught_f09(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    svc.create(_payload())
    progress = ProgressService(JsonProgressRepository(tmp_path / "progress.json"))
    state = progress.get_progress().statuses["0025-pikachu"]
    assert state.state == "caught"


def test_create_without_progress_service_is_noop(tmp_path: Path) -> None:
    svc = _make(tmp_path, with_progress=False)
    card = svc.create(_payload(pokemon_slug="0001-bulbasaur"))
    assert card.pokemon_slug == "0001-bulbasaur"


def test_list_by_pokemon_filters(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    svc.create(_payload(pokemon_slug="0001-bulbasaur"))
    svc.create(_payload(pokemon_slug="0025-pikachu"))
    assert svc.list_by_pokemon("0001-bulbasaur").cards[0].pokemon_slug == "0001-bulbasaur"
    assert svc.list_by_pokemon("").cards == []


def test_get_card_not_found(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    with pytest.raises(HTTPException) as exc:
        svc.get("missing")
    assert exc.value.status_code == 404


def test_update_preserves_id_and_created_at(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    created = svc.create(_payload())
    updated = svc.update(
        created.id,
        CardUpdate(
            pokemon_slug=created.pokemon_slug,
            set_id=created.set_id,
            num=created.num,
            variant="reverse",
            lang=created.lang,
            condition="mint",
            qty=3,
            acquired_at=created.acquired_at,
            note="upgraded",
        ),
    )
    assert updated.id == created.id
    assert updated.created_at == created.created_at
    assert updated.variant == "reverse"
    assert updated.qty == 3
    assert updated.condition == "mint"


def test_update_reassigns_slug_promotes_new_slug(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    created = svc.create(_payload(pokemon_slug="0001-bulbasaur"))
    svc.update(
        created.id,
        CardUpdate(
            pokemon_slug="0004-charmander",
            set_id=created.set_id,
            num=created.num,
            variant=created.variant,
            lang=created.lang,
            condition=created.condition,
            qty=created.qty,
            acquired_at=created.acquired_at,
            note=created.note,
        ),
    )
    progress = ProgressService(JsonProgressRepository(tmp_path / "progress.json"))
    statuses = progress.get_progress().statuses
    assert statuses["0004-charmander"].state == "caught"
    assert statuses["0001-bulbasaur"].state == "caught"  # intent preserved


def test_update_targets_second_card_when_multiple(tmp_path: Path) -> None:
    """Covers the loop-continue branch in ``CardService.update``."""
    svc = _make(tmp_path)
    first = svc.create(_payload(pokemon_slug="0001-bulbasaur"))
    second = svc.create(_payload(pokemon_slug="0025-pikachu"))
    updated = svc.update(
        second.id,
        CardUpdate(
            pokemon_slug=second.pokemon_slug,
            set_id=second.set_id,
            num=second.num,
            variant="reverse",
            lang=second.lang,
            condition=second.condition,
            qty=second.qty,
            acquired_at=second.acquired_at,
            note=second.note,
        ),
    )
    assert updated.id == second.id
    assert updated.variant == "reverse"
    assert svc.get(first.id).variant != "reverse"


def test_update_not_found(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    with pytest.raises(HTTPException) as exc:
        svc.update(
            "missing",
            CardUpdate(
                pokemon_slug="0001-bulbasaur",
                set_id="",
                num="",
                variant="",
                lang="",
                condition="near_mint",
                qty=1,
                acquired_at=None,
                note="",
            ),
        )
    assert exc.value.status_code == 404


def test_delete_returns_counts(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    assert svc.delete("missing").deleted == 0
    created = svc.create(_payload())
    resp = svc.delete(created.id)
    assert resp.ok is True
    assert resp.deleted == 1
    assert svc.list_all().cards == []


def test_delete_keeps_caught_flag_f09(tmp_path: Path) -> None:
    """Deleting the last card of a slug must NOT undo caught status."""
    svc = _make(tmp_path)
    created = svc.create(_payload())
    svc.delete(created.id)
    progress = ProgressService(JsonProgressRepository(tmp_path / "progress.json"))
    assert progress.get_progress().statuses["0025-pikachu"].state == "caught"


def test_ensure_caught_idempotent(tmp_path: Path) -> None:
    progress = ProgressService(JsonProgressRepository(tmp_path / "progress.json"))
    assert progress.ensure_caught("0025-pikachu") is True
    assert progress.ensure_caught("0025-pikachu") is False
    assert progress.ensure_caught("   ") is False


def test_ensure_caught_upgrades_seen_to_caught(tmp_path: Path) -> None:
    from tracker.models import ProgressStatusPatch

    progress = ProgressService(JsonProgressRepository(tmp_path / "progress.json"))
    progress.patch_status(ProgressStatusPatch(slug="0001-bulbasaur", state="seen"))
    assert progress.ensure_caught("0001-bulbasaur") is True
    state = progress.get_progress().statuses["0001-bulbasaur"]
    assert state.state == "caught"


def test_create_trims_image_url(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    card = svc.create(_payload(image_url="  https://img.example/a.png  "))
    assert card.image_url == "https://img.example/a.png"


def test_update_replaces_image_url(tmp_path: Path) -> None:
    svc = _make(tmp_path)
    created = svc.create(_payload(image_url="https://a.png"))
    new = svc.update(
        created.id,
        CardUpdate(
            pokemon_slug=created.pokemon_slug,
            set_id=created.set_id,
            num=created.num,
            variant=created.variant,
            lang=created.lang,
            condition=created.condition,
            qty=created.qty,
            image_url="  https://b.png  ",
        ),
    )
    assert new.image_url == "https://b.png"
