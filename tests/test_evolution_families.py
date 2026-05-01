"""Evolution family data generation."""

from __future__ import annotations

import json
from pathlib import Path

from pokedex.evolution_families import build_family_payload, layout_rows_from_paths

ROOT = Path(__file__).resolve().parents[1]


def test_layout_rows_from_paths_keeps_branching_evolutions_aligned() -> None:
    rows = layout_rows_from_paths(
        [
            [265, 266, 267],
            [265, 268, 269],
        ],
    )

    assert rows == [
        [265, 266, 267],
        [None, 268, 269],
    ]


def test_build_family_payload_maps_chain_numbers_to_local_slugs() -> None:
    pokedex = {
        "pokemon": [
            {"number": "0001", "slug": "0001-bulbasaur", "names": {"fr": "Bulbizarre"}},
            {"number": "0002", "slug": "0002-ivysaur", "names": {"fr": "Herbizarre"}},
            {"number": "0003", "slug": "0003-venusaur", "names": {"fr": "Florizarre"}},
            {"number": "0133", "slug": "0133-eevee", "names": {"fr": "Evoli"}},
            {"number": "0134", "slug": "0134-vaporeon", "names": {"fr": "Aquali"}},
            {"number": "0135", "slug": "0135-jolteon", "names": {"fr": "Voltali"}},
        ],
    }
    chains = [
        {
            "id": 1,
            "paths": [[1, 2, 3]],
        },
        {
            "id": 67,
            "paths": [[133, 134], [133, 135]],
        },
    ]

    payload = build_family_payload(pokedex, chains, generated_at="2026-05-01T12:00:00Z")

    assert payload["version"] == 1
    assert payload["family_count"] == 2
    assert payload["families"][0]["layout_rows"] == [
        ["0001-bulbasaur", "0002-ivysaur", "0003-venusaur"],
    ]
    assert payload["families"][1]["layout_rows"] == [
        ["0133-eevee", "0134-vaporeon"],
        [None, "0135-jolteon"],
    ]


def test_build_family_payload_applies_manual_layout_overrides() -> None:
    pokedex = {
        "pokemon": [
            {"number": "0133", "slug": "0133-eevee", "names": {"fr": "Evoli"}},
            {"number": "0134", "slug": "0134-vaporeon", "names": {"fr": "Aquali"}},
            {"number": "0135", "slug": "0135-jolteon", "names": {"fr": "Voltali"}},
        ],
    }
    chains = [{"id": 67, "paths": [[133, 134], [133, 135]]}]

    payload = build_family_payload(
        pokedex,
        chains,
        generated_at="2026-05-01T12:00:00Z",
        overrides={
            "families": {
                "0133-eevee": {
                    "label_fr": "Famille evolitions",
                    "layout_rows": [["0133-eevee", "0134-vaporeon", "0135-jolteon"]],
                }
            }
        },
    )

    assert payload["families"][0]["label_fr"] == "Famille evolitions"
    assert payload["families"][0]["layout_rows"] == [
        ["0133-eevee", "0134-vaporeon", "0135-jolteon"],
    ]


def test_versioned_evolution_family_data_covers_the_local_pokedex() -> None:
    payload = json.loads((ROOT / "data" / "evolution-families.json").read_text(encoding="utf-8"))
    families = {family["id"]: family for family in payload["families"]}

    assert payload["version"] == 1
    assert payload["pokemon_count"] == 1025
    assert "0133-eevee" in families
    assert [None, "0135-jolteon"] in families["0133-eevee"]["layout_rows"]
    assert [None, "0268-cascoon", "0269-dustox"] in families["0265-wurmple"]["layout_rows"]
