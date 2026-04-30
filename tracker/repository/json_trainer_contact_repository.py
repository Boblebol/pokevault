"""Persistance JSON des contacts dresseurs."""

from __future__ import annotations

import json
from pathlib import Path

from tracker.models import TrainerContactBook


class JsonTrainerContactRepository:
    def __init__(self, file_path: Path) -> None:
        self._path = file_path

    def load(self) -> TrainerContactBook:
        if not self._path.is_file():
            return TrainerContactBook()
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return TrainerContactBook()
        if not isinstance(raw, dict):
            return TrainerContactBook()
        try:
            state = TrainerContactBook.model_validate(raw)
        except Exception:
            return TrainerContactBook()
        contacts = {
            trainer_id.strip(): contact
            for trainer_id, contact in state.contacts.items()
            if isinstance(trainer_id, str)
            and trainer_id.strip()
            and contact.card.trainer_id == trainer_id.strip()
        }
        return TrainerContactBook(own_card=state.own_card, contacts=contacts)

    def save(self, data: TrainerContactBook) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = data.model_dump(mode="json")
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
