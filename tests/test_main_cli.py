"""main.py — commandes Typer fetch / view / edit (chemins d’erreur et fetch mocké)."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from pokedex.exporters import export_json


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


def test_view_missing_file_exits_1(tmp_path: Path, runner: CliRunner) -> None:
    from main import app

    missing = tmp_path / "absent.json"
    r = runner.invoke(app, ["view", "-i", str(missing)])
    assert r.exit_code == 1
    lo = r.stdout.lower()
    assert "introuvable" in lo or "fichier" in lo


def test_edit_missing_input_exits_1(tmp_path: Path, runner: CliRunner) -> None:
    from main import app

    missing = tmp_path / "nope.json"
    r = runner.invoke(app, ["edit", "0001-bulbizarre", "-i", str(missing)])
    assert r.exit_code == 1


def test_fetch_scrape_error_exits_1(
    runner: CliRunner,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    from main import app

    def boom(**kwargs):
        raise RuntimeError("network")

    monkeypatch.setattr("pokedex.scraper.scrape", boom)
    out = tmp_path / "out.json"
    r = runner.invoke(app, ["fetch", "--no-images", "-o", str(out)])
    assert r.exit_code == 1
    lo = r.stdout.lower()
    assert "erreur" in lo or "scraping" in lo


def test_fetch_writes_json(
    runner: CliRunner,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    sample_pokedex,
) -> None:
    from main import app

    monkeypatch.setattr("pokedex.scraper.scrape", lambda **k: sample_pokedex)
    out = tmp_path / "dex.json"
    r = runner.invoke(app, ["fetch", "--no-images", "--format", "json", "-o", str(out)])
    assert r.exit_code == 0
    assert out.exists()
    assert "pokemon" in out.read_text(encoding="utf-8")


def test_fetch_limit_zero_means_no_limit(
    runner: CliRunner,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    sample_pokedex,
) -> None:
    from main import app

    limits: list[object] = []

    def rec(limit=None, **kwargs):
        limits.append(limit)
        return sample_pokedex

    monkeypatch.setattr("pokedex.scraper.scrape", rec)
    out = tmp_path / "z.json"
    r = runner.invoke(app, ["fetch", "--no-images", "--limit", "0", "-o", str(out)])
    assert r.exit_code == 0
    assert limits == [None]


def test_fetch_evolutions_writes_family_layouts(
    runner: CliRunner,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    from main import app

    pokedex_path = tmp_path / "pokedex.json"
    output_path = tmp_path / "evolution-families.json"
    pokedex_path.write_text('{"pokemon": []}', encoding="utf-8")

    monkeypatch.setattr(
        "pokedex.evolution_families.generate_family_payload_from_files",
        lambda path, **kwargs: {
            "version": 1,
            "family_count": 1,
            "pokemon_count": 1,
            "families": [{"id": "0001-bulbasaur", "layout_rows": [["0001-bulbasaur"]]}],
        },
    )

    r = runner.invoke(
        app,
        ["fetch-evolutions", "--input", str(pokedex_path), "--output", str(output_path)],
    )

    assert r.exit_code == 0
    assert "0001-bulbasaur" in output_path.read_text(encoding="utf-8")


def test_removed_shiny_fetch_command_is_not_listed(runner: CliRunner) -> None:
    from main import app

    r = runner.invoke(app, ["--help"])

    assert r.exit_code == 0
    assert "fetch-shiny" not in r.output


def test_view_by_number_shows_pokemon(
    tmp_path: Path,
    runner: CliRunner,
    sample_pokedex,
) -> None:
    from main import app

    path = tmp_path / "dex.json"
    export_json(sample_pokedex, path)
    r = runner.invoke(app, ["view", "-i", str(path), "-n", "025"])
    assert r.exit_code == 0
    assert "Pikachu" in r.stdout or "0025" in r.stdout


def test_view_unknown_number_exits_1(
    tmp_path: Path,
    runner: CliRunner,
    sample_pokedex,
) -> None:
    from main import app

    path = tmp_path / "dex.json"
    export_json(sample_pokedex, path)
    r = runner.invoke(app, ["view", "-i", str(path), "-n", "9999"])
    assert r.exit_code == 1
