"""Persistance JSON de la progression (hors pokedex.json)."""

from __future__ import annotations

import json
from pathlib import Path

from tracker.models import CollectionProgress


class JsonProgressRepository:
    """Implémentation fichier JSON du :class:`ProgressRepository`."""

    def __init__(self, file_path: Path) -> None:
        self._path = file_path

    def load(self) -> CollectionProgress:
        if not self._path.is_file():
            return CollectionProgress()
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return CollectionProgress()
        caught = raw.get("caught") if isinstance(raw, dict) else None
        if not isinstance(caught, dict):
            return CollectionProgress()
        normalized: dict[str, bool] = {}
        for k, v in caught.items():
            if isinstance(k, str) and k.strip() and isinstance(v, bool):
                normalized[k] = v
        return CollectionProgress(caught=normalized)

    def save(self, data: CollectionProgress) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = data.model_dump(mode="json")
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
