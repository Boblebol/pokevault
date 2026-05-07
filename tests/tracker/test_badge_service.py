"""tracker.services.badge_service (roadmap F12)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from tracker.badge_battle_models import BadgeBattleCatalog
from tracker.models import ProgressStatusPatch
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.badge_presentation import presentation_for_badge
from tracker.services.badge_service import BADGES, BadgeService, _metric_value
from tracker.services.progress_service import ProgressService


def _wire(tmp_path: Path) -> tuple[BadgeService, ProgressService]:
    progress_repo = JsonProgressRepository(tmp_path / "progress.json")
    progress_service = ProgressService(progress_repo)
    badge_service = BadgeService(progress_repo)
    return badge_service, progress_service


def _catch_all(progress: ProgressService, slugs: list[str]) -> None:
    for slug in slugs:
        progress.patch_status(ProgressStatusPatch(slug=slug, state="caught"))


def test_badge_battle_catalog_accepts_exact_battle_metadata() -> None:
    catalog = BadgeBattleCatalog.model_validate(
        {
            "version": 1,
            "badges": {
                "kanto_brock": {
                    "trainer": {
                        "name": {"fr": "Pierre", "en": "Brock"},
                        "role": {"fr": "Champion d'Arène", "en": "Gym Leader"},
                        "history": {
                            "fr": "Champion d'Argenta, spécialiste des Pokémon Roche.",
                            "en": "Pewter City's Gym Leader, specializing in Rock-type Pokemon.",
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
                                    "moves": [
                                        {"fr": "Charge", "en": "Tackle"},
                                        {"fr": "Boul'Armure", "en": "Defense Curl"},
                                    ],
                                }
                            ],
                        }
                    ],
                }
            },
        }
    )

    battle = catalog.badges["kanto_brock"]
    assert battle.trainer.name.fr == "Pierre"
    assert battle.location.city.en == "Pewter City"
    assert battle.encounters[0].team[0].moves[1].en == "Defense Curl"


def test_badge_battle_catalog_rejects_empty_encounters() -> None:
    with pytest.raises(ValidationError, match="encounters"):
        BadgeBattleCatalog.model_validate(
            {
                "version": 1,
                "badges": {
                    "kanto_brock": {
                        "trainer": {
                            "name": {"fr": "Pierre", "en": "Brock"},
                            "role": {"fr": "Champion d'Arène", "en": "Gym Leader"},
                            "history": {"fr": "Histoire", "en": "History"},
                        },
                        "location": {
                            "region": "kanto",
                            "city": {"fr": "Argenta", "en": "Pewter City"},
                            "place": {"fr": "Arène", "en": "Gym"},
                        },
                        "encounters": [],
                    }
                },
            }
        )


def test_catalog_exposes_all_definitions(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)
    state = badge_service.state()
    assert len(state.catalog) == len(BADGES)
    assert {b.id for b in state.catalog} == {b.id for b in BADGES}
    assert "first_encounter" not in {b.id for b in state.catalog}
    assert "first_shiny" not in {b.id for b in state.catalog}
    assert "shiny_ten" not in {b.id for b in state.catalog}
    assert "first_card" not in {b.id for b in state.catalog}
    assert "hundred_cards" not in {b.id for b in state.catalog}
    assert "first_catch" in {b.id for b in state.catalog}
    assert all(not b.unlocked for b in state.catalog)
    assert state.unlocked == []


def test_catalog_exposes_progress_metadata(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    for i in range(1, 4):
        progress.patch_status(
            ProgressStatusPatch(slug=f"slug-{i:04d}", state="caught")
        )

    state = badge_service.state()

    by_id = {b.id: b for b in state.catalog}
    assert by_id["century"].current == 3
    assert by_id["century"].target == 100
    assert by_id["century"].percent == 3
    assert by_id["century"].hint == "Encore 97 Pokémon à attraper."


def test_catalog_exposes_badge_presentation_metadata(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    brock = by_id["kanto_brock"]
    assert brock.category == "gym"
    assert brock.region == "kanto"
    assert brock.rarity == "rare"
    assert brock.effect == "gloss"
    assert brock.reveal == "mystery"
    assert brock.i18n["fr"].mystery_title
    assert brock.i18n["en"].mystery_title
    assert "Brock" in brock.i18n["en"].title
    assert "Capture" in brock.i18n["en"].description

    champion = by_id["kanto_rival_champion"]
    assert champion.category == "rival"
    assert champion.rarity == "legendary"
    assert champion.effect == "rival"

    first_catch = by_id["first_catch"]
    assert first_catch.category == "milestone"
    assert first_catch.region == "global"
    assert first_catch.reveal == "transparent"


def test_team_badge_english_copy_handles_non_trainer_ids(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    opelucid = by_id["bw_opelucid"].i18n["en"]
    assert opelucid.title == "Drayden/Iris - Badge"
    assert opelucid.description == (
        "Capture Drayden/Iris's team in Pokemon Black/White."
    )

    elite_larry = by_id["sv_elite_larry"].i18n["en"]
    assert elite_larry.title == "Larry - Elite Four Badge"


def test_every_badge_has_required_presentation_copy(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)

    missing: list[str] = []
    for badge in badge_service.state().catalog:
        if badge.category not in {
            "milestone",
            "gym",
            "elite_four",
            "champion",
            "rival",
        }:
            missing.append(f"{badge.id}: category={badge.category!r}")
        if badge.rarity not in {"common", "rare", "epic", "legendary"}:
            missing.append(f"{badge.id}: rarity={badge.rarity!r}")
        if badge.effect not in {"metal", "gloss", "prism", "holo", "rival"}:
            missing.append(f"{badge.id}: effect={badge.effect!r}")
        for locale in ("fr", "en"):
            copy = badge.i18n.get(locale)
            if copy is None:
                missing.append(f"{badge.id}: missing {locale}")
                continue
            if not copy.title.strip():
                missing.append(f"{badge.id}: missing {locale}.title")
            if not copy.description.strip():
                missing.append(f"{badge.id}: missing {locale}.description")
            if badge.reveal == "mystery" and not copy.mystery_title.strip():
                missing.append(f"{badge.id}: missing {locale}.mystery_title")

    assert missing == []


def test_badge_presentation_defaults_unknown_team_prefix_to_global() -> None:
    presentation = presentation_for_badge(
        "custom_secret",
        "Secret - Badge",
        "Capturer une equipe secrete.",
        "team",
    )

    assert presentation.region == "global"
    assert presentation.i18n["en"]["description"] == (
        "Capture Custom Secret's mystery team."
    )
    assert presentation.i18n["en"]["mystery_hint"] == (
        "A mystery team is waiting to be rebuilt."
    )


def test_unlocked_badge_progress_stays_complete_if_source_drops(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="caught"))
    badge_service.sync_unlocked()
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="not_met"))

    state = badge_service.state()

    first_catch = {b.id: b for b in state.catalog}["first_catch"]
    assert first_catch.unlocked is True
    assert first_catch.current == 1
    assert first_catch.target == 1
    assert first_catch.percent == 100


def test_sync_does_not_unlock_first_encounter_when_something_seen(
    tmp_path: Path,
) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="seen"))
    newly = badge_service.sync_unlocked()
    state = badge_service.state()
    assert newly == []
    assert "first_encounter" not in {badge.id for badge in state.catalog}
    assert "first_catch" in {badge.id for badge in state.catalog}
    assert state.unlocked == []


def test_sync_unlocks_first_catch_only(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(
        ProgressStatusPatch(slug="0025-pikachu", state="caught", shiny=True)
    )
    newly = set(badge_service.sync_unlocked())
    assert "first_encounter" not in newly
    assert newly == {"first_catch"}


def test_unlocks_are_monotonic_even_if_progress_drops(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="caught"))
    badge_service.sync_unlocked()
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="not_met"))
    state = badge_service.state()
    ids = {b.id for b in state.catalog if b.unlocked}
    assert "first_catch" in ids


def test_sync_unlocks_threshold_badges(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    for i in range(1, 101):
        progress.patch_status(
            ProgressStatusPatch(slug=f"slug-{i:04d}", state="caught")
        )
    newly = set(badge_service.sync_unlocked())
    assert "century" in newly
    assert "thousand" not in newly


def test_state_reports_unlocked_on_catalog_entries(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0025-pikachu", state="caught"))
    badge_service.sync_unlocked()
    state = badge_service.state()
    by_id = {b.id: b for b in state.catalog}
    assert "first_encounter" not in by_id
    assert by_id["first_catch"].unlocked is True
    assert state.unlocked == ["first_catch"]


def test_state_filters_and_persists_removed_legacy_unlocked_badges(
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
    progress_repo = JsonProgressRepository(progress_path)
    badge_service = BadgeService(progress_repo)

    state = badge_service.state()

    by_id = {b.id: b for b in state.catalog}
    assert "first_encounter" not in by_id
    assert state.unlocked == ["first_catch"]
    assert by_id["first_catch"].unlocked is True
    assert progress_repo.load().badges_unlocked == ["first_catch"]


def test_metric_value_rejects_unknown_metric(tmp_path: Path) -> None:
    _, progress = _wire(tmp_path)

    with pytest.raises(ValueError, match="Unknown badge metric"):
        _metric_value("unknown", progress.get_progress())


def test_kanto_badges_are_in_catalog(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)

    ids = {badge.id for badge in badge_service.state().catalog}

    assert {
        "kanto_brock",
        "kanto_misty",
        "kanto_lt_surge",
        "kanto_erika",
        "kanto_koga",
        "kanto_sabrina",
        "kanto_blaine",
        "kanto_giovanni",
        "kanto_lorelei",
        "kanto_bruno",
        "kanto_agatha",
        "kanto_lance",
        "kanto_rival_champion",
    } <= ids


def test_kanto_gym_badge_requires_full_caught_team(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0074-geodude", state="caught"))

    state = badge_service.state()
    by_id = {badge.id: badge for badge in state.catalog}

    assert by_id["kanto_brock"].unlocked is False
    assert by_id["kanto_brock"].current == 1
    assert by_id["kanto_brock"].target == 2
    assert by_id["kanto_brock"].hint == "Encore 1 Pokemon de l'equipe à capturer."

    progress.patch_status(ProgressStatusPatch(slug="0095-onix", state="caught"))
    newly = badge_service.sync_unlocked()

    assert "kanto_brock" in newly


def test_team_badge_exposes_required_pokemon_with_caught_state(
    tmp_path: Path,
) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0074-geodude", state="caught"))

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert [
        (requirement.slug, requirement.caught)
        for requirement in by_id["kanto_brock"].requirements
    ] == [
        ("0074-geodude", True),
        ("0095-onix", False),
    ]


def test_kanto_team_badges_count_duplicate_species_once(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(progress, ["0109-koffing", "0089-muk"])

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["kanto_koga"].unlocked is False
    assert by_id["kanto_koga"].current == 2
    assert by_id["kanto_koga"].target == 3

    progress.patch_status(ProgressStatusPatch(slug="0110-weezing", state="caught"))

    assert "kanto_koga" in badge_service.sync_unlocked()


def test_kanto_rival_badge_unlocks_with_any_final_team_variant(
    tmp_path: Path,
) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(
        progress,
        [
            "0018-pidgeot",
            "0065-alakazam",
            "0112-rhydon",
            "0059-arcanine",
            "0103-exeggutor",
            "0009-blastoise",
        ],
    )

    newly = set(badge_service.sync_unlocked())

    assert "kanto_rival_champion" in newly


def test_kanto_rival_progress_uses_closest_variant(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(
        progress,
        [
            "0018-pidgeot",
            "0065-alakazam",
            "0112-rhydon",
            "0059-arcanine",
            "0103-exeggutor",
        ],
    )

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["kanto_rival_champion"].current == 5
    assert by_id["kanto_rival_champion"].target == 6
    assert by_id["kanto_rival_champion"].percent == 83


def test_kanto_trainer_unlocks_are_monotonic(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(progress, ["0074-geodude", "0095-onix"])
    badge_service.sync_unlocked()
    progress.patch_status(ProgressStatusPatch(slug="0095-onix", state="not_met"))

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["kanto_brock"].unlocked is True
    assert by_id["kanto_brock"].current == 2
    assert by_id["kanto_brock"].target == 2
    assert by_id["kanto_brock"].percent == 100


def test_gold_silver_badges_are_in_catalog(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)

    ids = {badge.id for badge in badge_service.state().catalog}

    assert {
        "gs_falkner",
        "gs_bugsy",
        "gs_whitney",
        "gs_morty",
        "gs_chuck",
        "gs_jasmine",
        "gs_pryce",
        "gs_clair",
        "gs_brock",
        "gs_misty",
        "gs_lt_surge",
        "gs_erika",
        "gs_janine",
        "gs_sabrina",
        "gs_blaine",
        "gs_blue",
        "gs_will",
        "gs_koga",
        "gs_bruno",
        "gs_karen",
        "gs_lance",
        "gs_rival_silver",
    } <= ids


def test_gold_silver_johto_gym_badge_requires_full_caught_team(
    tmp_path: Path,
) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0016-pidgey", state="caught"))

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["gs_falkner"].unlocked is False
    assert by_id["gs_falkner"].current == 1
    assert by_id["gs_falkner"].target == 2

    progress.patch_status(ProgressStatusPatch(slug="0017-pidgeotto", state="caught"))

    assert "gs_falkner" in badge_service.sync_unlocked()


def test_gold_silver_kanto_badge_uses_gold_silver_team(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(progress, ["0074-geodude", "0095-onix"])

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["kanto_brock"].current == 2
    assert by_id["kanto_brock"].target == 2
    assert by_id["gs_brock"].unlocked is False
    assert by_id["gs_brock"].current == 1
    assert by_id["gs_brock"].target == 5

    _catch_all(
        progress,
        ["0075-graveler", "0111-rhyhorn", "0139-omastar", "0141-kabutops"],
    )

    assert "gs_brock" in badge_service.sync_unlocked()


def test_gold_silver_lance_counts_duplicate_dragonite_once(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(progress, ["0130-gyarados", "0006-charizard", "0142-aerodactyl"])

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["gs_lance"].unlocked is False
    assert by_id["gs_lance"].current == 3
    assert by_id["gs_lance"].target == 4

    progress.patch_status(ProgressStatusPatch(slug="0149-dragonite", state="caught"))

    assert "gs_lance" in badge_service.sync_unlocked()


def test_gold_silver_rival_badge_unlocks_with_any_rematch_variant(
    tmp_path: Path,
) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(
        progress,
        [
            "0215-sneasel",
            "0169-crobat",
            "0082-magneton",
            "0094-gengar",
            "0065-alakazam",
            "0157-typhlosion",
        ],
    )

    newly = set(badge_service.sync_unlocked())

    assert "gs_rival_silver" in newly


def test_gold_silver_rival_progress_uses_closest_variant(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(
        progress,
        [
            "0215-sneasel",
            "0169-crobat",
            "0082-magneton",
            "0094-gengar",
            "0065-alakazam",
        ],
    )

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["gs_rival_silver"].current == 5
    assert by_id["gs_rival_silver"].target == 6
    assert by_id["gs_rival_silver"].percent == 83


def test_base_generation_badges_are_in_catalog(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)

    ids = {badge.id for badge in badge_service.state().catalog}

    assert {
        "rs_roxanne",
        "rs_steven",
        "rs_wally",
        "dp_roark",
        "dp_cynthia",
        "dp_rival_barry",
        "bw_trio_badge",
        "bw_alder",
        "bw_n",
        "b2w2_cheren",
        "b2w2_iris",
        "b2w2_hugh",
        "xy_viola",
        "xy_diantha",
        "xy_rival",
        "sm_hala",
        "sm_kukui",
        "sm_hau",
        "swsh_milo",
        "swsh_leon",
        "swsh_hop",
        "sv_katy",
        "sv_geeta",
        "sv_nemona",
    } <= ids


def test_ruby_sapphire_gym_badge_requires_full_caught_team(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0074-geodude", state="caught"))

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["rs_roxanne"].unlocked is False
    assert by_id["rs_roxanne"].current == 1
    assert by_id["rs_roxanne"].target == 2

    progress.patch_status(ProgressStatusPatch(slug="0299-nosepass", state="caught"))

    assert "rs_roxanne" in badge_service.sync_unlocked()


def test_ruby_sapphire_badges_count_duplicate_species_once(tmp_path: Path) -> None:
    badge_service, progress = _wire(tmp_path)
    progress.patch_status(ProgressStatusPatch(slug="0218-slugma", state="caught"))

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["rs_flannery"].unlocked is False
    assert by_id["rs_flannery"].current == 1
    assert by_id["rs_flannery"].target == 2

    progress.patch_status(ProgressStatusPatch(slug="0324-torkoal", state="caught"))

    assert "rs_flannery" in badge_service.sync_unlocked()


def test_black_white_trio_badge_unlocks_with_any_starter_variant(
    tmp_path: Path,
) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(progress, ["0506-lillipup", "0513-pansear"])

    newly = set(badge_service.sync_unlocked())

    assert "bw_trio_badge" in newly


def test_black_white_n_badge_unlocks_with_either_legendary_variant(
    tmp_path: Path,
) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(
        progress,
        [
            "0644-zekrom",
            "0565-carracosta",
            "0584-vanilluxe",
            "0567-archeops",
            "0571-zoroark",
            "0601-klinklang",
        ],
    )

    assert "bw_n" in set(badge_service.sync_unlocked())

    badge_service, progress = _wire(tmp_path / "white")
    _catch_all(
        progress,
        [
            "0643-reshiram",
            "0565-carracosta",
            "0584-vanilluxe",
            "0567-archeops",
            "0571-zoroark",
            "0601-klinklang",
        ],
    )

    assert "bw_n" in set(badge_service.sync_unlocked())


def test_black_white_2_hugh_badge_uses_closest_starter_variant(
    tmp_path: Path,
) -> None:
    badge_service, progress = _wire(tmp_path)
    _catch_all(
        progress,
        [
            "0521-unfezant",
            "0626-bouffalant",
            "0604-eelektross",
            "0330-flygon",
            "0503-samurott",
        ],
    )

    by_id = {badge.id: badge for badge in badge_service.state().catalog}

    assert by_id["b2w2_hugh"].current == 5
    assert by_id["b2w2_hugh"].target == 6

    progress.patch_status(ProgressStatusPatch(slug="0512-simisage", state="caught"))

    assert "b2w2_hugh" in badge_service.sync_unlocked()
