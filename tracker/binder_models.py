"""Modèles Pydantic v2 — persistance classeurs (v2), deux fichiers distincts."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

BINDER_FORMAT_VERSION: Literal[1] = 1
DEFAULT_CONVENTION = "sheet_recto_verso"


class BinderConfigPayload(BaseModel):
    """Schéma `binder-config.json` — grille, feuillets, règles de formes (évolution doc)."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = BINDER_FORMAT_VERSION
    convention: str = DEFAULT_CONVENTION
    binders: list[dict[str, Any]] = Field(default_factory=list)
    form_rules: list[dict[str, Any]] = Field(default_factory=list)


class BinderPlacementsPayload(BaseModel):
    """Schéma `binder-placements.json` — positions par classeur."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    by_binder: dict[str, dict[str, dict[str, Any]]] = Field(default_factory=dict)
