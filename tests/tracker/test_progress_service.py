"""tracker.services.progress_service."""

from __future__ import annotations

from pathlib import Path

from tracker.models import (
    CollectionProgress,
    PokemonNoteEntry,
    PokemonStatusEntry,
    ProgressNotePatch,
    ProgressPatch,
    ProgressPutBody,
    ProgressSaveResponse,
    ProgressStatusPatch,
)
from tracker.repository.json_progress_repository import JsonProgressRepository
from tracker.services.progress_service import ProgressService, _normalize_caught


def test_get_progress() -> None:
    class MemRepo:
        def load(self) -> CollectionProgress:
            return CollectionProgress(caught={"x": True})

        def save(self, data: CollectionProgress) -> None:
            raise AssertionError("not called")

    svc = ProgressService(MemRepo())  # type: ignore[arg-type]
    assert svc.get_progress().caught == {"x": True}


def test_replace_caught(tmp_path: Path) -> None:
    path = tmp_path / "p.json"
    repo = JsonProgressRepository(path)
    svc = ProgressService(repo)
    res = svc.replace_caught(ProgressPutBody(caught={"a": True, "b": False}))
    assert isinstance(res, ProgressSaveResponse)
    assert res.ok is True
    assert res.saved == 1
    assert repo.load().caught == {"a": True}


def test_patch_caught(tmp_path: Path) -> None:
    path = tmp_path / "p2.json"
    repo = JsonProgressRepository(path)
    svc = ProgressService(repo)
    svc.replace_caught(ProgressPutBody(caught={"a": True}))
    svc.patch_caught(ProgressPatch(slug="b", caught=True))
    assert repo.load().caught == {"a": True, "b": True}
    svc.patch_caught(ProgressPatch(slug="a", caught=False))
    assert repo.load().caught == {"b": True}


def test_replace_caught_seeds_statuses(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "p.json")
    svc = ProgressService(repo)
    svc.replace_caught(ProgressPutBody(caught={"pikachu": True}))
    loaded = repo.load()
    assert loaded.statuses["pikachu"].state == "caught"
    assert loaded.statuses["pikachu"].shiny is False


def test_patch_caught_preserves_shiny_flag(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "p.json")
    svc = ProgressService(repo)
    svc.patch_status(ProgressStatusPatch(slug="pikachu", state="caught", shiny=True))
    svc.patch_caught(ProgressPatch(slug="pikachu", caught=True))
    loaded = repo.load()
    assert loaded.statuses["pikachu"].state == "caught"
    assert loaded.statuses["pikachu"].shiny is True


def test_patch_status_cycle(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "p.json")
    svc = ProgressService(repo)
    r = svc.patch_status(ProgressStatusPatch(slug="bulbi", state="seen"))
    assert isinstance(r, ProgressSaveResponse)
    assert r.saved == 0
    assert repo.load().statuses["bulbi"].state == "seen"

    svc.patch_status(ProgressStatusPatch(slug="bulbi", state="caught", shiny=True))
    loaded = repo.load()
    assert loaded.statuses["bulbi"].state == "caught"
    assert loaded.statuses["bulbi"].shiny is True
    assert loaded.caught == {"bulbi": True}

    svc.patch_status(ProgressStatusPatch(slug="bulbi", state="not_met"))
    final = repo.load()
    assert "bulbi" not in final.statuses
    assert final.caught == {}


def test_patch_status_shiny_ignored_for_seen(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "p.json")
    svc = ProgressService(repo)
    svc.patch_status(ProgressStatusPatch(slug="x", state="seen", shiny=True))
    entry = repo.load().statuses["x"]
    assert entry.state == "seen"
    assert entry.shiny is False


def test_patch_status_preserves_seen_at(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "p.json")
    repo.save(
        CollectionProgress(
            statuses={
                "pika": PokemonStatusEntry(
                    state="seen", seen_at="2026-01-01T00:00:00+00:00"
                ),
            }
        )
    )
    svc = ProgressService(repo)
    svc.patch_status(ProgressStatusPatch(slug="pika", state="caught"))
    entry = repo.load().statuses["pika"]
    assert entry.state == "caught"
    assert entry.seen_at == "2026-01-01T00:00:00+00:00"


def test_patch_note_trims_saves_and_clears_empty_note(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "p.json")
    svc = ProgressService(repo)
    res = svc.patch_note(ProgressNotePatch(slug=" pikachu ", note="  Route 4 / échange  "))
    assert res.ok is True
    loaded = repo.load()
    assert loaded.notes["pikachu"].text == "Route 4 / échange"
    assert loaded.notes["pikachu"].updated_at

    svc.patch_note(ProgressNotePatch(slug="pikachu", note="   "))
    assert repo.load().notes == {}


def test_status_changes_preserve_pokedex_notes(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "p.json")
    repo.save(
        CollectionProgress(
            notes={
                "pika": PokemonNoteEntry(
                    text="Version Jaune",
                    updated_at="2026-04-28T10:00:00+00:00",
                )
            }
        )
    )
    svc = ProgressService(repo)
    svc.patch_status(ProgressStatusPatch(slug="pika", state="caught", shiny=True))
    svc.patch_caught(ProgressPatch(slug="pika", caught=False))
    loaded = repo.load()
    assert loaded.notes["pika"].text == "Version Jaune"
    assert "pika" not in loaded.statuses


def test_patch_caught_removes_entry(tmp_path: Path) -> None:
    repo = JsonProgressRepository(tmp_path / "p.json")
    svc = ProgressService(repo)
    svc.patch_status(ProgressStatusPatch(slug="foo", state="caught"))
    svc.patch_caught(ProgressPatch(slug="foo", caught=False))
    assert "foo" not in repo.load().statuses


def test_normalize_caught_types() -> None:
    raw = {
        1: True,
        "": False,
        "  ": True,
        "strip": True,
        "f": False,
        "t": True,
        "one": 1,
        "s1": "1",
        "st": "true",
        "sT": "True",
        "zero": 0,
        "bad": "nope",
    }
    out = _normalize_caught(raw)  # type: ignore[arg-type]
    assert out == {
        "strip": True,
        "t": True,
        "one": True,
        "s1": True,
        "st": True,
        "sT": True,
    }
