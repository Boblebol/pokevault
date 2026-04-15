"""Service — placements classeurs (fichier dédié, séparé de la config)."""

from __future__ import annotations

from tracker.binder_models import BinderPlacementsPayload
from tracker.repository.json_binder_placements_repository import JsonBinderPlacementsRepository


class BinderPlacementsService:
    def __init__(self, repository: JsonBinderPlacementsRepository) -> None:
        self._repository = repository

    def get_placements(self) -> BinderPlacementsPayload:
        return self._repository.load()

    def replace_placements(self, body: BinderPlacementsPayload) -> BinderPlacementsPayload:
        self._repository.save(body)
        return body
