"""Service — configuration classeurs (fichier dédié)."""

from __future__ import annotations

from tracker.binder_models import BinderConfigPayload
from tracker.repository.base import BinderConfigRepository


class BinderConfigService:
    def __init__(self, repository: BinderConfigRepository) -> None:
        self._repository = repository

    def get_config(self) -> BinderConfigPayload:
        return self._repository.load()

    def replace_config(self, body: BinderConfigPayload) -> BinderConfigPayload:
        self._repository.save(body)
        return body
