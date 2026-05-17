"""Tests pour l'API bundle."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.bundle_controller import router as bundle_router
from tracker.api.dependencies import get_bundle_service
from tracker.config import TrackerSettings
from tracker.services.bundle_service import BundleService


def test_get_bundle_service():
    settings = TrackerSettings(
        data_dir=Path("data"),
        pokedex_path=Path("data/pokedex.json"),
    )
    service = get_bundle_service(settings)
    assert isinstance(service, BundleService)

def test_get_bundle(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    pokedex_path = data_dir / "pokedex.json"
    pokedex_path.write_text("{}")

    app = FastAPI()
    app.include_router(bundle_router)

    def override_bundle_service():
        return BundleService(data_dir, pokedex_path)

    app.dependency_overrides[get_bundle_service] = override_bundle_service

    client = TestClient(app)
    response = client.get("/api/bundle")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert "pokedex" in data

