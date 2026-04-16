"""Service — full collection export and import."""

from __future__ import annotations

from datetime import datetime, timezone

from tracker.binder_models import BinderConfigPayload, BinderPlacementsPayload
from tracker.models import (
    CollectionProgress,
    ExportPayload,
    ImportPayload,
    ImportResponse,
)
from tracker.repository.base import (
    BinderConfigRepository,
    BinderPlacementsRepository,
    ProgressRepository,
)


class ExportService:
    def __init__(
        self,
        progress_repo: ProgressRepository,
        config_repo: BinderConfigRepository,
        placements_repo: BinderPlacementsRepository,
    ) -> None:
        self._progress = progress_repo
        self._config = config_repo
        self._placements = placements_repo

    def export_all(self) -> ExportPayload:
        return ExportPayload(
            exported_at=datetime.now(timezone.utc).isoformat(),
            progress=self._progress.load(),
            binder_config=self._config.load(),
            binder_placements=self._placements.load(),
        )

    def import_all(self, payload: ImportPayload) -> ImportResponse:
        progress = CollectionProgress(caught=payload.progress.caught)
        self._progress.save(progress)

        config = BinderConfigPayload(
            convention=payload.binder_config.convention,
            binders=payload.binder_config.binders,
            form_rules=payload.binder_config.form_rules,
        )
        self._config.save(config)

        placements = BinderPlacementsPayload(
            by_binder=payload.binder_placements.by_binder,
        )
        self._placements.save(placements)

        return ImportResponse(
            caught_count=len(progress.caught),
            binder_count=len(config.binders),
        )
