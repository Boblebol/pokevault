"""tracker.api — health endpoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.health_controller import router as health_router


def test_health_ok() -> None:
    app = FastAPI()
    app.include_router(health_router)
    client = TestClient(app)

    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] == "true"
    assert body["app"] == "pokevault"
    assert "api_version" in body
