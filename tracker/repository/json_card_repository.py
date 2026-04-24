"""Persistance JSON du carnet de cartes TCG (roadmap F08)."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import ValidationError

from tracker.models import Card, CardList


class JsonCardRepository:
    """Implémentation fichier JSON de :class:`CardRepository`.

    Le fichier stocke une simple liste de cartes — l'index par slug
    est recalculé à la volée côté service. Les entrées invalides
    (clés manquantes, types incohérents) sont filtrées au chargement
    pour garantir un état en mémoire toujours propre.
    """

    def __init__(self, file_path: Path) -> None:
        self._path = file_path

    def load(self) -> CardList:
        if not self._path.is_file():
            return CardList()
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return CardList()
        if not isinstance(raw, dict):
            return CardList()
        raw_cards = raw.get("cards")
        if not isinstance(raw_cards, list):
            return CardList()
        kept: list[Card] = []
        for entry in raw_cards:
            if not isinstance(entry, dict):
                continue
            try:
                kept.append(Card.model_validate(entry))
            except ValidationError:
                continue
        return CardList(cards=kept)

    def save(self, data: CardList) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = data.model_dump(mode="json")
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
