"""Lecture / écriture de `data/binder-config.json`."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import ValidationError

from tracker.binder_models import BinderConfigPayload


class JsonBinderConfigRepository:
    def __init__(self, file_path: Path) -> None:
        self._path = file_path

    def load(self) -> BinderConfigPayload:
        if not self._path.is_file():
            return BinderConfigPayload()
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return BinderConfigPayload()
        if not isinstance(raw, dict):
            return BinderConfigPayload()
        try:
            return BinderConfigPayload.model_validate(raw)
        except ValidationError:
            return BinderConfigPayload()

    def save(self, data: BinderConfigPayload) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(data.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
