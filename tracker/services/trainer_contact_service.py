"""Logique métier — cartes dresseur locales."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException

from tracker.models import (
    TrainerCard,
    TrainerContact,
    TrainerContactBook,
    TrainerContactImportResponse,
    TrainerContactNotePatch,
)
from tracker.repository.base import TrainerContactRepository


class TrainerContactService:
    def __init__(self, repository: TrainerContactRepository) -> None:
        self._repository = repository

    def get_book(self) -> TrainerContactBook:
        return self._repository.load()

    def save_own_card(self, card: TrainerCard) -> TrainerCard:
        book = self._repository.load()
        clean = self._clean_card(card, stamp=True)
        book.own_card = clean
        self._repository.save(book)
        return clean

    def export_own_card(self) -> TrainerCard:
        card = self._repository.load().own_card
        if card is None:
            raise HTTPException(status_code=404, detail="trainer card not found")
        return card

    def import_card(self, card: TrainerCard) -> TrainerContactImportResponse:
        clean = self._clean_card(card, stamp=False)
        if not clean.trainer_id:
            raise HTTPException(status_code=400, detail="trainer_id is required")
        book = self._repository.load()
        existing = book.contacts.get(clean.trainer_id)
        now = _now_iso()
        if existing is None:
            contact = TrainerContact(card=clean, first_received_at=now, last_received_at=now)
            book.contacts[clean.trainer_id] = contact
            self._repository.save(book)
            return TrainerContactImportResponse(action="created", contact=contact)
        if _is_newer(clean.updated_at, existing.card.updated_at):
            contact = TrainerContact(
                card=clean,
                private_note=existing.private_note,
                first_received_at=existing.first_received_at,
                last_received_at=now,
            )
            book.contacts[clean.trainer_id] = contact
            self._repository.save(book)
            return TrainerContactImportResponse(action="updated", contact=contact)
        return TrainerContactImportResponse(action="unchanged", contact=existing)

    def patch_private_note(self, trainer_id: str, body: TrainerContactNotePatch) -> TrainerContact:
        key = trainer_id.strip()
        book = self._repository.load()
        contact = book.contacts.get(key)
        if contact is None:
            raise HTTPException(status_code=404, detail="trainer contact not found")
        updated = contact.model_copy(update={"private_note": body.note.strip()})
        book.contacts[key] = updated
        self._repository.save(book)
        return updated

    def delete_contact(self, trainer_id: str) -> int:
        key = trainer_id.strip()
        book = self._repository.load()
        if key not in book.contacts:
            return 0
        del book.contacts[key]
        self._repository.save(book)
        return 1

    @staticmethod
    def _clean_card(card: TrainerCard, *, stamp: bool) -> TrainerCard:
        links = [
            link.model_copy(update={"label": link.label.strip(), "value": link.value.strip()})
            for link in card.contact_links
            if link.value.strip()
        ]
        return card.model_copy(
            update={
                "trainer_id": card.trainer_id.strip(),
                "display_name": card.display_name.strip(),
                "favorite_region": card.favorite_region.strip(),
                "favorite_pokemon_slug": card.favorite_pokemon_slug.strip(),
                "public_note": card.public_note.strip(),
                "contact_links": links,
                "for_trade": _clean_list(card.for_trade),
                "updated_at": _now_iso() if stamp else card.updated_at,
            },
        )


def _clean_list(values: list[str]) -> list[str]:
    out: list[str] = []
    for value in values:
        item = str(value or "").strip()
        if not item:
            continue
        out.append(item)
    return out


def _is_newer(candidate: str, current: str) -> bool:
    return candidate > current


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
