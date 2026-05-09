"""Maintenance helpers for local state and shipped reference data."""

from __future__ import annotations

import shutil
from pathlib import Path

from tracker.models import (
    DataFileStatus,
    DataMaintenanceActionResponse,
    DataMaintenanceStatus,
)

REFERENCE_DATA_FILES = (
    "pokedex.json",
    "narrative-tags.json",
    "evolution-families.json",
    "evolution-family-overrides.json",
    "game-pokedexes.json",
    "badge-battles.json",
)

LOCAL_STATE_FILES = (
    "collection-progress.json",
    "binder-config.json",
    "binder-placements.json",
    "trainer-contacts.json",
    "hunts.json",
)


class DataMaintenanceService:
    def __init__(self, data_dir: Path, reference_data_dir: Path | None = None) -> None:
        self._data_dir = data_dir
        self._reference_data_dir = reference_data_dir or data_dir

    def status(self) -> DataMaintenanceStatus:
        files: list[DataFileStatus] = []
        for name in REFERENCE_DATA_FILES:
            target = self._data_dir / name
            source = self._reference_data_dir / name
            files.append(
                DataFileStatus(
                    name=name,
                    kind="reference",
                    present=target.is_file(),
                    refresh_available=source.is_file() and not self._same_path(source, target),
                )
            )
        for name in LOCAL_STATE_FILES:
            files.append(
                DataFileStatus(
                    name=name,
                    kind="local_state",
                    present=(self._data_dir / name).is_file(),
                )
            )
        return DataMaintenanceStatus(files=files)

    def refresh_reference_data(self) -> DataMaintenanceActionResponse:
        changed: list[str] = []
        missing_sources: list[str] = []
        self._data_dir.mkdir(parents=True, exist_ok=True)
        for name in REFERENCE_DATA_FILES:
            source = self._reference_data_dir / name
            target = self._data_dir / name
            if not source.is_file():
                missing_sources.append(name)
                continue
            if self._same_path(source, target):
                continue
            if target.is_file() and source.read_bytes() == target.read_bytes():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            changed.append(name)
        return DataMaintenanceActionResponse(changed=changed, missing_sources=missing_sources)

    def reset_local_data(self) -> DataMaintenanceActionResponse:
        changed: list[str] = []
        for name in LOCAL_STATE_FILES:
            target = self._data_dir / name
            if not target.exists():
                continue
            target.unlink()
            changed.append(name)
        return DataMaintenanceActionResponse(changed=changed)

    @staticmethod
    def _same_path(left: Path, right: Path) -> bool:
        try:
            return left.resolve() == right.resolve()
        except OSError:
            return False
