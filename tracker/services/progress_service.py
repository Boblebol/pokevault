"""Logique métier — progression attrapé / non attrapé."""

from __future__ import annotations

from tracker.models import (
    CollectionProgress,
    ProgressPatch,
    ProgressPutBody,
    ProgressSaveResponse,
)
from tracker.repository.base import ProgressRepository


class ProgressService:
    def __init__(self, repository: ProgressRepository) -> None:
        self._repository = repository

    def get_progress(self) -> CollectionProgress:
        return self._repository.load()

    def replace_caught(self, body: ProgressPutBody) -> ProgressSaveResponse:
        cleaned = _normalize_caught(body.caught)
        to_store = CollectionProgress(caught=cleaned)
        self._repository.save(to_store)
        return ProgressSaveResponse(ok=True, saved=len(to_store.caught))

    def patch_caught(self, body: ProgressPatch) -> ProgressSaveResponse:
        current = self._repository.load()
        caught = dict(current.caught)
        key = body.slug.strip()
        if body.caught:
            caught[key] = True
        else:
            caught.pop(key, None)
        to_store = CollectionProgress(caught=caught)
        self._repository.save(to_store)
        return ProgressSaveResponse(ok=True, saved=len(to_store.caught))


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
