"""Coverage tests for exact badge battle data."""

from __future__ import annotations

from collections import Counter
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


def test_badge_battle_catalog_preserves_duplicate_species_send_outs() -> None:
    catalog = load_badge_battle_catalog(CATALOG_PATH)

    team = [member.slug for member in catalog.badges["kanto_koga"].encounters[0].team]

    assert team == [
        "0109-koffing",
        "0109-koffing",
        "0089-muk",
        "0110-weezing",
    ]
    assert Counter(team)["0109-koffing"] == 2


def test_xy_rival_metadata_and_variants_identify_both_rivals() -> None:
    catalog = load_badge_battle_catalog(CATALOG_PATH)
    battle = catalog.badges["xy_rival"]

    assert battle.trainer.name.en == "Calem / Serena"

    expected = {
        "calem-x-y-chespin": ("X / Y - Calem - Chespin", "calem-chespin"),
        "calem-x-y-fennekin": ("X / Y - Calem - Fennekin", "calem-fennekin"),
        "calem-x-y-froakie": ("X / Y - Calem - Froakie", "calem-froakie"),
        "serena-x-y-chespin": ("X / Y - Serena - Chespin", "serena-chespin"),
        "serena-x-y-fennekin": ("X / Y - Serena - Fennekin", "serena-fennekin"),
        "serena-x-y-froakie": ("X / Y - Serena - Froakie", "serena-froakie"),
    }

    actual = {
        encounter.id: (encounter.label.en, encounter.variant.value)
        for encounter in battle.encounters
    }

    assert actual == expected


def test_bw_opelucid_metadata_identifies_both_version_leaders() -> None:
    catalog = load_badge_battle_catalog(CATALOG_PATH)
    battle = catalog.badges["bw_opelucid"]

    assert battle.trainer.name.en == "Drayden / Iris"
    assert battle.encounters[0].label.en == "Black / White - Drayden / Iris"


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
