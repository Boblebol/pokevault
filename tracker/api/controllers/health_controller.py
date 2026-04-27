"""API — health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from tracker.version import APP_VERSION

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def get_health() -> dict[str, str]:
    return {"ok": "true", "app": "pokevault", "api_version": APP_VERSION}
