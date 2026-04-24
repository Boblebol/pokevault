"""tracker.repository.json_card_repository (roadmap F08)."""

from __future__ import annotations

import json
from pathlib import Path

from tracker.models import Card, CardList
from tracker.repository.json_card_repository import JsonCardRepository


def _sample_card(**overrides: object) -> dict:
    base = {
        "id": "abc-1",
        "pokemon_slug": "0001-bulbasaur",
        "set_id": "base1",
        "num": "044/102",
        "variant": "holo",
        "lang": "fr",
        "condition": "near_mint",
        "qty": 1,
        "acquired_at": "2026-04-20",
        "note": "",
        "created_at": "2026-04-20T00:00:00+00:00",
        "updated_at": "2026-04-20T00:00:00+00:00",
    }
    base.update(overrides)
    return base


def test_load_missing_file(tmp_path: Path) -> None:
    repo = JsonCardRepository(tmp_path / "missing.json")
    assert repo.load() == CardList()


def test_load_invalid_json(tmp_path: Path) -> None:
    p = tmp_path / "bad.json"
    p.write_text("{not json", encoding="utf-8")
    assert JsonCardRepository(p).load() == CardList()


def test_load_non_dict_root(tmp_path: Path) -> None:
    p = tmp_path / "x.json"
    p.write_text(json.dumps([1, 2, 3]), encoding="utf-8")
    assert JsonCardRepository(p).load() == CardList()


def test_load_cards_not_list(tmp_path: Path) -> None:
    p = tmp_path / "x.json"
    p.write_text(json.dumps({"cards": {}}), encoding="utf-8")
    assert JsonCardRepository(p).load() == CardList()


def test_load_skips_bad_entries(tmp_path: Path) -> None:
    p = tmp_path / "x.json"
    p.write_text(
        json.dumps(
            {
                "version": 1,
                "cards": [
                    _sample_card(),
                    "not-a-dict",
                    _sample_card(id="", pokemon_slug="0002"),  # id empty -> invalid
                    _sample_card(id="abc-2", qty=0),  # qty < 1 -> invalid
                    _sample_card(id="abc-3"),
                ],
            }
        ),
        encoding="utf-8",
    )
    loaded = JsonCardRepository(p).load()
    assert [c.id for c in loaded.cards] == ["abc-1", "abc-3"]


def test_save_creates_parent_and_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "cards.json"
    repo = JsonCardRepository(path)
    card = Card.model_validate(_sample_card())
    repo.save(CardList(cards=[card]))
    assert path.is_file()
    reloaded = JsonCardRepository(path).load()
    assert len(reloaded.cards) == 1
    assert reloaded.cards[0].id == "abc-1"
