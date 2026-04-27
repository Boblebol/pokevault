"""
tests/test_models.py — Tests des modèles Pydantic
"""

from datetime import UTC

from pokedex.models import Pokedex, Pokemon, PokemonNames

# ── PokemonNames ───────────────────────────────────────────────────────────────


class TestPokemonNames:
    def test_display_prefers_fr(self):
        names = PokemonNames(fr="Bulbizarre", en="Bulbasaur", ja="フシギダネ")
        assert names.display() == "Bulbizarre"

    def test_display_falls_back_to_en(self):
        names = PokemonNames(fr=None, en="Bulbasaur")
        assert names.display() == "Bulbasaur"

    def test_display_falls_back_to_ja(self):
        names = PokemonNames(ja="フシギダネ")
        assert names.display() == "フシギダネ"

    def test_display_returns_question_mark_when_empty(self):
        names = PokemonNames()
        assert names.display() == "?"

    def test_all_names_excludes_none(self):
        names = PokemonNames(fr="Bulbizarre", en=None, ja="フシギダネ")
        result = names.all_names()
        assert result == {"fr": "Bulbizarre", "ja": "フシギダネ"}
        assert "en" not in result

    def test_all_names_empty(self):
        assert PokemonNames().all_names() == {}


# ── Pokemon ────────────────────────────────────────────────────────────────────


class TestPokemon:
    def _make(self, **kwargs) -> Pokemon:
        defaults = {
            "number": "001",
            "slug": "0001-bulbasaur",
            "names": PokemonNames(fr="Bulbizarre", en="Bulbasaur"),
            "types": ["Plante", "Poison"],
        }
        defaults.update(kwargs)
        return Pokemon(**defaults)

    def test_number_is_zero_padded(self):
        p = self._make(number="1")
        assert p.number == "0001"

    def test_number_already_padded_unchanged(self):
        p = self._make(number="0025")
        assert p.number == "0025"

    def test_types_str_default_separator(self):
        p = self._make(types=["Feu", "Vol"])
        assert p.types_str() == "Feu/Vol"

    def test_types_str_custom_separator(self):
        p = self._make(types=["Feu", "Vol"])
        assert p.types_str(" · ") == "Feu · Vol"

    def test_types_str_single_type(self):
        p = self._make(types=["Feu"])
        assert p.types_str() == "Feu"

    def test_has_image_false_when_none(self):
        p = self._make(image=None)
        assert p.has_image() is False

    def test_has_image_false_when_file_missing(self, tmp_path):
        p = self._make(image=str(tmp_path / "missing.png"))
        assert p.has_image() is False

    def test_has_image_true_when_file_exists(self, tmp_path):
        img = tmp_path / "001.png"
        img.write_bytes(b"\x89PNG")
        p = self._make(image=str(img))
        assert p.has_image() is True

    def test_form_defaults_to_none(self):
        p = self._make()
        assert p.form is None

    def test_form_stored(self):
        p = self._make(form="Méga X")
        assert p.form == "Méga X"


def test_meowth_alola_region_from_fixture(meowth_alola) -> None:
    assert meowth_alola.region == "alola"
    assert meowth_alola.region_dex == "kanto"
    assert meowth_alola.region_native is False


def test_pokedex_by_region(sample_pokedex) -> None:
    al = sample_pokedex.by_region("alola")
    assert len(al) == 1
    assert al[0].slug == "0052-meowth-alola"
    assert len(sample_pokedex.by_region("all")) == len(sample_pokedex.pokemon)


# ── Pokedex ────────────────────────────────────────────────────────────────────


def _make_pokedex(n: int = 3) -> Pokedex:
    types_pool = [["Feu"], ["Eau"], ["Plante", "Poison"]]
    pokemon = [
        Pokemon(
            number=str(i).zfill(3),
            slug=f"{str(i).zfill(4)}-pokemon-{i}",
            names=PokemonNames(fr=f"Pokémon {i}", en=f"Pokemon {i}"),
            types=types_pool[i % len(types_pool)],
        )
        for i in range(1, n + 1)
    ]
    return Pokedex(pokemon=pokemon)


class TestPokedex:
    def test_total_is_set_automatically(self):
        dex = _make_pokedex(5)
        assert dex.total == 5

    def test_total_updates_on_creation(self):
        dex = Pokedex(pokemon=[])
        assert dex.total == 0

    def test_generated_at_is_utc(self):
        dex = _make_pokedex(1)
        assert dex.generated_at.tzinfo == UTC

    def test_by_number_found(self):
        dex = _make_pokedex(3)
        results = dex.by_number("1")
        assert len(results) == 1
        assert results[0].number == "0001"

    def test_by_number_padded_or_not(self):
        dex = _make_pokedex(3)
        assert dex.by_number("001") == dex.by_number("0001")

    def test_by_number_multiple_forms(self):
        """Deux entrées avec le même numéro (ex: formes Méga)."""
        p1 = Pokemon(
            number="0006",
            slug="0006-charizard",
            names=PokemonNames(fr="Dracaufeu"),
            types=["Feu", "Vol"],
        )
        p2 = Pokemon(
            number="0006",
            slug="0006-charizard-mega-x",
            names=PokemonNames(fr="Dracaufeu Méga X"),
            types=["Feu", "Dragon"],
            form="Méga X",
        )
        dex = Pokedex(pokemon=[p1, p2])
        results = dex.by_number("6")
        assert len(results) == 2

    def test_by_number_not_found(self):
        dex = _make_pokedex(3)
        assert dex.by_number("999") == []

    def test_by_type_found(self):
        dex = _make_pokedex(3)
        results = dex.by_type("Feu")
        assert all("Feu" in p.types for p in results)
        assert len(results) >= 1

    def test_by_type_case_insensitive(self):
        dex = _make_pokedex(3)
        assert dex.by_type("feu") == dex.by_type("Feu")

    def test_by_type_not_found(self):
        dex = _make_pokedex(3)
        assert dex.by_type("Spectre") == []

    def test_search_by_fr_name(self):
        dex = _make_pokedex(3)
        results = dex.search("Pokémon 1")
        assert len(results) == 1

    def test_search_case_insensitive(self):
        dex = _make_pokedex(3)
        assert dex.search("pokémon 1") == dex.search("Pokémon 1")

    def test_search_by_slug(self):
        dex = _make_pokedex(3)
        results = dex.search("pokemon-2")
        assert len(results) == 1

    def test_search_no_results(self):
        dex = _make_pokedex(3)
        assert dex.search("pikachu") == []

    def test_update_simple_field(self):
        dex = _make_pokedex(2)
        slug = dex.pokemon[0].slug
        ok = dex.update_pokemon(slug, form="Méga")
        assert ok is True
        assert dex.pokemon[0].form == "Méga"

    def test_update_nested_field(self):
        dex = _make_pokedex(2)
        slug = dex.pokemon[0].slug
        ok = dex.update_pokemon(slug, **{"names.fr": "Nouveau nom"})
        assert ok is True
        assert dex.pokemon[0].names.fr == "Nouveau nom"

    def test_update_returns_false_when_not_found(self):
        dex = _make_pokedex(2)
        ok = dex.update_pokemon("slug-inexistant", form="X")
        assert ok is False


class TestPokedexByRegion:
    def test_by_region_none_is_no_filter(self, sample_pokedex):
        assert len(sample_pokedex.by_region(None)) == len(sample_pokedex.pokemon)

    def test_by_region_all_is_no_filter(self, sample_pokedex):
        assert len(sample_pokedex.by_region("all")) == len(sample_pokedex.pokemon)

    def test_by_region_alola_contains_meowth_alola(self, sample_pokedex):
        al = sample_pokedex.by_region("alola")
        slugs = {p.slug for p in al}
        assert "0052-meowth-alola" in slugs

    def test_by_region_kanto_excludes_alola_form(self, sample_pokedex):
        kt = sample_pokedex.by_region("kanto")
        slugs = {p.slug for p in kt}
        assert "0052-meowth-alola" not in slugs
