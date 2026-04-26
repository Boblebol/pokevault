"""Persistance JSON de la liste de recherches."""

from __future__ import annotations

import json
from pathlib import Path

from tracker.models import HuntList


class JsonHuntRepository:
    def __init__(self, file_path: Path) -> None:
        self._path = file_path

    def load(self) -> HuntList:
        if not self._path.is_file():
            return HuntList()
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return HuntList()
        if not isinstance(raw, dict):
            return HuntList()
        try:
            state = HuntList.model_validate(raw)
        except Exception:
            return HuntList()
        cleaned = {
            slug.strip(): entry
            for slug, entry in state.hunts.items()
            if isinstance(slug, str) and slug.strip() and entry.wanted
        }
        return HuntList(hunts=cleaned)

    def save(self, data: HuntList) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = data.model_dump(mode="json")
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

