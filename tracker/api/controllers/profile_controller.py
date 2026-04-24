"""Contrôleur HTTP — profils Pokédex (roadmap F15)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_profile_service
from tracker.models import (
    Profile,
    ProfileCreate,
    ProfileDeleteResponse,
    ProfileListResponse,
    ProfileSwitchBody,
)
from tracker.services.profile_service import ProfileService

router = APIRouter(prefix="/api", tags=["profiles"])


def _snapshot(service: ProfileService) -> ProfileListResponse:
    reg = service.list_profiles()
    return ProfileListResponse(active_id=reg.active_id, profiles=list(reg.profiles))


@router.get("/profiles", response_model=ProfileListResponse)
def list_profiles(
    service: Annotated[ProfileService, Depends(get_profile_service)],
) -> ProfileListResponse:
    return _snapshot(service)


@router.post("/profiles", response_model=Profile, status_code=201)
def create_profile(
    body: ProfileCreate,
    service: Annotated[ProfileService, Depends(get_profile_service)],
) -> Profile:
    return service.create(body)


@router.put("/profiles/active", response_model=ProfileListResponse)
def switch_profile(
    body: ProfileSwitchBody,
    service: Annotated[ProfileService, Depends(get_profile_service)],
) -> ProfileListResponse:
    service.set_active(body.id)
    return _snapshot(service)


@router.delete("/profiles/{profile_id}", response_model=ProfileDeleteResponse)
def delete_profile(
    profile_id: str,
    service: Annotated[ProfileService, Depends(get_profile_service)],
) -> ProfileDeleteResponse:
    deleted = service.delete(profile_id)
    return ProfileDeleteResponse(ok=True, deleted=deleted)
