"""
tests/test_scraper.py — Tests du scraper avec mock HTTP

Le fetch réseau est entièrement mocké : on injecte le vrai HTML de
tests/fixtures/pokepedia_sample.html pour tester le parsing réel.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from bs4 import BeautifulSoup

from pokedex.form_labels import detect_form
from pokedex.models import Pokedex
from pokedex.scraper import (
    ARCEUS_TYPE_FORMS_FR,
    detect_columns,
    expand_arceus_type_forms,
    parse_number,
    parse_row,
    parse_types,
    resolve_wiki_image_url,
    scrape,
    slugify,
)

FIXTURE = Path(__file__).parent / "fixtures" / "pokepedia_sample.html"


# ── Helpers ────────────────────────────────────────────────────────────────────


def load_fixture() -> str:
    return FIXTURE.read_text(encoding="utf-8")


def make_soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def get_table_rows():
    soup = make_soup(load_fixture())
    table = soup.find("table", class_="wikitable")
    return table.find_all("tr")


# ── slugify ────────────────────────────────────────────────────────────────────


class TestSlugify:
    def test_basic(self):
        assert slugify("Bulbasaur") == "bulbasaur"

    def test_accents_stripped(self):
        assert slugify("Salamèche") == "salameche"

    def test_spaces_become_dashes(self):
        assert slugify("Mega Charizard X") == "mega-charizard-x"

    def test_special_chars_stripped(self):
        assert slugify("Pokémon #001!") == "pokemon-001"

    def test_leading_trailing_dashes_stripped(self):
        assert slugify("  pikachu  ") == "pikachu"

    def test_japanese_becomes_empty_then_stripped(self):
        # Caractères non-ASCII → vide → slug vide ou minimal
        result = slugify("フシギダネ")
        assert result == "" or "-" not in result


# ── parse_number ───────────────────────────────────────────────────────────────


class TestParseNumber:
    def test_hash_prefix(self):
        assert parse_number("#001") == "0001"

    def test_plain_number(self):
        assert parse_number("025") == "0025"

    def test_four_digits(self):
        assert parse_number("#1008") == "1008"

    def test_with_whitespace(self):
        assert parse_number("  #042  ") == "0042"

    def test_non_breaking_space(self):
        assert parse_number("\xa0#007\xa0") == "0007"

    def test_no_number_returns_none(self):
        assert parse_number("Type") is None

    def test_empty_returns_none(self):
        assert parse_number("") is None


# ── parse_types ────────────────────────────────────────────────────────────────


class TestParseTypes:
    def _cell(self, html: str):
        return make_soup(f"<td>{html}</td>").find("td")

    def test_single_type_link(self):
        cell = self._cell('<a href="/Feu">Feu</a>')
        assert parse_types(cell) == ["Feu"]

    def test_dual_type_links(self):
        cell = self._cell('<a href="/Plante">Plante</a><a href="/Poison">Poison</a>')
        assert parse_types(cell) == ["Plante", "Poison"]

    def test_max_two_types(self):
        cell = self._cell("<a>A</a><a>B</a><a>C</a>")
        assert len(parse_types(cell)) <= 2

    def test_empty_links_ignored(self):
        cell = self._cell('<a></a><a href="/Feu">Feu</a>')
        assert parse_types(cell) == ["Feu"]

    def test_fallback_to_text(self):
        cell = self._cell("Feu")
        result = parse_types(cell)
        assert "Feu" in result

    def test_pokepedia_type_icons_links(self):
        html = (
            '<a href="/Plante_(type)" title="Plante">'
            '<img alt="Plante" class="mw-file-element" src="/x.png" width="80"/>'
            "</a>"
            '<br/><a href="/Poison_(type)" title="Poison (type)">'
            '<img alt="Poison" class="mw-file-element" src="/y.png" width="80"/>'
            "</a>"
        )
        cell = self._cell(html)
        assert parse_types(cell) == ["Plante", "Poison"]


# ── detect_columns ─────────────────────────────────────────────────────────────


class TestDetectColumns:
    def _header(self, *headers):
        cells = "".join(f"<th>{h}</th>" for h in headers)
        return make_soup(f"<tr>{cells}</tr>").find("tr")

    def test_detects_number(self):
        row = self._header("N°", "Image", "Nom français")
        cols = detect_columns(row)
        assert cols.get("number") == 0

    def test_detects_image(self):
        row = self._header("N°", "Image", "Nom français")
        cols = detect_columns(row)
        assert cols.get("image") == 1

    def test_detects_name_fr(self):
        row = self._header("N°", "Image", "Nom français", "Nom anglais")
        cols = detect_columns(row)
        assert cols.get("name_fr") == 2

    def test_detects_name_en(self):
        row = self._header("N°", "Image", "Nom français", "Nom anglais")
        cols = detect_columns(row)
        assert cols.get("name_en") == 3

    def test_detects_types(self):
        row = self._header("N°", "Image", "Nom", "Type")
        cols = detect_columns(row)
        assert cols.get("types") == 3

    def test_empty_row_returns_empty(self):
        row = make_soup("<tr></tr>").find("tr")
        assert detect_columns(row) == {}

    def test_colspan_nom_japonais_shifts_types_column(self):
        """Comme sur Pokepedia : Nom japonais colspan=2 → Types à l’index 7."""
        html = (
            "<tr>"
            '<th rowspan="2">Numéro</th>'
            '<th rowspan="2">Image</th>'
            '<th rowspan="2">Nom français</th>'
            '<th rowspan="2">Nom anglais</th>'
            '<th rowspan="2">Nom allemand</th>'
            '<th colspan="2">Nom japonais</th>'
            '<th rowspan="2">Types</th>'
            "</tr>"
        )
        row = make_soup(html).find("tr")
        cols = detect_columns(row)
        assert cols["number"] == 0
        assert cols["name_fr"] == 2
        assert cols["name_ja"] == 5
        assert cols["types"] == 7


# ── detect_form ────────────────────────────────────────────────────────────────


class TestDetectForm:
    def test_mega(self):
        assert detect_form("Dracaufeu Méga X") == "Méga X"

    def test_mega_hyphenated_species_with_x(self):
        assert detect_form("Méga-Dracaufeu X") == "Méga X"
        assert detect_form("Méga-Dracaufeu Y") == "Méga Y"

    def test_mega_prefix_hyphen_name(self):
        assert detect_form("Méga-Florizarre") == "Méga"

    def test_gigamax(self):
        assert detect_form("Florizarre Gigamax") == "Gigamax"

    def test_mega_without_variant(self):
        result = detect_form("Kangaskhan Méga")
        assert result is not None and "Méga" in result

    def test_alola(self):
        result = detect_form("Miaouss d'Alola")
        assert result is not None

    def test_galar(self):
        assert detect_form("Goupix de Galar") == "de Galar"

    def test_hisui(self):
        assert detect_form("Voltorbe de Hisui") == "de Hisui"

    def test_paldea(self):
        assert detect_form("Crabominable de Paldea") == "de Paldea"

    def test_no_form(self):
        assert detect_form("Bulbizarre") is None

    def test_empty(self):
        assert detect_form("") is None


# ── resolve_wiki_image_url ─────────────────────────────────────────────────────


class TestResolveWikiImageUrl:
    def test_thumb_resolved_to_original(self):
        thumb = "/images/thumb/3/3a/Pokemon_001MS.png/40px-Pokemon_001MS.png"
        result = resolve_wiki_image_url(thumb)
        assert result == "https://www.pokepedia.fr/images/thumb/3/3a/Pokemon_001MS.png"
        assert "40px" not in result

    def test_non_thumb_url_absolute(self):
        src = "/images/direct/001.png"
        result = resolve_wiki_image_url(src)
        assert result.startswith("https://")

    def test_already_absolute_url(self):
        src = "https://cdn.example.com/img.png"
        result = resolve_wiki_image_url(src)
        assert result == src


# ── expand_arceus_type_forms ───────────────────────────────────────────────────


class TestExpandArceusTypeForms:
    def test_adds_one_form_per_type(self):
        raw = [
            {
                "number": "0493",
                "slug": "0493-arceus",
                "names": {"fr": "Arceus", "en": "Arceus"},
                "types": ["Normal"],
                "form": None,
                "_img_url": "/images/arceus.png",
            }
        ]
        seen = {"0493-arceus"}
        expanded = expand_arceus_type_forms(raw, seen)
        arceus = [e for e in expanded if e["number"] == "0493"]
        assert len(arceus) == len(ARCEUS_TYPE_FORMS_FR)
        assert any(e["types"] == ["Feu"] and e["form"] == "Type Feu" for e in arceus)
        assert any(e["types"] == ["Ténèbres"] for e in arceus)

    def test_does_not_duplicate_existing_type_form(self):
        raw = [
            {
                "number": "0493",
                "slug": "0493-arceus",
                "names": {"fr": "Arceus"},
                "types": ["Normal"],
                "form": None,
                "_img_url": "/images/arceus.png",
            },
            {
                "number": "0493",
                "slug": "0493-arceus-feu",
                "names": {"fr": "Arceus"},
                "types": ["Feu"],
                "form": "Type Feu",
                "_img_url": "/images/arceus.png",
            },
        ]
        seen = {"0493-arceus", "0493-arceus-feu"}
        expanded = expand_arceus_type_forms(raw, seen)
        fire = [e for e in expanded if e["number"] == "0493" and e["types"] == ["Feu"]]
        assert len(fire) == 1

    def test_respects_limit(self):
        raw = [
            {
                "number": "0493",
                "slug": "0493-arceus",
                "names": {"fr": "Arceus"},
                "types": ["Normal"],
                "form": None,
                "_img_url": "/images/arceus.png",
            }
        ]
        seen = {"0493-arceus"}
        expanded = expand_arceus_type_forms(raw, seen, limit=3)
        assert len(expanded) == 3


# ── parse_row ──────────────────────────────────────────────────────────────────


class TestParseRow:
    """Tests sur le parsing d'une ligne HTML complète."""

    def _row_cells(self, row_html: str):
        soup = make_soup(f"<table><tr>{row_html}</tr></table>")
        row = soup.find("tr")
        return row.find_all(["td", "th"])

    def _col_map(self):
        return {"number": 0, "image": 1, "name_fr": 2, "name_en": 3, "name_ja": 4, "types": 5}

    def test_parse_basic_row(self):
        cells = self._row_cells(
            "<td>#001</td>"
            "<td><img src='/images/thumb/3/3a/001.png/40px-001.png'/></td>"
            "<td>Bulbizarre</td>"
            "<td>Bulbasaur</td>"
            "<td>フシギダネ</td>"
            "<td><a>Plante</a><a>Poison</a></td>"
        )
        result = parse_row(cells, self._col_map())

        assert result is not None
        assert result["number"] == "0001"
        assert result["names"]["fr"] == "Bulbizarre"
        assert result["names"]["en"] == "Bulbasaur"
        assert result["names"]["ja"] == "フシギダネ"
        assert result["types"] == ["Plante", "Poison"]
        assert result["form"] is None

    def test_parse_row_with_mega_form(self):
        cells = self._row_cells(
            "<td>#006</td>"
            "<td><img src='/images/thumb/d/d1/006mega.png/40px-006mega.png'/></td>"
            "<td>Dracaufeu Méga X</td>"
            "<td>Mega Charizard X</td>"
            "<td>リザードン</td>"
            "<td><a>Feu</a><a>Dragon</a></td>"
        )
        result = parse_row(cells, self._col_map())

        assert result is not None
        assert result["form"] is not None
        assert "Méga" in result["form"]
        assert result["types"] == ["Feu", "Dragon"]

    def test_parse_row_with_alola_form(self):
        cells = self._row_cells(
            "<td>#052</td>"
            "<td><img src='/images/thumb/a/a3/052a.png/40px-052a.png'/></td>"
            "<td>Miaouss d'Alola</td>"
            "<td>Alolan Meowth</td>"
            "<td>ニャース</td>"
            "<td><a>Ténèbres</a></td>"
        )
        result = parse_row(cells, self._col_map())
        assert result is not None
        assert result["form"] is not None

    def test_parse_row_no_number_returns_none(self):
        cells = self._row_cells("<td>Type</td><td></td><td>Nom</td><td></td><td></td><td></td>")
        result = parse_row(cells, self._col_map())
        assert result is None

    def test_slug_is_built_from_en_name(self):
        cells = self._row_cells(
            "<td>#025</td><td></td><td>Pikachu</td><td>Pikachu</td><td>ピカチュウ</td><td><a>Électrik</a></td>"
        )
        result = parse_row(cells, self._col_map())
        assert result is not None
        assert result["slug"].startswith("0025-")
        assert "pikachu" in result["slug"]

    def test_parse_row_seven_cell_mega_variant(self):
        """Ligne 7 colonnes : numéro uniquement dans le titre du sprite."""
        col_map_live = {
            "number": 0,
            "image": 1,
            "name_fr": 2,
            "name_en": 3,
            "name_de": 4,
            "name_ja": 5,
            "types": 7,
        }
        row_html = (
            "<td>"
            '<a href="/Pok%C3%A9mon_n%C2%B00003_M%C3%A9ga" title="Pokémon n°0003 Méga">'
            '<img alt="0003" '
            'src="/images/thumb/9/99/Miniature_0003_M%C3%A9ga_HOME.png/40px-x.png"/>'
            "</a>"
            "</td>"
            '<td><a href="/M%C3%A9ga-Florizarre">Méga-Florizarre</a></td>'
            "<td>Mega Venusaur</td>"
            "<td>Mega-Bisaflor</td>"
            '<td><span lang="ja">メガフシギバナ</span></td>'
            "<td>Mega Fushigibana</td>"
            "<td>"
            '<a href="/Plante_(type)" title="Plante"><img alt="Plante" src="/p.png"/></a>'
            '<a href="/Poison_(type)" title="Poison (type)"><img alt="Poison" src="/q.png"/></a>'
            "</td>"
        )
        cells = self._row_cells(row_html)
        result = parse_row(cells, col_map_live)
        assert result is not None
        assert result["number"] == "0003"
        assert result["names"]["fr"] == "Méga-Florizarre"
        assert result["types"] == ["Plante", "Poison"]
        assert result["form"] == "Méga"

    def test_parse_row_gigamax_name_not_concatenated(self):
        """Nom FR sur deux blocs (lien + small) : espace entre le nom et Gigamax."""
        col_map_live = {
            "number": 0,
            "image": 1,
            "name_fr": 2,
            "name_en": 3,
            "name_de": 4,
            "name_ja": 5,
            "types": 7,
        }
        row_html = (
            "<td>"
            '<a href="/Pok%C3%A9mon_n%C2%B00003_Gigamax" title="Pokémon n°0003 Gigamax">'
            '<img alt="0003" src="/i.png"/>'
            "</a></td>"
            '<td><a href="/Florizarre_Gigamax">Florizarre</a><br/><small>Gigamax</small></td>'
            "<td>Venusaur<br/><small>Gigantamax</small></td>"
            "<td>Bisaflor</td>"
            "<td>フシギバナ</td>"
            "<td>Fushigibana</td>"
            '<td><a href="/Plante_(type)" title="Plante">'
            '<img alt="Plante" src="/p.png"/></a></td>'
        )
        cells = self._row_cells(row_html)
        result = parse_row(cells, col_map_live)
        assert result is not None
        assert result["names"]["fr"] == "Florizarre Gigamax"
        assert result["names"]["en"] == "Venusaur Gigantamax"
        assert result["form"] == "Gigamax"


# ── scrape() — test d'intégration avec mock HTTP ──────────────────────────────


class TestScrapeIntegration:
    """
    Test complet de scrape() avec le vrai HTML de fixture.
    Tous les appels réseau sont mockés :
      - fetch_page → retourne le HTML parsé depuis le fichier fixture
      - download_image → simule le téléchargement (toujours True)
    """

    @pytest.fixture
    def fixture_html(self):
        return load_fixture()

    @pytest.fixture
    def mock_session(self):
        return MagicMock()

    def _run_scrape(self, tmp_path, fixture_html, download_images=False):
        """Lance scrape() avec fetch_page mocké sur la fixture HTML."""
        soup = make_soup(fixture_html)

        with (
            patch("pokedex.scraper.get_session") as mock_get_session,
            patch("pokedex.scraper.fetch_page", return_value=soup) as mock_fetch,
            patch("pokedex.scraper.download_image", return_value=True) as mock_dl,
            patch("pokedex.scraper.time.sleep"),
        ):
            mock_get_session.return_value = MagicMock()

            result = scrape(
                limit=None,
                download_images=download_images,
                images_dir=tmp_path / "images",
            )
            return result, mock_fetch, mock_dl

    def test_returns_pokedex_instance(self, tmp_path, fixture_html):
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        assert isinstance(result, Pokedex)

    def test_correct_pokemon_count(self, tmp_path, fixture_html):
        """La fixture contient 8 lignes de données (dont 2 entrées #006)."""
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        assert result.total == 8

    def test_total_matches_pokemon_list(self, tmp_path, fixture_html):
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        assert result.total == len(result.pokemon)

    def test_fetch_page_called_once(self, tmp_path, fixture_html):
        _, mock_fetch, _ = self._run_scrape(tmp_path, fixture_html)
        mock_fetch.assert_called_once()

    def test_fetch_page_called_with_correct_url(self, tmp_path, fixture_html):
        from pokedex.scraper import PAGE_URL

        _, mock_fetch, _ = self._run_scrape(tmp_path, fixture_html)
        args, kwargs = mock_fetch.call_args
        assert PAGE_URL in args

    def test_bulbizarre_parsed_correctly(self, tmp_path, fixture_html):
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        bulbi = next(p for p in result.pokemon if p.number == "0001")
        assert bulbi.names.fr == "Bulbizarre"
        assert bulbi.names.en == "Bulbasaur"
        assert bulbi.names.ja == "フシギダネ"
        assert "Plante" in bulbi.types
        assert "Poison" in bulbi.types
        assert bulbi.form is None

    def test_charizard_two_forms_same_number(self, tmp_path, fixture_html):
        """#006 doit avoir 2 entrées : base et Méga X."""
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        char_forms = result.by_number("6")
        assert len(char_forms) == 2

    def test_charizard_mega_has_form(self, tmp_path, fixture_html):
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        mega = next((p for p in result.pokemon if "mega" in p.slug.lower()), None)
        assert mega is not None
        assert mega.form is not None

    def test_pikachu_single_type(self, tmp_path, fixture_html):
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        pikachu = next(p for p in result.pokemon if p.number == "0025")
        assert pikachu.types == ["Électrik"]

    def test_alola_form_detected(self, tmp_path, fixture_html):
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        alola = next(
            (
                p
                for p in result.pokemon
                if "alola" in p.slug.lower() or (p.form and "alola" in p.form.lower())
            ),
            None,
        )
        assert alola is not None
        assert alola.form is not None

    def test_slugs_are_unique(self, tmp_path, fixture_html):
        result, _, _ = self._run_scrape(tmp_path, fixture_html)
        slugs = [p.slug for p in result.pokemon]
        assert len(slugs) == len(set(slugs)), "Des slugs en doublon détectés"

    def test_limit_is_respected(self, tmp_path, fixture_html):
        soup = make_soup(fixture_html)
        with (
            patch("pokedex.scraper.get_session"),
            patch("pokedex.scraper.fetch_page", return_value=soup),
            patch("pokedex.scraper.download_image", return_value=True),
            patch("pokedex.scraper.time.sleep"),
        ):
            result = scrape(limit=3, download_images=False, images_dir=tmp_path / "images")
        assert result.total == 3

    def test_download_image_called_when_enabled(self, tmp_path, fixture_html):
        soup = make_soup(fixture_html)
        with (
            patch("pokedex.scraper.get_session"),
            patch("pokedex.scraper.fetch_page", return_value=soup),
            patch("pokedex.scraper.download_image", return_value=True) as mock_dl,
            patch("pokedex.scraper.time.sleep"),
        ):
            scrape(download_images=True, images_dir=tmp_path / "images")
        assert mock_dl.call_count > 0

    def test_download_image_not_called_when_disabled(self, tmp_path, fixture_html):
        soup = make_soup(fixture_html)
        with (
            patch("pokedex.scraper.get_session"),
            patch("pokedex.scraper.fetch_page", return_value=soup),
            patch("pokedex.scraper.download_image", return_value=True) as mock_dl,
            patch("pokedex.scraper.time.sleep"),
        ):
            scrape(download_images=False, images_dir=tmp_path / "images")
        mock_dl.assert_not_called()

    def test_image_is_none_when_download_disabled(self, tmp_path, fixture_html):
        result, _, _ = self._run_scrape(tmp_path, fixture_html, download_images=False)
        assert all(p.image is None for p in result.pokemon)

    def test_network_error_propagates(self, tmp_path):
        import requests

        with (
            patch("pokedex.scraper.get_session"),
            patch("pokedex.scraper.fetch_page", side_effect=requests.ConnectionError("timeout")),
            pytest.raises(requests.ConnectionError),
        ):
            scrape(download_images=False, images_dir=tmp_path / "images")
