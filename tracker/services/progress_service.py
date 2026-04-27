"""Logique métier — progression attrapé / non attrapé (+ états enrichis F03)."""

from __future__ import annotations

from datetime import UTC, datetime

from tracker.models import (
    CollectionProgress,
    PokemonStatusEntry,
    ProgressPatch,
    ProgressPutBody,
    ProgressSaveResponse,
    ProgressStatusPatch,
)
from tracker.repository.base import ProgressRepository


class ProgressService:
    def __init__(self, repository: ProgressRepository) -> None:
        self._repository = repository

    def get_progress(self) -> CollectionProgress:
        return self._repository.load()

    def replace_caught(self, body: ProgressPutBody) -> ProgressSaveResponse:
        cleaned = _normalize_caught(body.caught)
        statuses = {slug: PokemonStatusEntry(state="caught") for slug in cleaned}
        to_store = CollectionProgress(caught=cleaned, statuses=statuses)
        self._repository.save(to_store)
        return ProgressSaveResponse(ok=True, saved=len(cleaned))

    def patch_caught(self, body: ProgressPatch) -> ProgressSaveResponse:
        current = self._repository.load()
        statuses = dict(current.statuses)
        key = body.slug.strip()
        if body.caught:
            prev = statuses.get(key)
            shiny = bool(prev.shiny) if prev else False
            seen_at = prev.seen_at if prev else _now_iso()
            statuses[key] = PokemonStatusEntry(
                state="caught",
                shiny=shiny,
                seen_at=seen_at,
            )
        else:
            statuses.pop(key, None)
        to_store = CollectionProgress(statuses=statuses)
        self._repository.save(to_store)
        return ProgressSaveResponse(ok=True, saved=_count_caught(statuses))

    def ensure_caught(self, slug: str) -> bool:
        """F09 — promote a slug to ``caught`` if it was not already.

        Returns ``True`` when the progress file has been mutated, ``False``
        when the slug was already caught (idempotent). Shiny flag is left
        untouched when the entry already exists.
        """
        key = slug.strip()
        if not key:
            return False
        current = self._repository.load()
        prev = current.statuses.get(key)
        if prev and prev.state == "caught":
            return False
        statuses = dict(current.statuses)
        statuses[key] = PokemonStatusEntry(
            state="caught",
            shiny=bool(prev.shiny) if prev else False,
            seen_at=prev.seen_at if prev and prev.seen_at else _now_iso(),
        )
        self._repository.save(CollectionProgress(statuses=statuses))
        return True

    def patch_status(self, body: ProgressStatusPatch) -> ProgressSaveResponse:
        current = self._repository.load()
        statuses = dict(current.statuses)
        key = body.slug.strip()
        if body.state == "not_met":
            statuses.pop(key, None)
        else:
            prev = statuses.get(key)
            seen_at = prev.seen_at if prev and prev.seen_at else _now_iso()
            shiny = body.shiny if body.state == "caught" else False
            statuses[key] = PokemonStatusEntry(
                state=body.state,
                shiny=shiny,
                seen_at=seen_at,
            )
        to_store = CollectionProgress(statuses=statuses)
        self._repository.save(to_store)
        return ProgressSaveResponse(ok=True, saved=_count_caught(statuses))


_TRUTHY = {True, "1", "true", "True"}


def _normalize_caught(raw: dict[str, bool]) -> dict[str, bool]:
    out: dict[str, bool] = {}
    for k, v in raw.items():
        if not isinstance(k, str):
            continue
        key = k.strip()
        if key and v in _TRUTHY:
            out[key] = True
    return out


def _count_caught(statuses: dict[str, PokemonStatusEntry]) -> int:
    return sum(1 for e in statuses.values() if e.state == "caught")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
