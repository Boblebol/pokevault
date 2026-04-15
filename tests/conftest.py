"""
tests/conftest.py — Fixtures partagées entre tous les fichiers de test
"""

from __future__ import annotations

from pathlib import Path

import pytest

from pokedex.models import Pokedex, Pokemon, PokemonNames

# ── Fixtures Pokémon individuels ───────────────────────────────────────────────


@pytest.fixture
def bulbizarre() -> Pokemon:
    return Pokemon(
        number="0001",
        slug="0001-bulbasaur",
        names=PokemonNames(fr="Bulbizarre", en="Bulbasaur", ja="フシギダネ"),
        types=["Plante", "Poison"],
    )


@pytest.fixture
def pikachu() -> Pokemon:
    return Pokemon(
        number="0025",
        slug="0025-pikachu",
        names=PokemonNames(fr="Pikachu", en="Pikachu", ja="ピカチュウ"),
        types=["Électrik"],
    )


@pytest.fixture
def charizard_base() -> Pokemon:
    return Pokemon(
        number="0006",
        slug="0006-charizard",
        names=PokemonNames(fr="Dracaufeu", en="Charizard", ja="リザードン"),
        types=["Feu", "Vol"],
    )


@pytest.fixture
def charizard_mega_x() -> Pokemon:
    return Pokemon(
        number="0006",
        slug="0006-charizard-mega-x",
        names=PokemonNames(fr="Dracaufeu Méga X", en="Mega Charizard X"),
        types=["Feu", "Dragon"],
        form="Méga X",
    )


@pytest.fixture
def meowth_alola() -> Pokemon:
    return Pokemon(
        number="0052",
        slug="0052-meowth-alola",
        names=PokemonNames(fr="Miaouss d'Alola", en="Alolan Meowth"),
        types=["Ténèbres"],
        form="d'Alola",
    )


# ── Fixture Pokédex complet ────────────────────────────────────────────────────


@pytest.fixture
def sample_pokedex(bulbizarre, pikachu, charizard_base, charizard_mega_x, meowth_alola) -> Pokedex:
    """Pokédex de test avec 5 entrées dont 2 formes du #006."""
    return Pokedex(pokemon=[bulbizarre, pikachu, charizard_base, charizard_mega_x, meowth_alola])


@pytest.fixture
def small_pokedex(bulbizarre, pikachu) -> Pokedex:
    """Pokédex minimaliste avec 2 Pokémon."""
    return Pokedex(pokemon=[bulbizarre, pikachu])


# ── Fixture HTML Pokepedia ─────────────────────────────────────────────────────


@pytest.fixture
def fixture_html() -> str:
    path = Path(__file__).parent / "fixtures" / "pokepedia_sample.html"
    return path.read_text(encoding="utf-8")


# ── Fixture fichier JSON ───────────────────────────────────────────────────────


@pytest.fixture
def pokedex_json_file(tmp_path, sample_pokedex) -> Path:
    """Crée un fichier data/pokedex.json de test et retourne son chemin."""
    from pokedex.exporters import export_json

    path = tmp_path / "data" / "pokedex.json"
    export_json(sample_pokedex, path)
    return path


# ── Helper Rich capture ────────────────────────────────────────────────────────


@pytest.fixture
def capture_rich():
    """
    Fixture qui retourne une fonction `capture(fn, *args)` pour capturer
    la sortie du console module-level de pokedex.viewer.
    """
    from rich.console import Console as _Console

    import pokedex.viewer as viewer_mod

    def _capture(fn, *args, **kwargs) -> str:
        cap_console = _Console(highlight=False, width=120)
        original = viewer_mod.console
        viewer_mod.console = cap_console
        try:
            with cap_console.capture() as cap:
                fn(*args, **kwargs)
            return cap.get()
        finally:
            viewer_mod.console = original

    return _capture
