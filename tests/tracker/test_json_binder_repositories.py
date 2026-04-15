"""Repositories JSON classeurs — défauts si fichier absent ou invalide."""

from __future__ import annotations

from pathlib import Path

from tracker.repository.json_binder_config_repository import JsonBinderConfigRepository
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository


def test_config_load_missing_returns_default(tmp_path: Path) -> None:
    path = tmp_path / "binder-config.json"
    repo = JsonBinderConfigRepository(path)
    assert repo.load().model_dump() == {
        "version": 1,
        "convention": "sheet_recto_verso",
        "binders": [],
        "form_rules": [],
    }


def test_config_load_invalid_json_returns_default(tmp_path: Path) -> None:
    path = tmp_path / "binder-config.json"
    path.write_text("{", encoding="utf-8")
    repo = JsonBinderConfigRepository(path)
    assert repo.load().binders == []


def test_config_load_validation_error_returns_default(tmp_path: Path) -> None:
    path = tmp_path / "binder-config.json"
    path.write_text('{"version": 1, "binders": "bad"}', encoding="utf-8")
    repo = JsonBinderConfigRepository(path)
    assert repo.load().binders == []


def test_config_load_top_level_array_returns_default(tmp_path: Path) -> None:
    path = tmp_path / "binder-config.json"
    path.write_text("[]", encoding="utf-8")
    repo = JsonBinderConfigRepository(path)
    assert repo.load().convention == "sheet_recto_verso"


def test_config_save_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "d" / "binder-config.json"
    repo = JsonBinderConfigRepository(path)
    payload = repo.load()
    payload.binders.append({"id": "x"})
    repo.save(payload)
    again = JsonBinderConfigRepository(path).load()
    assert again.binders == [{"id": "x"}]


def test_placements_load_not_dict_returns_default(tmp_path: Path) -> None:
    path = tmp_path / "binder-placements.json"
    path.write_text("[]", encoding="utf-8")
    repo = JsonBinderPlacementsRepository(path)
    assert repo.load().by_binder == {}


def test_placements_load_invalid_json_returns_default(tmp_path: Path) -> None:
    path = tmp_path / "binder-placements.json"
    path.write_text("{", encoding="utf-8")
    repo = JsonBinderPlacementsRepository(path)
    assert repo.load().by_binder == {}


def test_placements_load_validation_error_returns_default(tmp_path: Path) -> None:
    path = tmp_path / "binder-placements.json"
    path.write_text('{"version": 1, "by_binder": "bad"}', encoding="utf-8")
    repo = JsonBinderPlacementsRepository(path)
    assert repo.load().by_binder == {}


def test_placements_save_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "sub" / "binder-placements.json"
    repo = JsonBinderPlacementsRepository(path)
    payload = repo.load()
    payload.by_binder["a"] = {"x": {"page": 1, "slot": 2}}
    repo.save(payload)
    again = JsonBinderPlacementsRepository(path).load()
    assert again.by_binder == {"a": {"x": {"page": 1, "slot": 2}}}
