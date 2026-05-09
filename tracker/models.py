"""Modèles Pydantic v2 — API progression + export/import."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from tracker.badge_battle_models import BadgeBattleDetail
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
    seen_at: str | None = Field(
        default=None,
        description="ISO-8601 timestamp of the first seen/catch event (optional).",
    )


class PokemonNoteEntry(BaseModel):
    """Personal Pokédex note stored per Pokémon slug."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=500)
    updated_at: str


class CollectionProgress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    caught: dict[str, bool] = Field(default_factory=dict)
    statuses: dict[str, PokemonStatusEntry] = Field(default_factory=dict)
    notes: dict[str, PokemonNoteEntry] = Field(default_factory=dict)
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
    champ legacy ``shiny`` est accepté et ignoré.
    """

    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1)
    state: Literal["not_met", "seen", "caught"]
    shiny: bool = False


class ProgressNotePatch(BaseModel):
    """Mise à jour de note personnelle Pokédex (B4)."""

    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1)
    note: str = Field(default="", max_length=500)


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


TrainerContactMethod = Literal[
    "email",
    "phone",
    "discord",
    "instagram",
    "facebook",
    "website",
    "other",
]


class TrainerContactLink(BaseModel):
    """Optional public contact line included in a portable Trainer Card."""

    model_config = ConfigDict(extra="forbid")

    kind: TrainerContactMethod = "other"
    label: str = Field(default="", max_length=32)
    value: str = Field(default="", max_length=160)


class TrainerCard(BaseModel):
    """Portable local-first card shared manually between collectors."""

    model_config = ConfigDict(extra="ignore")

    schema_version: Literal[1] = 1
    app: Literal["pokevault"] = "pokevault"
    kind: Literal["trainer_card"] = "trainer_card"
    trainer_id: str = Field(min_length=8, max_length=80)
    display_name: str = Field(min_length=1, max_length=64)
    favorite_region: str = Field(default="", max_length=32)
    favorite_pokemon_slug: str = Field(default="", max_length=80)
    public_note: str = Field(default="", max_length=280)
    contact_links: list[TrainerContactLink] = Field(default_factory=list, max_length=6)
    for_trade: list[str] = Field(default_factory=list, max_length=80)
    updated_at: str


class TrainerContact(BaseModel):
    """A received Trainer Card plus local-only metadata."""

    model_config = ConfigDict(extra="forbid")

    card: TrainerCard
    private_note: str = Field(default="", max_length=500)
    first_received_at: str
    last_received_at: str


class TrainerContactBook(BaseModel):
    """Persisted shape of local trainer contacts."""

    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    own_card: TrainerCard | None = None
    contacts: dict[str, TrainerContact] = Field(default_factory=dict)


class TrainerContactImportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    action: Literal["created", "updated", "unchanged"]
    contact: TrainerContact


class TrainerContactNotePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str = Field(default="", max_length=500)


class DeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    deleted: int = Field(ge=0)


class ExportPayload(BaseModel):
    """Full collection export without legacy hunts or removed card catalog data."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[5] = 5
    app: str = "pokevault"
    exported_at: str
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload


class ImportPayload(BaseModel):
    """Incoming import accepts legacy hunt/card-bearing backups and ignores them."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1, 2, 3, 4, 5]
    app: str | None = None
    exported_at: str | None = None
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload

    @model_validator(mode="before")
    @classmethod
    def _drop_legacy_hunts_and_cards(cls, data):
        if isinstance(data, dict) and "hunts" in data:
            cleaned = dict(data)
            cleaned.pop("hunts", None)
            cleaned.pop("cards", None)
            return cleaned
        if isinstance(data, dict) and "cards" in data:
            cleaned = dict(data)
            cleaned.pop("cards", None)
            return cleaned
        return data


class ImportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    caught_count: int = Field(ge=0)
    binder_count: int = Field(ge=0)


class DataFileStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    kind: Literal["reference", "local_state"]
    present: bool
    refresh_available: bool = False


class DataMaintenanceStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    files: list[DataFileStatus] = Field(default_factory=list)


class DataMaintenanceActionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    changed: list[str] = Field(default_factory=list)
    missing_sources: list[str] = Field(default_factory=list)


class BadgeLocalizedCopy(BaseModel):
    """Localized badge display copy and locked mystery copy."""

    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    mystery_title: str = ""
    mystery_hint: str = ""


class BadgeRequirementPokemon(BaseModel):
    """Pokemon required by a team badge, with current completion state."""

    model_config = ConfigDict(extra="forbid")

    slug: str
    caught: bool = False


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
    category: str = "milestone"
    region: str = "global"
    rarity: str = "common"
    effect: str = "metal"
    reveal: str = "transparent"
    i18n: dict[str, BadgeLocalizedCopy] = Field(default_factory=dict)
    requirements: list[BadgeRequirementPokemon] = Field(default_factory=list)
    battle: BadgeBattleDetail | None = None


class BadgeState(BaseModel):
    """Roadmap F12 — ``GET /api/badges`` response."""

    model_config = ConfigDict(extra="forbid")

    catalog: list[BadgeDefinition] = Field(default_factory=list)
    unlocked: list[str] = Field(default_factory=list)
