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


CardCondition = Literal["mint", "near_mint", "excellent", "good", "played", "poor"]
"""Known card conditions — UI uses this list to populate the dropdown."""


class Card(BaseModel):
    """Physical TCG card tied to a Pokédex slug (roadmap F08).

    All fields except ``id`` and timestamps are free text; the service
    layer is responsible for trimming and basic sanity checks. ``id``
    is a server-generated UUID so clients can POST without one.
    """

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    pokemon_slug: str = Field(min_length=1)
    set_id: str = ""
    num: str = ""
    variant: str = ""
    lang: str = ""
    condition: CardCondition = "near_mint"
    qty: int = Field(default=1, ge=1)
    acquired_at: str | None = Field(default=None)
    note: str = ""
    created_at: str
    updated_at: str


class CardCreate(BaseModel):
    """POST /api/cards — server generates id + timestamps."""

    model_config = ConfigDict(extra="forbid")

    pokemon_slug: str = Field(min_length=1)
    set_id: str = ""
    num: str = ""
    variant: str = ""
    lang: str = ""
    condition: CardCondition = "near_mint"
    qty: int = Field(default=1, ge=1)
    acquired_at: str | None = Field(default=None)
    note: str = ""


class CardUpdate(BaseModel):
    """PUT /api/cards/{id} — full replacement, id/timestamps preserved."""

    model_config = ConfigDict(extra="forbid")

    pokemon_slug: str = Field(min_length=1)
    set_id: str = ""
    num: str = ""
    variant: str = ""
    lang: str = ""
    condition: CardCondition = "near_mint"
    qty: int = Field(default=1, ge=1)
    acquired_at: str | None = Field(default=None)
    note: str = ""


class CardList(BaseModel):
    """Persisted shape of ``data/collection-cards.json``."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    cards: list[Card] = Field(default_factory=list)


class CardDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    deleted: int = Field(ge=0)


class ExportPayload(BaseModel):
    """Full collection export — wraps progress + binder config + placements + cards."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[2] = 2
    app: str = "pokevault"
    exported_at: str
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload
    cards: list[Card] = Field(default_factory=list)


class ImportPayload(BaseModel):
    """Incoming import — accepts both schema v1 (legacy, no cards) and v2."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1, 2]
    app: str | None = None
    exported_at: str | None = None
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload
    cards: list[Card] = Field(default_factory=list)


class ImportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    caught_count: int = Field(ge=0)
    binder_count: int = Field(ge=0)
    card_count: int = Field(default=0, ge=0)
