"""tracker.services.trainer_contact_service — local Trainer Cards."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from tracker.models import (
    TrainerCard,
    TrainerCardBadge,
    TrainerContactLink,
    TrainerContactNotePatch,
)
from tracker.repository.json_trainer_contact_repository import JsonTrainerContactRepository
from tracker.services.trainer_contact_service import TrainerContactService


def _card(trainer_id: str = "trainer-123", name: str = "Alex") -> TrainerCard:
    return TrainerCard(
        trainer_id=trainer_id,
        display_name=name,
        favorite_region="kanto",
        favorite_pokemon_slug="0025-pikachu",
        public_note="Local only",
        wants=["0001-bulbasaur"],
        for_trade=["0004-charmander"],
        updated_at="2026-04-30T10:00:00+00:00",
    )


def test_save_own_card_creates_stable_id_and_trims_fields(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    card = service.save_own_card(_card(trainer_id="manual-id", name="  Alex  "))

    assert card.trainer_id == "manual-id"
    assert card.display_name == "Alex"
    assert card.updated_at
    assert service.export_own_card().trainer_id == "manual-id"


def test_save_own_card_cleans_links_and_lists(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))
    card = _card().model_copy(
        update={
            "contact_links": [
                TrainerContactLink(kind="discord", label="Discord", value="   "),
                TrainerContactLink(kind="email", label=" Mail ", value=" alex@example.test "),
            ],
            "wants": [" 0001-bulbasaur ", "0001-bulbasaur", "", "0004-charmander"],
            "for_trade": [" 0007-squirtle ", "0007-squirtle"],
        },
    )

    saved = service.save_own_card(card)

    assert len(saved.contact_links) == 1
    assert saved.contact_links[0].label == "Mail"
    assert saved.contact_links[0].value == "alex@example.test"
    assert saved.wants == ["0001-bulbasaur", "0004-charmander"]
    assert saved.for_trade == ["0007-squirtle"]


def test_save_own_card_cleans_shared_badges(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))
    card = _card().model_copy(
        update={
            "badges": [
                TrainerCardBadge(id=" kanto_brock ", title=" Badge Roche "),
                TrainerCardBadge(id="kanto_brock", title="Duplicate"),
                TrainerCardBadge(id="kanto_misty", title=" Badge Cascade "),
                TrainerCardBadge(id="   ", title="Blank"),
            ],
        },
    )

    saved = service.save_own_card(card)

    assert [(badge.id, badge.title) for badge in saved.badges] == [
        ("kanto_brock", "Badge Roche"),
        ("kanto_misty", "Badge Cascade"),
    ]


def test_import_card_creates_then_updates_by_trainer_id(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    created = service.import_card(_card(name="Alex"))
    updated = service.import_card(
        _card(name="Alexandre").model_copy(update={"updated_at": "2026-05-01T10:00:00+00:00"})
    )

    assert created.action == "created"
    assert updated.action == "updated"
    assert updated.contact.card.display_name == "Alexandre"
    assert len(service.get_book().contacts) == 1


def test_import_card_ignores_same_or_older_timestamp(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    service.import_card(_card(name="New"))
    response = service.import_card(
        _card(name="Old").model_copy(update={"updated_at": "2026-04-29T10:00:00+00:00"})
    )

    assert response.action == "unchanged"
    assert response.contact.card.display_name == "New"


def test_import_card_rejects_blank_trainer_id_after_trim(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    with pytest.raises(HTTPException) as exc:
        service.import_card(_card(trainer_id="        "))

    assert exc.value.status_code == 400
    assert exc.value.detail == "trainer_id is required"


def test_private_note_is_local_and_survives_contact_update(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))
    service.import_card(_card())

    noted = service.patch_private_note("trainer-123", TrainerContactNotePatch(note="Vu au tournoi"))
    service.import_card(
        _card(name="Alex v2").model_copy(update={"updated_at": "2026-05-01T10:00:00+00:00"})
    )

    assert noted.private_note == "Vu au tournoi"
    assert service.get_book().contacts["trainer-123"].private_note == "Vu au tournoi"


def test_patch_private_note_rejects_missing_contact(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    with pytest.raises(HTTPException) as exc:
        service.patch_private_note("ghost", TrainerContactNotePatch(note="x"))

    assert exc.value.status_code == 404
    assert exc.value.detail == "trainer contact not found"


def test_delete_contact_returns_count(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))
    service.import_card(_card())

    assert service.delete_contact("trainer-123") == 1
    assert service.delete_contact("trainer-123") == 0


def test_repository_tolerates_missing_malformed_and_invalid_files(tmp_path: Path) -> None:
    assert JsonTrainerContactRepository(tmp_path / "missing.json").load().contacts == {}

    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    assert JsonTrainerContactRepository(broken).load().contacts == {}

    invalid = tmp_path / "invalid.json"
    invalid.write_text('{"version": 1, "contacts": []}', encoding="utf-8")
    assert JsonTrainerContactRepository(invalid).load().contacts == {}

    non_dict = tmp_path / "non-dict.json"
    non_dict.write_text("[]", encoding="utf-8")
    assert JsonTrainerContactRepository(non_dict).load().contacts == {}


def test_export_own_card_requires_existing_card(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    with pytest.raises(HTTPException) as exc:
        service.export_own_card()

    assert exc.value.status_code == 404
    assert exc.value.detail == "trainer card not found"
