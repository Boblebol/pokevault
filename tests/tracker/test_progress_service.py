"""tracker.services.progress_service."""

from __future__ import annotations

from pathlib import Path

from tracker.models import CollectionProgress, ProgressPatch, ProgressPutBody, ProgressSaveResponse
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
