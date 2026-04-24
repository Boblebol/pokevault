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
    # After F03 migration, only `True` entries become statuses; `caught`
    # is derived from statuses so `no: False` is dropped as intended.
    assert out.caught == {"ok": True}
    assert set(out.statuses.keys()) == {"ok"}
    assert out.statuses["ok"].state == "caught"


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


# ── F03 — enriched statuses ─────────────────────────────────────────────


def test_load_statuses_full(tmp_path: Path) -> None:
    p = tmp_path / "prog.json"
    raw = {
        "version": 1,
        "caught": {"pikachu": True},
        "statuses": {
            "pikachu": {"state": "caught", "shiny": True, "seen_at": "2026-01-01T00:00:00Z"},
            "rattata": {"state": "seen", "shiny": False, "seen_at": None},
        },
    }
    p.write_text(json.dumps(raw), encoding="utf-8")
    out = JsonProgressRepository(p).load()
    assert out.statuses["pikachu"].state == "caught"
    assert out.statuses["pikachu"].shiny is True
    assert out.statuses["pikachu"].seen_at == "2026-01-01T00:00:00Z"
    assert out.statuses["rattata"].state == "seen"
    assert out.caught == {"pikachu": True}


def test_load_statuses_skips_invalid_entries(tmp_path: Path) -> None:
    p = tmp_path / "prog.json"
    raw = {
        "caught": {},
        "statuses": {
            "": {"state": "seen"},
            "   ": {"state": "seen"},
            "no_state": {},
            "bad_state": {"state": "unknown"},
            "not_dict": "oops",
            "seen_shiny_ignored": {"state": "seen", "shiny": True, "seen_at": 123},
        },
    }
    p.write_text(json.dumps(raw), encoding="utf-8")
    out = JsonProgressRepository(p).load()
    assert list(out.statuses.keys()) == ["seen_shiny_ignored"]
    entry = out.statuses["seen_shiny_ignored"]
    assert entry.state == "seen"
    assert entry.shiny is False
    assert entry.seen_at is None


def test_load_statuses_non_string_key(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    p = tmp_path / "prog.json"
    p.write_text("{}", encoding="utf-8")

    def fake_loads(_s: str) -> dict:
        return {
            "caught": {},
            "statuses": {
                42: {"state": "caught"},
                "ok": {"state": "caught"},
            },
        }

    monkeypatch.setattr(
        "tracker.repository.json_progress_repository.json.loads",
        fake_loads,
    )
    out = JsonProgressRepository(p).load()
    assert list(out.statuses.keys()) == ["ok"]


def test_load_statuses_bad_root_type(tmp_path: Path) -> None:
    p = tmp_path / "prog.json"
    p.write_text(json.dumps({"statuses": "nope"}), encoding="utf-8")
    out = JsonProgressRepository(p).load()
    assert out.statuses == {}


def test_legacy_migration_populates_statuses(tmp_path: Path) -> None:
    p = tmp_path / "prog.json"
    p.write_text(json.dumps({"caught": {"a": True, "b": True}}), encoding="utf-8")
    out = JsonProgressRepository(p).load()
    assert set(out.statuses.keys()) == {"a", "b"}
    assert all(e.state == "caught" for e in out.statuses.values())


def test_save_derives_caught_from_statuses(tmp_path: Path) -> None:
    from tracker.models import PokemonStatusEntry

    path = tmp_path / "prog.json"
    repo = JsonProgressRepository(path)
    data = CollectionProgress(
        caught={"legacy_only": True},
        statuses={
            "caught_one": PokemonStatusEntry(state="caught"),
            "seen_one": PokemonStatusEntry(state="seen"),
        },
    )
    repo.save(data)
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert raw["caught"] == {"caught_one": True}
    assert set(raw["statuses"].keys()) == {"caught_one", "seen_one"}


def test_save_keeps_legacy_caught_when_statuses_empty(tmp_path: Path) -> None:
    path = tmp_path / "prog.json"
    repo = JsonProgressRepository(path)
    data = CollectionProgress(caught={"only_legacy": True}, statuses={})
    repo.save(data)
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert raw["caught"] == {"only_legacy": True}


def test_load_badges_unlocked_list(tmp_path: Path) -> None:
    p = tmp_path / "prog.json"
    p.write_text(
        json.dumps({"caught": {}, "badges_unlocked": ["first_catch", "century"]}),
        encoding="utf-8",
    )
    out = JsonProgressRepository(p).load()
    assert out.badges_unlocked == ["first_catch", "century"]


def test_load_badges_unlocked_skips_non_strings_and_dedupes(tmp_path: Path) -> None:
    p = tmp_path / "prog.json"
    p.write_text(
        json.dumps(
            {
                "caught": {},
                "badges_unlocked": ["x", "x", 42, "", "  ", "y"],
            }
        ),
        encoding="utf-8",
    )
    out = JsonProgressRepository(p).load()
    assert out.badges_unlocked == ["x", "y"]


def test_load_badges_unlocked_bad_root_type(tmp_path: Path) -> None:
    p = tmp_path / "prog.json"
    p.write_text(
        json.dumps({"caught": {}, "badges_unlocked": "nope"}),
        encoding="utf-8",
    )
    out = JsonProgressRepository(p).load()
    assert out.badges_unlocked == []


def test_save_preserves_badges_unlocked_when_caller_omits_them(tmp_path: Path) -> None:
    p = tmp_path / "prog.json"
    p.write_text(
        json.dumps({"caught": {}, "badges_unlocked": ["first_catch"]}),
        encoding="utf-8",
    )
    repo = JsonProgressRepository(p)
    repo.save(CollectionProgress(statuses={}))
    out = repo.load()
    assert out.badges_unlocked == ["first_catch"]


def test_save_preserves_badges_when_file_unreadable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Defensive branch — OSError during re-load falls back to empty badges."""
    path = tmp_path / "prog.json"
    repo = JsonProgressRepository(path)

    calls = {"count": 0}
    real_load = repo.load

    def flaky_load() -> CollectionProgress:
        calls["count"] += 1
        if calls["count"] == 1:
            raise OSError("temporary glitch")
        return real_load()

    monkeypatch.setattr(repo, "load", flaky_load)
    repo.save(CollectionProgress(statuses={}))
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert raw["badges_unlocked"] == []
