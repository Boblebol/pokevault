"""Coverage tests for exact badge battle data."""

from __future__ import annotations

from pathlib import Path

from tracker.services.badge_battle_catalog import load_badge_battle_catalog
from tracker.services.badge_service import BADGES

CATALOG_PATH = Path("data/badge-battles.json")


def _team_badges() -> list[str]:
    return [badge.id for badge in BADGES if badge.required_slug_sets]


def _unique_slug_set(slugs: list[str]) -> frozenset[str]:
    return frozenset(slugs)


def test_badge_battle_catalog_covers_every_team_badge() -> None:
    catalog = load_badge_battle_catalog(CATALOG_PATH)

    missing = sorted(set(_team_badges()) - set(catalog.badges))

    assert missing == []


def test_badge_battle_catalog_team_slugs_match_badge_requirements() -> None:
    catalog = load_badge_battle_catalog(CATALOG_PATH)
    by_id = {badge.id: badge for badge in BADGES}
    mismatches: list[str] = []

    for badge_id, battle in catalog.badges.items():
        badge = by_id.get(badge_id)
        if badge is None:
            mismatches.append(f"{badge_id}: unknown badge id")
            continue
        allowed_sets = {frozenset(slugs) for slugs in badge.required_slug_sets}
        for encounter in battle.encounters:
            team = _unique_slug_set([member.slug for member in encounter.team])
            if team not in allowed_sets:
                mismatches.append(f"{badge_id}/{encounter.id}: {team!r}")

    assert mismatches == []


def test_badge_battle_catalog_has_exact_levels_and_localized_moves() -> None:
    catalog = load_badge_battle_catalog(CATALOG_PATH)
    missing: list[str] = []

    for badge_id, battle in catalog.badges.items():
        for encounter in battle.encounters:
            for member in encounter.team:
                if not 1 <= member.level <= 100:
                    missing.append(
                        f"{badge_id}/{encounter.id}/{member.slug}: invalid level"
                    )
                if not member.moves:
                    missing.append(f"{badge_id}/{encounter.id}/{member.slug}: no moves")
                for move in member.moves:
                    if not move.fr.strip() or not move.en.strip():
                        missing.append(
                            f"{badge_id}/{encounter.id}/{member.slug}: missing move locale"
                        )

    assert missing == []
