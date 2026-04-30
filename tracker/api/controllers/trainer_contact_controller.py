"""API — contacts dresseurs locaux."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_trainer_contact_service
from tracker.models import (
    DeleteResponse,
    TrainerCard,
    TrainerContact,
    TrainerContactBook,
    TrainerContactImportResponse,
    TrainerContactNotePatch,
)
from tracker.services.trainer_contact_service import TrainerContactService

router = APIRouter(prefix="/api", tags=["trainers"])


@router.get("/trainers", response_model=TrainerContactBook)
def get_trainers(
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerContactBook:
    return service.get_book()


@router.put("/trainers/me", response_model=TrainerCard)
def put_own_trainer_card(
    body: TrainerCard,
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerCard:
    return service.save_own_card(body)


@router.get("/trainers/card", response_model=TrainerCard)
def export_own_trainer_card(
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerCard:
    return service.export_own_card()


@router.post("/trainers/import", response_model=TrainerContactImportResponse)
def import_trainer_card(
    body: TrainerCard,
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerContactImportResponse:
    return service.import_card(body)


@router.patch("/trainers/{trainer_id}/note", response_model=TrainerContact)
def patch_trainer_note(
    trainer_id: str,
    body: TrainerContactNotePatch,
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerContact:
    return service.patch_private_note(trainer_id, body)


@router.delete("/trainers/{trainer_id}", response_model=DeleteResponse)
def delete_trainer_contact(
    trainer_id: str,
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> DeleteResponse:
    return DeleteResponse(deleted=service.delete_contact(trainer_id))
