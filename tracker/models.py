"""Modèles Pydantic v2 — API progression + export/import."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from tracker.binder_models import BinderConfigPayload, BinderPlacementsPayload

PokemonState = Literal["seen", "caught"]
"""Two persisted states; absence of a slug means ``not_met``."""


class PokemonStatusEntry(BaseModel):
    """Enriched Pokédex status (roadmap F03).

    Stored per-slug; a missing slug means the Pokémon has not been met yet.
    ``caught`` stays the canonical catching bit — see
    :class:`CollectionProgress` for how the legacy ``caught`` dict is
    derived from ``state``.
    """

    model_config = ConfigDict(extra="forbid")

    state: PokemonState
    shiny: bool = False
    seen_at: str | None = Field(
        default=None,
        description="ISO-8601 timestamp of the first seen/catch event (optional).",
    )


class CollectionProgress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    caught: dict[str, bool] = Field(default_factory=dict)
    statuses: dict[str, PokemonStatusEntry] = Field(default_factory=dict)


class ProgressPutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    caught: dict[str, bool] = Field(default_factory=dict)


class ProgressPatch(BaseModel):
    """Mise à jour incrémentale d’un slug (PATCH /api/progress)."""

    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1)
    caught: bool


class ProgressStatusPatch(BaseModel):
    """Mise à jour enrichie du statut Pokédex (F03).

    ``state`` accepte ``not_met`` qui supprime l'entrée côté serveur. Le
    flag ``shiny`` n'est conservé que lorsque ``state == "caught"``.
    """

    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1)
    state: Literal["not_met", "seen", "caught"]
    shiny: bool = False


class ProgressSaveResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    saved: int = Field(ge=0, description="Nombre de slugs marqués attrapés après normalisation.")


class BinderRestPutBody(BaseModel):
    """PUT /api/binder/{id} — corps pour créer ou remplacer un classeur."""

    model_config = ConfigDict(extra="forbid")

    binder: dict[str, Any] = Field(default_factory=dict)
    placements: dict[str, dict[str, Any]] = Field(default_factory=dict)
    form_rule: dict[str, Any] | None = None


class ExportPayload(BaseModel):
    """Full collection export — wraps progress + binder config + placements."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    app: str = "pokevault"
    exported_at: str
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload


class ImportPayload(BaseModel):
    """Incoming import — same shape as ExportPayload."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1]
    app: str | None = None
    exported_at: str | None = None
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload


class ImportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    caught_count: int = Field(ge=0)
    binder_count: int = Field(ge=0)
