"""
tests/test_exporters.py — Tests des exporteurs (JSON, CSV, YAML, XML)
"""

import csv
import json
import xml.etree.ElementTree as ET

import pytest
import yaml

from pokedex.exporters import (
    EXPORTERS,
    EXTENSIONS,
    export,
    export_csv,
    export_json,
    export_xml,
    export_yaml,
    load_pokedex,
)
from pokedex.models import Pokedex

# ── Fixture commune ────────────────────────────────────────────────────────────

# La fixture sample_pokedex vient de conftest.py


# ── JSON ───────────────────────────────────────────────────────────────────────


class TestExportJson:
    def test_creates_file(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.json"
        export_json(sample_pokedex, path)
        assert path.exists()

    def test_valid_json(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.json"
        export_json(sample_pokedex, path)
        data = json.loads(path.read_text(encoding="utf-8"))
        assert isinstance(data, dict)

    def test_has_meta_and_pokemon_keys(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.json"
        export_json(sample_pokedex, path)
        data = json.loads(path.read_text())
        assert "meta" in data
        assert "pokemon" in data
        assert "regions" in data["meta"]
        assert len(data["meta"]["regions"]) >= 10

    def test_meta_total_is_correct(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.json"
        export_json(sample_pokedex, path)
        data = json.loads(path.read_text())
        assert data["meta"]["total"] == sample_pokedex.total

    def test_pokemon_count_matches(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.json"
        export_json(sample_pokedex, path)
        data = json.loads(path.read_text())
        assert len(data["pokemon"]) == sample_pokedex.total

    def test_unicode_preserved(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.json"
        export_json(sample_pokedex, path)
        content = path.read_text(encoding="utf-8")
        assert "フシギダネ" in content
        assert "Méga" in content

    def test_creates_parent_dirs(self, tmp_path, sample_pokedex):
        path = tmp_path / "deep" / "nested" / "out.json"
        export_json(sample_pokedex, path)
        assert path.exists()


# ── CSV ────────────────────────────────────────────────────────────────────────


class TestExportCsv:
    def test_creates_file(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.csv"
        export_csv(sample_pokedex, path)
        assert path.exists()

    def test_has_header_row(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.csv"
        export_csv(sample_pokedex, path)
        with open(path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            assert "number" in reader.fieldnames
            assert "name_fr" in reader.fieldnames
            assert "types" in reader.fieldnames

    def test_row_count(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.csv"
        export_csv(sample_pokedex, path)
        with open(path, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        assert len(rows) == sample_pokedex.total

    def test_dual_types_joined_with_slash(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.csv"
        export_csv(sample_pokedex, path)
        with open(path, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        bulbi = next(r for r in rows if r["number"] == "0001")
        assert bulbi["types"] == "Plante/Poison"

    def test_single_type(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.csv"
        export_csv(sample_pokedex, path)
        with open(path, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        pikachu = next(r for r in rows if r["number"] == "0025")
        assert pikachu["types"] == "Électrik"

    def test_names_in_separate_columns(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.csv"
        export_csv(sample_pokedex, path)
        with open(path, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        bulbi = next(r for r in rows if r["number"] == "0001")
        assert bulbi["name_fr"] == "Bulbizarre"
        assert bulbi["name_en"] == "Bulbasaur"
        assert bulbi["name_ja"] == "フシギダネ"

    def test_empty_pokedex_writes_no_csv_file(self, tmp_path):
        path = tmp_path / "empty.csv"
        export_csv(Pokedex(pokemon=[]), path)
        assert not path.exists()


# ── YAML ───────────────────────────────────────────────────────────────────────


class TestExportYaml:
    def test_creates_file(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.yaml"
        export_yaml(sample_pokedex, path)
        assert path.exists()

    def test_valid_yaml(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.yaml"
        export_yaml(sample_pokedex, path)
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        assert isinstance(data, dict)

    def test_has_meta_and_pokemon(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.yaml"
        export_yaml(sample_pokedex, path)
        data = yaml.safe_load(path.read_text())
        assert "meta" in data
        assert "pokemon" in data

    def test_unicode_preserved(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.yaml"
        export_yaml(sample_pokedex, path)
        content = path.read_text(encoding="utf-8")
        assert "フシギダネ" in content  # allow_unicode=True

    def test_pokemon_count(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.yaml"
        export_yaml(sample_pokedex, path)
        data = yaml.safe_load(path.read_text())
        assert len(data["pokemon"]) == sample_pokedex.total


# ── XML ────────────────────────────────────────────────────────────────────────


class TestExportXml:
    def test_creates_file(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.xml"
        export_xml(sample_pokedex, path)
        assert path.exists()

    def test_valid_xml(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.xml"
        export_xml(sample_pokedex, path)
        tree = ET.parse(path)
        root = tree.getroot()
        assert root.tag == "pokedex"

    def test_has_meta(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.xml"
        export_xml(sample_pokedex, path)
        tree = ET.parse(path)
        meta = tree.getroot().find("meta")
        assert meta is not None
        assert meta.find("total").text == str(sample_pokedex.total)

    def test_pokemon_elements(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.xml"
        export_xml(sample_pokedex, path)
        tree = ET.parse(path)
        pokemon_list = tree.getroot().find("pokemon_list")
        assert pokemon_list is not None
        assert len(pokemon_list.findall("pokemon")) == sample_pokedex.total

    def test_types_as_child_elements(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.xml"
        export_xml(sample_pokedex, path)
        tree = ET.parse(path)
        first = tree.getroot().find("pokemon_list/pokemon")
        types_el = first.find("types")
        assert types_el is not None
        type_texts = [t.text for t in types_el.findall("type")]
        assert "Plante" in type_texts
        assert "Poison" in type_texts

    def test_form_element_present_when_set(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.xml"
        export_xml(sample_pokedex, path)
        tree = ET.parse(path)
        mega = next(
            p
            for p in tree.getroot().findall("pokemon_list/pokemon")
            if p.find("slug") is not None and "mega" in p.find("slug").text
        )
        assert mega.find("form") is not None
        assert mega.find("form").text == "Méga X"

    def test_form_element_absent_when_none(self, tmp_path, sample_pokedex):
        path = tmp_path / "out.xml"
        export_xml(sample_pokedex, path)
        tree = ET.parse(path)
        bulbi = next(
            p
            for p in tree.getroot().findall("pokemon_list/pokemon")
            if p.find("number") is not None and p.find("number").text == "0001"
        )
        assert bulbi.find("form") is None


# ── Dispatcher export() ────────────────────────────────────────────────────────


class TestExportDispatcher:
    def test_all_formats_registered(self):
        for fmt in ("json", "csv", "yaml", "xml"):
            assert fmt in EXPORTERS
            assert fmt in EXTENSIONS

    def test_unknown_format_raises(self, tmp_path, sample_pokedex):
        with pytest.raises(ValueError, match="Format inconnu"):
            export(sample_pokedex, tmp_path / "out.txt", "txt")

    @pytest.mark.parametrize("fmt", ["json", "csv", "yaml", "xml"])
    def test_each_format_creates_file(self, fmt, tmp_path, sample_pokedex):
        path = tmp_path / f"out{EXTENSIONS[fmt]}"
        export(sample_pokedex, path, fmt)
        assert path.exists()
        assert path.stat().st_size > 0


# ── load_pokedex ───────────────────────────────────────────────────────────────


class TestLoadPokedex:
    def test_roundtrip_json(self, tmp_path, sample_pokedex):
        path = tmp_path / "pokedex.json"
        export_json(sample_pokedex, path)
        loaded = load_pokedex(path)
        assert loaded.total == sample_pokedex.total

    def test_names_preserved(self, tmp_path, sample_pokedex):
        path = tmp_path / "pokedex.json"
        export_json(sample_pokedex, path)
        loaded = load_pokedex(path)
        bulbi = loaded.by_number("1")[0]
        assert bulbi.names.fr == "Bulbizarre"
        assert bulbi.names.en == "Bulbasaur"
        assert bulbi.names.ja == "フシギダネ"

    def test_types_preserved(self, tmp_path, sample_pokedex):
        path = tmp_path / "pokedex.json"
        export_json(sample_pokedex, path)
        loaded = load_pokedex(path)
        bulbi = loaded.by_number("1")[0]
        assert bulbi.types == ["Plante", "Poison"]

    def test_form_preserved(self, tmp_path, sample_pokedex):
        path = tmp_path / "pokedex.json"
        export_json(sample_pokedex, path)
        loaded = load_pokedex(path)
        mega = next(p for p in loaded.pokemon if p.form)
        assert mega.form == "Méga X"

    def test_roundtrip_preserves_region_fields(self, tmp_path, sample_pokedex):
        path = tmp_path / "pokedex.json"
        export_json(sample_pokedex, path)
        loaded = load_pokedex(path)
        mia = next(p for p in loaded.pokemon if p.slug == "0052-meowth-alola")
        assert mia.region == "alola"
        assert mia.region_dex == "kanto"
        assert mia.region_native is False

    def test_legacy_list_format(self, tmp_path):
        """Compatibilité avec l'ancien format (liste directe sans clé meta)."""
        data = [
            {
                "number": "0001",
                "slug": "0001-bulbasaur",
                "names": {"fr": "Bulbizarre"},
                "types": ["Plante"],
                "form": None,
                "image": None,
            }
        ]
        path = tmp_path / "legacy.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        loaded = load_pokedex(path)
        assert loaded.total == 1
