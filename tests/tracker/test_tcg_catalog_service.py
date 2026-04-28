"""tracker.services.tcg_catalog_service — Pokémon TCG API adapter."""

from __future__ import annotations

from typing import Any

import pytest
import requests
from fastapi import HTTPException

from tracker.services.tcg_catalog_service import TcgCatalogService


class FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, Any]) -> None:
        self.status_code = status_code
        self._payload = payload
        self.ok = 200 <= status_code < 300

    def json(self) -> dict[str, Any]:
        return self._payload


class InvalidJsonResponse(FakeResponse):
    def json(self) -> dict[str, Any]:
        raise ValueError("invalid")


def test_search_maps_api_cards_to_compact_results(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []

    def fake_get(
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout: float,
    ) -> FakeResponse:
        calls.append(
            {
                "url": url,
                "headers": headers,
                "params": params,
                "timeout": timeout,
            },
        )
        return FakeResponse(
            200,
            {
                "data": [
                    {
                        "id": "base1-4",
                        "name": "Charizard",
                        "number": "4",
                        "rarity": "Rare Holo",
                        "images": {
                            "small": "https://images.pokemontcg.io/base1/4.png",
                            "large": "https://images.pokemontcg.io/base1/4_hires.png",
                        },
                        "set": {"id": "base1", "name": "Base Set"},
                        "tcgplayer": {"url": "https://prices.example/base1-4"},
                    },
                ],
            },
        )

    monkeypatch.setattr(requests, "get", fake_get)
    service = TcgCatalogService(
        base_url="https://api.example.test/v2/",
        api_key="secret",
        timeout=4.0,
    )

    result = service.search("Charizard", page_size=3)

    assert calls == [
        {
            "url": "https://api.example.test/v2/cards",
            "headers": {"X-Api-Key": "secret"},
            "params": {
                "q": "name:*Charizard*",
                "pageSize": 3,
                "select": "id,name,number,rarity,images,set,tcgplayer",
            },
            "timeout": 4.0,
        },
    ]
    assert result.cards[0].model_dump() == {
        "id": "base1-4",
        "name": "Charizard",
        "set_id": "base1",
        "set_name": "Base Set",
        "number": "4",
        "rarity": "Rare Holo",
        "small_image_url": "https://images.pokemontcg.io/base1/4.png",
        "large_image_url": "https://images.pokemontcg.io/base1/4_hires.png",
        "tcgplayer_url": "https://prices.example/base1-4",
    }


def test_search_clamps_page_size_and_skips_blank_query(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    def fake_get(
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout: float,
    ) -> FakeResponse:
        nonlocal calls
        calls += 1
        assert params["pageSize"] == 24
        return FakeResponse(200, {"data": []})

    monkeypatch.setattr(requests, "get", fake_get)
    service = TcgCatalogService(base_url="https://api.example.test/v2")

    assert service.search("   ").cards == []
    assert service.search("♀").cards == []
    assert service.search("Pikachu", page_size=999).cards == []
    assert calls == 1


def test_search_tokenizes_simple_multi_word_queries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen_params: dict[str, Any] = {}

    def fake_get(
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout: float,
    ) -> FakeResponse:
        seen_params.update(params)
        return FakeResponse(200, {"data": []})

    monkeypatch.setattr(requests, "get", fake_get)
    service = TcgCatalogService(base_url="https://api.example.test/v2")

    service.search("Mr. Mime")

    assert seen_params["q"] == "name:*Mr* name:*Mime*"


def test_search_accepts_advanced_query_and_sparse_catalog_cards(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen_params: dict[str, Any] = {}

    def fake_get(
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout: float,
    ) -> FakeResponse:
        seen_params.update(params)
        return FakeResponse(200, {"data": [{}]})

    monkeypatch.setattr(requests, "get", fake_get)
    service = TcgCatalogService(base_url="https://api.example.test/v2")

    result = service.search('name:Pikachu set.name:"Base Set"')

    assert seen_params["q"] == 'name:Pikachu set.name:"Base Set"'
    assert result.cards[0].model_dump() == {
        "id": "",
        "name": "",
        "set_id": "",
        "set_name": "",
        "number": "",
        "rarity": "",
        "small_image_url": "",
        "large_image_url": "",
        "tcgplayer_url": "",
    }


def test_search_raises_bad_gateway_when_catalog_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_get(
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout: float,
    ) -> FakeResponse:
        raise requests.Timeout("slow")

    monkeypatch.setattr(requests, "get", fake_get)
    service = TcgCatalogService(base_url="https://api.example.test/v2")

    with pytest.raises(HTTPException) as exc:
        service.search("Pikachu")

    assert exc.value.status_code == 502


def test_search_raises_bad_gateway_when_catalog_returns_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_get(
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout: float,
    ) -> FakeResponse:
        return FakeResponse(500, {})

    monkeypatch.setattr(requests, "get", fake_get)
    service = TcgCatalogService(base_url="https://api.example.test/v2")

    with pytest.raises(HTTPException) as exc:
        service.search("Pikachu")

    assert exc.value.status_code == 502


def test_search_raises_bad_gateway_when_catalog_returns_invalid_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_get(
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout: float,
    ) -> InvalidJsonResponse:
        return InvalidJsonResponse(200, {})

    monkeypatch.setattr(requests, "get", fake_get)
    service = TcgCatalogService(base_url="https://api.example.test/v2")

    with pytest.raises(HTTPException) as exc:
        service.search("Pikachu")

    assert exc.value.status_code == 502
