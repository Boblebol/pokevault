"""tracker.config — Pydantic Settings v2."""

from __future__ import annotations

from pathlib import Path

import pytest

from tracker.config import TrackerSettings, get_settings


def test_tracker_settings_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TRACKER_HOST", raising=False)
    monkeypatch.delenv("TRACKER_PORT", raising=False)
    monkeypatch.delenv("TRACKER_REPO_ROOT", raising=False)
    root = tmp_path / "repo"
    root.mkdir()
    s = TrackerSettings(repo_root=root)
    assert s.host == "127.0.0.1"
    assert s.port == 8765
    assert s.web_dir == root / "web"
    assert s.data_dir == root / "data"
    assert s.progress_path == root / "data" / "collection-progress.json"
    assert s.binder_config_path == root / "data" / "binder-config.json"
    assert s.binder_placements_path == root / "data" / "binder-placements.json"
    assert s.pokedex_path == root / "data" / "pokedex.json"
    assert s.trainer_contacts_path == root / "data" / "trainer-contacts.json"
    assert s.reference_data_dir is None


def test_tracker_settings_from_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TRACKER_HOST", "0.0.0.0")
    monkeypatch.setenv("TRACKER_PORT", "9999")
    root = tmp_path / "r"
    root.mkdir()
    monkeypatch.setenv("TRACKER_REPO_ROOT", str(root))
    reference_dir = tmp_path / "reference-data"
    monkeypatch.setenv("TRACKER_REFERENCE_DATA_DIR", str(reference_dir))
    s = TrackerSettings()
    assert s.host == "0.0.0.0"
    assert s.port == 9999
    assert s.repo_root == root.resolve()
    assert s.reference_data_dir == reference_dir


def test_get_settings_is_cached() -> None:
    get_settings.cache_clear()
    a = get_settings()
    b = get_settings()
    assert a is b
