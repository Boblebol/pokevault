"""Logique métier — carnet de cartes TCG physiques (roadmap F08 + F09)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException

from tracker.models import (
    Card,
    CardCreate,
    CardDeleteResponse,
    CardList,
    CardUpdate,
)
from tracker.repository.base import CardRepository
from tracker.services.progress_service import ProgressService


class CardService:
    """CRUD + indexation par slug du carnet de cartes.

    F09 — ajouter la première carte d'un slug promeut automatiquement le
    statut Pokédex à ``caught`` via :meth:`ProgressService.ensure_caught`.
    La suppression respecte l'intention : même si la dernière carte d'un
    slug disparaît, le Pokédex reste marqué capturé.
    """

    def __init__(
        self,
        repository: CardRepository,
        progress_service: ProgressService | None = None,
    ) -> None:
        self._repository = repository
        self._progress = progress_service

    def list_all(self) -> CardList:
        return self._repository.load()

    def list_by_pokemon(self, slug: str) -> CardList:
        key = slug.strip()
        if not key:
            return CardList()
        current = self._repository.load()
        filtered = [c for c in current.cards if c.pokemon_slug == key]
        return CardList(cards=filtered)

    def get(self, card_id: str) -> Card:
        current = self._repository.load()
        for card in current.cards:
            if card.id == card_id:
                return card
        raise HTTPException(status_code=404, detail="card not found")

    def create(self, payload: CardCreate) -> Card:
        now = _now_iso()
        card = Card(
            id=_new_id(),
            pokemon_slug=payload.pokemon_slug.strip(),
            set_id=payload.set_id.strip(),
            num=payload.num.strip(),
            variant=payload.variant.strip(),
            lang=payload.lang.strip().lower(),
            condition=payload.condition,
            qty=payload.qty,
            acquired_at=(payload.acquired_at or None),
            note=payload.note.strip(),
            image_url=payload.image_url.strip(),
            created_at=now,
            updated_at=now,
        )
        current = self._repository.load()
        current.cards.append(card)
        self._repository.save(current)
        if self._progress is not None:
            self._progress.ensure_caught(card.pokemon_slug)
        return card

    def update(self, card_id: str, payload: CardUpdate) -> Card:
        current = self._repository.load()
        for idx, card in enumerate(current.cards):
            if card.id != card_id:
                continue
            updated = Card(
                id=card.id,
                pokemon_slug=payload.pokemon_slug.strip(),
                set_id=payload.set_id.strip(),
                num=payload.num.strip(),
                variant=payload.variant.strip(),
                lang=payload.lang.strip().lower(),
                condition=payload.condition,
                qty=payload.qty,
                acquired_at=(payload.acquired_at or None),
                note=payload.note.strip(),
                image_url=payload.image_url.strip(),
                created_at=card.created_at,
                updated_at=_now_iso(),
            )
            current.cards[idx] = updated
            self._repository.save(current)
            if self._progress is not None and updated.pokemon_slug != card.pokemon_slug:
                self._progress.ensure_caught(updated.pokemon_slug)
            return updated
        raise HTTPException(status_code=404, detail="card not found")

    def delete(self, card_id: str) -> CardDeleteResponse:
        current = self._repository.load()
        remaining = [c for c in current.cards if c.id != card_id]
        if len(remaining) == len(current.cards):
            return CardDeleteResponse(ok=True, deleted=0)
        self._repository.save(CardList(cards=remaining))
        return CardDeleteResponse(ok=True, deleted=1)


def _new_id() -> str:
    return str(uuid4())


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
