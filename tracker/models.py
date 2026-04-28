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
    badges_unlocked: list[str] = Field(
        default_factory=list,
        description="Roadmap F12 — monotonically growing list of unlocked badge ids.",
    )


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
    tcg_api_id: str = Field(
        default="",
        description=(
            "Optional Pokémon TCG API card id used to reconnect local cards "
            "to catalog metadata."
        ),
    )
    image_url: str = Field(
        default="",
        description="F11 — optional scan/preview URL used by the artwork switcher.",
    )
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
    tcg_api_id: str = ""
    image_url: str = ""


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
    tcg_api_id: str = ""
    image_url: str = ""


class CardList(BaseModel):
    """Persisted shape of ``data/collection-cards.json``."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    cards: list[Card] = Field(default_factory=list)


class CardDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    deleted: int = Field(ge=0)


class TcgCardSearchResult(BaseModel):
    """Compact card metadata returned by the external Pokémon TCG catalog."""

    model_config = ConfigDict(extra="forbid")

    id: str = ""
    name: str = ""
    set_id: str = ""
    set_name: str = ""
    number: str = ""
    rarity: str = ""
    small_image_url: str = ""
    large_image_url: str = ""
    tcgplayer_url: str = ""


class TcgCardSearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cards: list[TcgCardSearchResult] = Field(default_factory=list)


HuntPriority = Literal["normal", "high"]


class HuntEntry(BaseModel):
    """A local-first search target tracked by the user."""

    model_config = ConfigDict(extra="forbid")

    wanted: bool = True
    priority: HuntPriority = "normal"
    note: str = ""
    updated_at: str


class HuntList(BaseModel):
    """Persisted shape of ``data/hunts.json``."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    hunts: dict[str, HuntEntry] = Field(default_factory=dict)


class HuntPatch(BaseModel):
    """PATCH /api/hunts/{slug} — create/update or clear a hunt target."""

    model_config = ConfigDict(extra="forbid")

    wanted: bool = True
    priority: HuntPriority = "normal"
    note: str = Field(default="", max_length=280)


class ExportPayload(BaseModel):
    """Full collection export — wraps progress + binder config + placements + cards."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[3] = 3
    app: str = "pokevault"
    exported_at: str
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload
    cards: list[Card] = Field(default_factory=list)
    hunts: HuntList = Field(default_factory=HuntList)


class ImportPayload(BaseModel):
    """Incoming import — accepts v1 legacy, v2 cards and v3 hunts."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1, 2, 3]
    app: str | None = None
    exported_at: str | None = None
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload
    cards: list[Card] = Field(default_factory=list)
    hunts: HuntList = Field(default_factory=HuntList)


class ImportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    caught_count: int = Field(ge=0)
    binder_count: int = Field(ge=0)
    card_count: int = Field(default=0, ge=0)
    hunt_count: int = Field(default=0, ge=0)


class Profile(BaseModel):
    """Roadmap F15 — isolated Pokédex profile (progress + cards + binders)."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, pattern=r"^[a-z0-9][a-z0-9_-]{0,31}$")
    name: str = Field(min_length=1, max_length=64)
    created_at: str


class ProfileRegistry(BaseModel):
    """Persisted shape of ``data/profiles.json``.

    The ``default`` profile is synthesised if absent so upgrades from
    single-profile installs stay seamless — it aliases the legacy
    ``data/*.json`` locations.
    """

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    active_id: str = "default"
    profiles: list[Profile] = Field(default_factory=list)


class ProfileCreate(BaseModel):
    """POST /api/profiles — free-text name, server derives id."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=64)


class ProfileSwitchBody(BaseModel):
    """PUT /api/profiles/active — select which profile is live."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)


class ProfileListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    active_id: str
    profiles: list[Profile] = Field(default_factory=list)


class ProfileDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    deleted: int = Field(ge=0)


class BadgeDefinition(BaseModel):
    """Roadmap F12 — static badge definition exposed to the UI."""

    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str
    unlocked: bool = False
    current: int = Field(default=0, ge=0)
    target: int = Field(default=1, ge=1)
    percent: int = Field(default=0, ge=0, le=100)
    hint: str = "Commence par une première action."


class BadgeState(BaseModel):
    """Roadmap F12 — ``GET /api/badges`` response."""

    model_config = ConfigDict(extra="forbid")

    catalog: list[BadgeDefinition] = Field(default_factory=list)
    unlocked: list[str] = Field(default_factory=list)
