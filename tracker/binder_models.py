"""Modèles Pydantic v2 — persistance classeurs (v2), deux fichiers distincts."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class BinderConfigPayload(BaseModel):
    """Schéma `binder-config.json` — grille, feuillets, règles de formes (évolution doc)."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    convention: str = "sheet_recto_verso"
    binders: list[dict[str, Any]] = Field(default_factory=list)
    form_rules: list[dict[str, Any]] = Field(default_factory=list)


class BinderPlacementsPayload(BaseModel):
    """Schéma `binder-placements.json` — positions par classeur."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    by_binder: dict[str, dict[str, dict[str, Any]]] = Field(default_factory=dict)
