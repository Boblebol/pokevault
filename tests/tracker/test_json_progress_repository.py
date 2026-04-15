"""tracker.repository.json_progress_repository."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tracker.models import CollectionProgress
from tracker.repository.json_progress_repository import JsonProgressRepository


def test_load_missing_file(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "missing.json")
    assert repo.load() == CollectionProgress()


def test_load_invalid_json(tmp_path: Path) -> None:
    p = tmp_path / "bad.json"
    p.write_text("{not json", encoding="utf-8")
    repo = JsonProgressRepository(p)
    assert repo.load() == CollectionProgress()


def test_load_caught_not_dict(tmp_path: Path) -> None:
    p = tmp_path / "x.json"
    p.write_text(json.dumps({"caught": []}), encoding="utf-8")
    assert JsonProgressRepository(p).load() == CollectionProgress()


def test_load_raw_not_dict(tmp_path: Path) -> None:
    p = tmp_path / "x.json"
    p.write_text(json.dumps([]), encoding="utf-8")
    assert JsonProgressRepository(p).load() == CollectionProgress()


def test_load_normalizes_and_skips_bad_entries(tmp_path: Path) -> None:
    p = tmp_path / "x.json"
    raw = {
        "version": 1,
        "caught": {
            "ok": True,
            "": True,
            "  ": True,
            "no": False,
            "bad_val": "not-bool",
        },
    }
    p.write_text(json.dumps(raw), encoding="utf-8")
    out = JsonProgressRepository(p).load()
    assert out.caught == {"ok": True, "no": False}


def test_load_skips_non_string_keys(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    p = tmp_path / "x.json"
    p.write_text("{}", encoding="utf-8")

    def fake_loads(_s: str) -> dict:
        return {"caught": {123: True, "keep": True, "drop": "x"}}

    monkeypatch.setattr(
        "tracker.repository.json_progress_repository.json.loads",
        fake_loads,
    )
    out = JsonProgressRepository(p).load()
    assert out.caught == {"keep": True}


def test_save_creates_parent_and_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "prog.json"
    repo = JsonProgressRepository(path)
    data = CollectionProgress(caught={"a": True})
    repo.save(data)
    assert path.is_file()
    assert JsonProgressRepository(path).load().caught == {"a": True}
