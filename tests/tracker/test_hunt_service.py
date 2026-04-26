"""tracker.services.hunt_service (v0.7 Hunt List)."""

from __future__ import annotations

from pathlib import Path

from tracker.models import HuntPatch
from tracker.repository.json_hunt_repository import JsonHuntRepository
from tracker.services.hunt_service import HuntService


def test_patch_hunt_creates_entry(tmp_path: Path) -> None:
    repo = JsonHuntRepository(tmp_path / "hunts.json")
    service = HuntService(repo)

    state = service.patch_hunt(
        "0025-pikachu",
        HuntPatch(wanted=True, priority="high", note="Chercher holo"),
    )

    entry = state.hunts["0025-pikachu"]
    assert entry.wanted is True
    assert entry.priority == "high"
    assert entry.note == "Chercher holo"
    assert entry.updated_at


def test_patch_hunt_wanted_false_removes_entry(tmp_path: Path) -> None:
    repo = JsonHuntRepository(tmp_path / "hunts.json")
    service = HuntService(repo)
    service.patch_hunt("0025-pikachu", HuntPatch(wanted=True, priority="high"))

    state = service.patch_hunt("0025-pikachu", HuntPatch(wanted=False))

    assert "0025-pikachu" not in state.hunts


def test_repository_tolerates_missing_and_malformed_files(tmp_path: Path) -> None:
    repo = JsonHuntRepository(tmp_path / "missing.json")
    assert repo.load().hunts == {}

    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    assert JsonHuntRepository(broken).load().hunts == {}

