"""pokedex.regions — tranches nationales et formes régionales."""

from __future__ import annotations

import pytest

from pokedex.regions import (
    NATIONAL_REGIONS,
    attach_region_fields,
    filter_pokemon_by_region,
    form_override_region_id,
    national_int,
    pokemon_effective_region_id,
    region_from_national,
    regions_meta_json,
)


@pytest.mark.parametrize(
    ("n", "expected_id"),
    [
        (1, "kanto"),
        (151, "kanto"),
        (152, "johto"),
        (251, "johto"),
        (386, "hoenn"),
        (493, "sinnoh"),
        (649, "unys"),
        (721, "kalos"),
        (722, "alola"),
        (807, "alola"),
        (808, "meltan"),
        (809, "meltan"),
        (810, "galar"),
        (898, "galar"),
        (899, "hisui"),
        (905, "hisui"),
        (906, "paldea"),
        (1025, "paldea"),
    ],
)
def test_region_from_national(n: int, expected_id: str) -> None:
    assert region_from_national(n).id == expected_id


def test_rattata_alola_foreign() -> None:
    d = attach_region_fields(
        "0019",
        {"fr": "Rattata d'Alola"},
        "d'Alola",
    )
    assert d["region"] == "alola"
    assert d["region_dex"] == "kanto"
    assert d["region_native"] is False


def test_meowth_alola_same() -> None:
    d = attach_region_fields(
        "0052",
        {"fr": "Miaouss d'Alola"},
        "d'Alola",
    )
    assert d["region"] == "alola"
    assert d["region_dex"] == "kanto"
    assert d["region_native"] is False


def test_rowlet_native_alola() -> None:
    d = attach_region_fields("0722", {"fr": "Brindibou"}, None)
    assert d["region"] == "alola"
    assert d["region_dex"] == "alola"
    assert d["region_native"] is True


def test_meltan_native_block() -> None:
    d = attach_region_fields("0808", {"fr": "Meltan"}, None)
    assert d["region"] == "meltan"
    assert d["region_native"] is True


def test_form_override_galar() -> None:
    d = attach_region_fields(
        "0052",
        {"fr": "Miaouss de Galar"},
        "de Galar",
    )
    assert d["region"] == "galar"
    assert d["region_dex"] == "kanto"
    assert d["region_native"] is False


def test_apostrophe_typographique() -> None:
    assert form_override_region_id("Rattata d\u2019Alola", None) == "alola"


def test_national_int() -> None:
    assert national_int("0001") == 1
    assert national_int("#0151") == 151


def test_regions_meta_covers_all_ids() -> None:
    meta = regions_meta_json()
    assert len(meta) == len(NATIONAL_REGIONS)
    assert {m["id"] for m in meta} == {r.id for r in NATIONAL_REGIONS}


def test_filter_pokemon_by_region_all_returns_same(meowth_alola, bulbizarre) -> None:
    lst = [meowth_alola, bulbizarre]
    assert filter_pokemon_by_region(lst, None) == lst
    assert filter_pokemon_by_region(lst, "all") == lst
    assert filter_pokemon_by_region(lst, "") == lst


def test_filter_pokemon_by_region_alola(meowth_alola, bulbizarre) -> None:
    lst = [meowth_alola, bulbizarre]
    al = filter_pokemon_by_region(lst, "alola")
    assert len(al) == 1
    assert al[0].slug == "0052-meowth-alola"


def test_pokemon_effective_region_id_uses_field_when_set(meowth_alola) -> None:
    assert pokemon_effective_region_id(meowth_alola) == "alola"


def test_filter_none_keyword(meowth_alola) -> None:
    assert filter_pokemon_by_region([meowth_alola], "none") == [meowth_alola]
