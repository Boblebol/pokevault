"""tracker.services.badge_service (roadmap F12)."""

from __future__ import annotations

from pathlib import Path

from tracker.models import CardCreate, ProgressStatusPatch
from tracker.repository.json_card_repository import JsonCardRepository
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.badge_service import BADGES, BadgeService
from tracker.services.card_service import CardService
from tracker.services.progress_service import ProgressService


def _wire(tmp_path: Path) -> tuple[BadgeService, ProgressService, CardService]:
    progress_repo = JsonProgressRepository(tmp_path / "progress.json")
    card_repo = JsonCardRepository(tmp_path / "cards.json")
    progress_service = ProgressService(progress_repo)
    card_service = CardService(card_repo, progress_service)
    badge_service = BadgeService(progress_repo, card_repo)
    return badge_service, progress_service, card_service


def test_catalog_exposes_all_definitions(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)
    state = badge_service.state()
    assert len(state.catalog) == len(BADGES)
    assert {b.id for b in state.catalog} == {b.id for b in BADGES}
    assert all(not b.unlocked for b in state.catalog)
    assert state.unlocked == []


def test_sync_unlocks_first_encounter_when_something_seen(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="seen"))
    newly = badge_service.sync_unlocked()
    assert newly == ["first_encounter"]
    again = badge_service.sync_unlocked()
    assert again == []


def test_sync_unlocks_catch_and_shiny_thresholds(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    progress.patch_status(
        ProgressStatusPatch(slug="0025-pikachu", state="caught", shiny=True)
    )
    newly = set(badge_service.sync_unlocked())
    assert {"first_encounter", "first_catch", "first_shiny"} <= newly


def test_sync_unlocks_first_card(tmp_path: Path) -> None:
    badge_service, _, cards = _wire(tmp_path)
    cards.create(CardCreate(pokemon_slug="0025-pikachu", set_id="sv01", num="1/1"))
    newly = set(badge_service.sync_unlocked())
    assert "first_card" in newly


def test_unlocks_are_monotonic_even_if_progress_drops(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="caught"))
    badge_service.sync_unlocked()
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="not_met"))
    state = badge_service.state()
    ids = {b.id for b in state.catalog if b.unlocked}
    assert "first_catch" in ids


def test_sync_unlocks_threshold_badges(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    for i in range(1, 101):
        progress.patch_status(
            ProgressStatusPatch(slug=f"slug-{i:04d}", state="caught")
        )
    newly = set(badge_service.sync_unlocked())
    assert "century" in newly
    assert "thousand" not in newly


def test_card_based_thresholds(tmp_path: Path) -> None:
    badge_service, _, cards = _wire(tmp_path)
    for i in range(10):
        cards.create(
            CardCreate(
                pokemon_slug=f"slug-{i}",
                set_id=f"set-{i}",
                num=str(i),
                qty=1,
            )
        )
    newly = set(badge_service.sync_unlocked())
    assert "ten_sets" in newly
    assert "hundred_cards" not in newly


def test_dedicated_collector_looks_at_cumulative_qty(tmp_path: Path) -> None:
    badge_service, _, cards = _wire(tmp_path)
    cards.create(CardCreate(pokemon_slug="s", set_id="a", num="1", qty=500))
    newly = set(badge_service.sync_unlocked())
    assert "dedicated_collector" in newly


def test_state_reports_unlocked_on_catalog_entries(tmp_path: Path) -> None:
    badge_service, progress, _ = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="seen"))
    badge_service.sync_unlocked()
    state = badge_service.state()
    by_id = {b.id: b for b in state.catalog}
    assert by_id["first_encounter"].unlocked is True
    assert by_id["first_catch"].unlocked is False
    assert state.unlocked == ["first_encounter"]
