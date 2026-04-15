"""CLI Typer — commande view avec filtre régional."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from pokedex.exporters import export_json


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


def test_view_region_alola(tmp_path: Path, runner: CliRunner, sample_pokedex) -> None:
    from main import app

    path = tmp_path / "dex.json"
    export_json(sample_pokedex, path)
    result = runner.invoke(app, ["view", "-i", str(path), "--region", "alola"])
    assert result.exit_code == 0
    assert "Miaouss" in result.stdout or "meowth" in result.stdout.lower()
    assert "Bulbizarre" not in result.stdout


def test_view_region_kanto_excludes_alola_form(
    tmp_path: Path,
    runner: CliRunner,
    sample_pokedex,
) -> None:
    from main import app

    path = tmp_path / "dex.json"
    export_json(sample_pokedex, path)
    result = runner.invoke(app, ["view", "-i", str(path), "--region", "kanto"])
    assert result.exit_code == 0
    assert "Bulbizarre" in result.stdout
    assert "Miaouss" not in result.stdout


def test_view_region_combined_with_type(
    tmp_path: Path,
    runner: CliRunner,
    sample_pokedex,
) -> None:
    from main import app

    path = tmp_path / "dex.json"
    export_json(sample_pokedex, path)
    result = runner.invoke(
        app,
        ["view", "-i", str(path), "--type", "Ténèbres", "--region", "alola"],
    )
    assert result.exit_code == 0
    assert "Miaouss" in result.stdout
