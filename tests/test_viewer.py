"""
tests/test_viewer.py — Tests du viewer (affichage + édition)

Les fixtures sample_pokedex, pikachu, bulbizarre, charizard_mega_x,
capture_rich et pokedex_json_file viennent de conftest.py.
"""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from pokedex.models import Pokemon, PokemonNames
from pokedex.viewer import (
    EDITABLE_FIELDS,
    edit_direct,
    edit_interactive,
    form_cell,
    type_badge,
    types_display,
    view_detail,
    view_list,
)

# ── type_badge / types_display ─────────────────────────────────────────────────


class TestTypeBadge:
    def test_returns_string(self):
        assert isinstance(type_badge("Feu"), str)

    def test_contains_type_name(self):
        assert "Feu" in type_badge("Feu")

    def test_unknown_type_falls_back(self):
        badge = type_badge("TypeInexistant")
        assert "TypeInexistant" in badge

    def test_known_types_have_rich_markup(self):
        for t in ("Feu", "Eau", "Plante", "Électrik", "Dragon"):
            assert "[" in type_badge(t)


class TestFormCellZarbi:
    def test_zarbi_lettre_form_cell(self):
        p = Pokemon(
            number="0201",
            slug="0201-unown-q",
            names=PokemonNames(fr="Zarbi Q", en="Unown Q"),
            types=["Psy"],
        )
        assert form_cell(p) == "Zarbi lettre"

    def test_zarbi_lettre_list_truncates_column(self, capture_rich):
        """La colonne Forme du tableau Rich est étroite ; on vérifie au moins le préfixe affiché."""
        p = Pokemon(
            number="0201",
            slug="0201-unown-q",
            names=PokemonNames(fr="Zarbi Q", en="Unown Q"),
            types=["Psy"],
        )
        out = capture_rich(view_list, [p])
        assert "Zarbi le" in out or "lettre" in out

    def test_zarbi_detail_shows_full_form_label(self, capture_rich):
        p = Pokemon(
            number="0201",
            slug="0201-unown-q",
            names=PokemonNames(fr="Zarbi Q", en="Unown Q"),
            types=["Psy"],
        )
        out = capture_rich(view_detail, p)
        assert "Zarbi lettre" in out


class TestTypesDisplay:
    def test_single_type(self):
        assert "Feu" in types_display(["Feu"])

    def test_dual_type(self):
        result = types_display(["Plante", "Poison"])
        assert "Plante" in result
        assert "Poison" in result

    def test_empty_list(self):
        assert types_display([]) == ""


# ── view_list ──────────────────────────────────────────────────────────────────


class TestViewList:
    def test_no_exception(self, capture_rich, sample_pokedex):
        capture_rich(view_list, sample_pokedex.pokemon)

    def test_empty_list_no_exception(self, capture_rich):
        capture_rich(view_list, [])

    def test_output_contains_fr_names(self, capture_rich, sample_pokedex):
        output = capture_rich(view_list, sample_pokedex.pokemon)
        assert "Bulbizarre" in output
        assert "Pikachu" in output

    def test_output_contains_number(self, capture_rich, sample_pokedex):
        output = capture_rich(view_list, sample_pokedex.pokemon)
        assert "0001" in output

    def test_form_displayed(self, capture_rich, charizard_mega_x):
        output = capture_rich(view_list, [charizard_mega_x])
        assert "Méga X" in output

    def test_entry_count_in_footer(self, capture_rich, small_pokedex):
        output = capture_rich(view_list, small_pokedex.pokemon)
        assert "2" in output

    def test_region_column_present(self, capture_rich, sample_pokedex):
        output = capture_rich(view_list, sample_pokedex.pokemon)
        lo = output.lower()
        assert "alola" in lo or "kanto" in lo


# ── view_detail ────────────────────────────────────────────────────────────────


class TestViewDetail:
    def test_no_exception(self, capture_rich, pikachu):
        capture_rich(view_detail, pikachu)

    def test_output_contains_fr_name(self, capture_rich, pikachu):
        assert "Pikachu" in capture_rich(view_detail, pikachu)

    def test_output_contains_number(self, capture_rich, pikachu):
        assert "0025" in capture_rich(view_detail, pikachu)

    def test_output_contains_type(self, capture_rich, pikachu):
        assert "Électrik" in capture_rich(view_detail, pikachu)

    def test_form_shown_when_set(self, capture_rich, charizard_mega_x):
        assert "Méga X" in capture_rich(view_detail, charizard_mega_x)

    def test_no_image_message(self, capture_rich, pikachu):
        assert "non disponible" in capture_rich(view_detail, pikachu)

    def test_multilingual_names_shown(self, capture_rich, bulbizarre):
        output = capture_rich(view_detail, bulbizarre)
        assert "Bulbizarre" in output
        assert "Bulbasaur" in output
        assert "フシギダネ" in output

    def test_detail_shows_region(self, capture_rich, bulbizarre):
        output = capture_rich(view_detail, bulbizarre)
        assert "Région" in output
        assert "kanto" in output.lower()

    def test_detail_shows_region_dex_line(self, capture_rich, bulbizarre):
        output = capture_rich(view_detail, bulbizarre)
        assert "dex" in output.lower()

    def test_detail_foreign_region_note(self, capture_rich, meowth_alola):
        output = capture_rich(view_detail, meowth_alola)
        assert "importée" in output.lower() or "Alola" in output


# ── edit_direct ────────────────────────────────────────────────────────────────


class TestEditDirect:
    def test_updates_simple_field(self, sample_pokedex, pokedex_json_file):
        edit_direct(sample_pokedex, "0025-pikachu", "form", "Méga", pokedex_json_file)
        pikachu = next(p for p in sample_pokedex.pokemon if p.slug == "0025-pikachu")
        assert pikachu.form == "Méga"

    def test_updates_nested_name_fr(self, sample_pokedex, pokedex_json_file):
        edit_direct(
            sample_pokedex, "0001-bulbasaur", "names.fr", "Bulbizarre Modifié", pokedex_json_file
        )
        bulbi = next(p for p in sample_pokedex.pokemon if p.slug == "0001-bulbasaur")
        assert bulbi.names.fr == "Bulbizarre Modifié"

    def test_updates_nested_name_en(self, sample_pokedex, pokedex_json_file):
        edit_direct(sample_pokedex, "0001-bulbasaur", "names.en", "Bulba", pokedex_json_file)
        bulbi = next(p for p in sample_pokedex.pokemon if p.slug == "0001-bulbasaur")
        assert bulbi.names.en == "Bulba"

    def test_updates_types_from_slash_string(self, sample_pokedex, pokedex_json_file):
        edit_direct(sample_pokedex, "0025-pikachu", "types", "Feu/Électrik", pokedex_json_file)
        pikachu = next(p for p in sample_pokedex.pokemon if p.slug == "0025-pikachu")
        assert pikachu.types == ["Feu", "Électrik"]

    def test_types_capped_at_two(self, sample_pokedex, pokedex_json_file):
        edit_direct(sample_pokedex, "0025-pikachu", "types", "Feu/Eau/Plante", pokedex_json_file)
        pikachu = next(p for p in sample_pokedex.pokemon if p.slug == "0025-pikachu")
        assert len(pikachu.types) <= 2

    def test_saves_to_file(self, sample_pokedex, pokedex_json_file):
        edit_direct(sample_pokedex, "0025-pikachu", "form", "TestForm", pokedex_json_file)
        saved = json.loads(pokedex_json_file.read_text())
        pokemon_data = saved.get("pokemon", saved)
        pika = next(p for p in pokemon_data if p["slug"] == "0025-pikachu")
        assert pika["form"] == "TestForm"

    def test_unknown_slug_raises_system_exit(self, sample_pokedex, pokedex_json_file):
        with pytest.raises(SystemExit):
            edit_direct(sample_pokedex, "slug-inexistant", "form", "X", pokedex_json_file)

    def test_empty_value_sets_none(self, sample_pokedex, pokedex_json_file):
        edit_direct(sample_pokedex, "0025-pikachu", "form", "", pokedex_json_file)
        pikachu = next(p for p in sample_pokedex.pokemon if p.slug == "0025-pikachu")
        assert pikachu.form is None

    def test_updates_region_fields(self, sample_pokedex, pokedex_json_file):
        edit_direct(
            sample_pokedex, "0025-pikachu", "region_label_fr", "Test région", pokedex_json_file
        )
        pika = next(p for p in sample_pokedex.pokemon if p.slug == "0025-pikachu")
        assert pika.region_label_fr == "Test région"

    def test_updates_region_native(self, sample_pokedex, pokedex_json_file):
        edit_direct(sample_pokedex, "0025-pikachu", "region_native", "non", pokedex_json_file)
        pika = next(p for p in sample_pokedex.pokemon if p.slug == "0025-pikachu")
        assert pika.region_native is False

    def test_region_native_invalid_raises_exit(self, sample_pokedex, pokedex_json_file):
        with pytest.raises(SystemExit):
            edit_direct(
                sample_pokedex, "0025-pikachu", "region_native", "peut-être", pokedex_json_file
            )


# ── edit_interactive ───────────────────────────────────────────────────────────


class TestEditInteractive:
    def test_cancel_on_empty_input_preserves_data(self, sample_pokedex, pokedex_json_file):
        """Enter sans choix → annulation, données inchangées."""
        original_fr = next(p for p in sample_pokedex.pokemon if p.slug == "0001-bulbasaur").names.fr

        with patch("pokedex.viewer.Prompt.ask", return_value=""):
            edit_interactive(sample_pokedex, "0001-bulbasaur", pokedex_json_file)

        current_fr = next(p for p in sample_pokedex.pokemon if p.slug == "0001-bulbasaur").names.fr
        assert current_fr == original_fr

    def test_unknown_slug_raises_system_exit(self, sample_pokedex, pokedex_json_file):
        with pytest.raises(SystemExit):
            edit_interactive(sample_pokedex, "slug-inexistant", pokedex_json_file)

    def test_all_editable_fields_documented(self):
        expected = {
            "names.fr",
            "names.en",
            "names.ja",
            "types",
            "form",
            "image",
            "region",
            "region_label_fr",
            "region_dex",
            "region_native",
        }
        assert set(EDITABLE_FIELDS.keys()) == expected
