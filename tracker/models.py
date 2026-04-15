"""Modèles Pydantic v2 — API progression."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CollectionProgress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    caught: dict[str, bool] = Field(default_factory=dict)


class ProgressPutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    caught: dict[str, bool] = Field(default_factory=dict)


class ProgressPatch(BaseModel):
    """Mise à jour incrémentale d’un slug (PATCH /api/progress)."""

    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1)
    caught: bool


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
