"""tracker.api — Pokémon TCG catalog search."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.tcg_controller import router as tcg_router
from tracker.api.dependencies import get_tcg_catalog_service
from tracker.models import TcgCardSearchResponse, TcgCardSearchResult


class FakeTcgService:
    def __init__(self) -> None:
        self.calls: list[tuple[str, int]] = []

    def search(self, query: str, page_size: int) -> TcgCardSearchResponse:
        self.calls.append((query, page_size))
        return TcgCardSearchResponse(
            cards=[
                TcgCardSearchResult(
                    id="sv1-25",
                    name="Pikachu",
                    set_id="sv1",
                    set_name="Scarlet & Violet",
                    number="25",
                    rarity="Common",
                    small_image_url="https://images.example/sv1-25.png",
                    large_image_url="https://images.example/sv1-25_hires.png",
                    tcgplayer_url="https://prices.example/sv1-25",
                ),
            ],
        )


def test_search_cards_delegates_to_catalog_service() -> None:
    service = FakeTcgService()
    app = FastAPI()
    app.include_router(tcg_router)
    app.dependency_overrides[get_tcg_catalog_service] = lambda: service
    client = TestClient(app)

    response = client.get("/api/tcg/cards/search", params={"q": "Pikachu", "page_size": 5})

    assert response.status_code == 200
    assert service.calls == [("Pikachu", 5)]
    assert response.json()["cards"][0] == {
        "id": "sv1-25",
        "name": "Pikachu",
        "set_id": "sv1",
        "set_name": "Scarlet & Violet",
        "number": "25",
        "rarity": "Common",
        "small_image_url": "https://images.example/sv1-25.png",
        "large_image_url": "https://images.example/sv1-25_hires.png",
        "tcgplayer_url": "https://prices.example/sv1-25",
    }


def test_search_cards_accepts_blank_query_without_network_call() -> None:
    service = FakeTcgService()
    app = FastAPI()
    app.include_router(tcg_router)
    app.dependency_overrides[get_tcg_catalog_service] = lambda: service
    client = TestClient(app)

    response = client.get("/api/tcg/cards/search", params={"q": "   "})

    assert response.status_code == 200
    assert response.json() == {"cards": []}
    assert service.calls == []
