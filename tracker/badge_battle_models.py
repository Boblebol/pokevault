"""Pydantic models for exact badge battle metadata."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class LocalizedText(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fr: str = Field(min_length=1)
    en: str = Field(min_length=1)


class BadgeBattleTrainer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: LocalizedText
    role: LocalizedText
    history: LocalizedText


class BadgeBattleLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region: str = Field(min_length=1)
    city: LocalizedText
    place: LocalizedText


class BadgeBattleVariant(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["version", "starter"] = "version"
    value: str = ""


class BadgeBattlePokemon(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1)
    level: int = Field(ge=1, le=100)
    moves: list[LocalizedText] = Field(min_length=1, max_length=4)


class BadgeBattleEncounter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    label: LocalizedText
    games: list[Annotated[str, Field(min_length=1)]] = Field(min_length=1)
    variant: BadgeBattleVariant = Field(default_factory=BadgeBattleVariant)
    team: list[BadgeBattlePokemon] = Field(min_length=1)


class BadgeBattleDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trainer: BadgeBattleTrainer
    location: BadgeBattleLocation
    encounters: list[BadgeBattleEncounter] = Field(min_length=1)


class BadgeBattleCatalog(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1] = 1
    badges: dict[str, BadgeBattleDetail] = Field(default_factory=dict)
