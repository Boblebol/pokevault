"""Maintenance API for local user data and reference data."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.data_controller import router as data_router
from tracker.api.dependencies import get_data_maintenance_service
from tracker.services.data_maintenance_service import (
    REFERENCE_DATA_FILES,
    DataMaintenanceService,
)


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_status_reports_reference_and_local_data_files(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    reference_dir = tmp_path / "reference"
    _write_json(data_dir / "pokedex.json", {"pokemon": []})
    _write_json(reference_dir / "game-pokedexes.json", {"version": 1})
    _write_json(data_dir / "collection-progress.json", {"caught": {"pikachu": True}})

    status = DataMaintenanceService(data_dir, reference_dir).status()

    by_name = {item.name: item for item in status.files}
    assert by_name["pokedex.json"].kind == "reference"
    assert by_name["pokedex.json"].present is True
    assert by_name["pokedex.json"].refresh_available is False
    assert by_name["game-pokedexes.json"].kind == "reference"
    assert by_name["game-pokedexes.json"].present is False
    assert by_name["game-pokedexes.json"].refresh_available is True
    assert by_name["collection-progress.json"].kind == "local_state"
    assert by_name["collection-progress.json"].present is True


def test_refresh_restores_missing_reference_files_from_reference_directory(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    reference_dir = tmp_path / "reference"
    _write_json(reference_dir / "pokedex.json", {"pokemon": [{"slug": "0001-bulbasaur"}]})
    _write_json(reference_dir / "game-pokedexes.json", {"version": 1})
    _write_json(data_dir / "collection-progress.json", {"caught": {"pikachu": True}})

    result = DataMaintenanceService(data_dir, reference_dir).refresh_reference_data()

    assert result.ok is True
    assert sorted(result.changed) == ["game-pokedexes.json", "pokedex.json"]
    assert json.loads((data_dir / "pokedex.json").read_text(encoding="utf-8")) == {
        "pokemon": [{"slug": "0001-bulbasaur"}]
    }
    assert (data_dir / "collection-progress.json").is_file()


def test_refresh_skips_reference_files_already_served_from_data_dir(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    for name in REFERENCE_DATA_FILES:
        _write_json(data_dir / name, {"name": name})

    result = DataMaintenanceService(data_dir).refresh_reference_data()

    assert result.changed == []
    assert result.missing_sources == []


def test_refresh_skips_identical_reference_file_content(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    reference_dir = tmp_path / "reference"
    _write_json(data_dir / "pokedex.json", {"pokemon": []})
    _write_json(reference_dir / "pokedex.json", {"pokemon": []})

    result = DataMaintenanceService(data_dir, reference_dir).refresh_reference_data()

    assert result.changed == []
    assert "pokedex.json" not in result.missing_sources


def test_reset_local_data_deletes_user_state_and_preserves_reference_data(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    reference_dir = tmp_path / "reference"
    _write_json(data_dir / "pokedex.json", {"pokemon": []})
    _write_json(data_dir / "collection-progress.json", {"caught": {"pikachu": True}})
    _write_json(data_dir / "binder-config.json", {"binders": []})
    _write_json(data_dir / "trainer-contacts.json", {"contacts": {}})

    result = DataMaintenanceService(data_dir, reference_dir).reset_local_data()

    assert result.ok is True
    assert sorted(result.changed) == [
        "binder-config.json",
        "collection-progress.json",
        "trainer-contacts.json",
    ]
    assert (data_dir / "pokedex.json").is_file()
    assert not (data_dir / "collection-progress.json").exists()


def test_same_path_returns_false_when_resolution_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken_resolve(self: Path) -> Path:
        raise OSError("unavailable")

    monkeypatch.setattr(Path, "resolve", broken_resolve)

    assert DataMaintenanceService._same_path(Path("left"), Path("right")) is False


def test_data_maintenance_api_routes(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    reference_dir = tmp_path / "reference"
    _write_json(reference_dir / "pokedex.json", {"pokemon": []})
    _write_json(data_dir / "collection-progress.json", {"caught": {"pikachu": True}})

    app = FastAPI()
    app.include_router(data_router)
    app.dependency_overrides[get_data_maintenance_service] = lambda: DataMaintenanceService(
        data_dir,
        reference_dir,
    )
    client = TestClient(app)

    status = client.get("/api/data/status")
    assert status.status_code == 200
    assert any(item["name"] == "collection-progress.json" for item in status.json()["files"])

    refresh = client.post("/api/data/refresh")
    assert refresh.status_code == 200
    assert refresh.json()["changed"] == ["pokedex.json"]

    reset = client.post("/api/data/reset-local")
    assert reset.status_code == 200
    assert reset.json()["changed"] == ["collection-progress.json"]
