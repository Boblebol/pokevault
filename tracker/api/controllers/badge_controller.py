"""Contrôleur HTTP — badges Pokédex (roadmap F12)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_badge_service
from tracker.models import BadgeState
from tracker.services.badge_service import BadgeService

router = APIRouter(prefix="/api", tags=["badges"])


@router.get("/badges", response_model=BadgeState)
def get_badges(
    service: Annotated[BadgeService, Depends(get_badge_service)],
) -> BadgeState:
    """Return the full badge catalog + persisted unlocked ids.

    Each call also re-evaluates predicates, so any milestone reached
    between two mutations is guaranteed to be persisted here (the UI
    can diff against its local snapshot to surface unlocks).
    """
    service.sync_unlocked()
    return service.state()
