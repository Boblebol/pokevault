"""Contrôleur HTTP — carnet de cartes TCG (roadmap F08)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_card_service
from tracker.models import (
    Card,
    CardCreate,
    CardDeleteResponse,
    CardList,
    CardUpdate,
)
from tracker.services.card_service import CardService

router = APIRouter(prefix="/api", tags=["cards"])


@router.get("/cards", response_model=CardList)
def list_cards(
    service: Annotated[CardService, Depends(get_card_service)],
) -> CardList:
    return service.list_all()


@router.get("/cards/by-pokemon/{slug}", response_model=CardList)
def list_cards_by_pokemon(
    slug: str,
    service: Annotated[CardService, Depends(get_card_service)],
) -> CardList:
    return service.list_by_pokemon(slug)


@router.get("/cards/{card_id}", response_model=Card)
def get_card(
    card_id: str,
    service: Annotated[CardService, Depends(get_card_service)],
) -> Card:
    return service.get(card_id)


@router.post("/cards", response_model=Card, status_code=201)
def create_card(
    body: CardCreate,
    service: Annotated[CardService, Depends(get_card_service)],
) -> Card:
    return service.create(body)


@router.put("/cards/{card_id}", response_model=Card)
def update_card(
    card_id: str,
    body: CardUpdate,
    service: Annotated[CardService, Depends(get_card_service)],
) -> Card:
    return service.update(card_id, body)


@router.delete("/cards/{card_id}", response_model=CardDeleteResponse)
def delete_card(
    card_id: str,
    service: Annotated[CardService, Depends(get_card_service)],
) -> CardDeleteResponse:
    return service.delete(card_id)
