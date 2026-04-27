"""Logique métier — liste de recherches Pokédex."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from tracker.models import HuntEntry, HuntList, HuntPatch
from tracker.repository.base import HuntRepository


class HuntService:
    def __init__(self, repository: HuntRepository) -> None:
        self._repository = repository

    def list_hunts(self) -> HuntList:
        return self._repository.load()

    def patch_hunt(self, slug: str, body: HuntPatch) -> HuntList:
        key = slug.strip()
        if not key:
            raise HTTPException(status_code=400, detail="slug is required")
        current = self._repository.load()
        hunts = dict(current.hunts)
        if not body.wanted:
            hunts.pop(key, None)
        else:
            hunts[key] = HuntEntry(
                wanted=True,
                priority=body.priority,
                note=body.note.strip(),
                updated_at=_now_iso(),
            )
        next_state = HuntList(hunts=hunts)
        self._repository.save(next_state)
        return next_state


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

