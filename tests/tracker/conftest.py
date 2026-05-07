"""Fixtures communes pour le package tracker."""

from __future__ import annotations

from typing import Any

import pytest

from tracker.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def brock_battle_catalog_data() -> dict[str, Any]:
    return {
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
