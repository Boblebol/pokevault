"""Adapter for the public Pokémon TCG API catalog."""

from __future__ import annotations

import re
from typing import Any

import requests
from fastapi import HTTPException

from tracker.models import TcgCardSearchResponse, TcgCardSearchResult

_SELECT_FIELDS = "id,name,number,rarity,images,set,tcgplayer"
_MAX_PAGE_SIZE = 24
_SIMPLE_QUERY_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


class TcgCatalogService:
    """Search cards in the Pokémon TCG API without persisting external data."""

    def __init__(
        self,
        base_url: str,
        api_key: str = "",
        timeout: float = 10.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key.strip()
        self._timeout = timeout

    def search(self, query: str, page_size: int = 12) -> TcgCardSearchResponse:
        q = _catalog_query(query)
        if not q:
            return TcgCardSearchResponse()

        params = {
            "q": q,
            "pageSize": max(1, min(page_size, _MAX_PAGE_SIZE)),
            "select": _SELECT_FIELDS,
        }
        headers = {"X-Api-Key": self._api_key} if self._api_key else {}

        try:
            response = requests.get(
                f"{self._base_url}/cards",
                headers=headers,
                params=params,
                timeout=self._timeout,
            )
        except requests.RequestException as exc:
            raise HTTPException(
                status_code=502,
                detail="pokemon tcg catalog unavailable",
            ) from exc

        if not response.ok:
            raise HTTPException(
                status_code=502,
                detail="pokemon tcg catalog error",
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail="pokemon tcg catalog returned invalid json",
            ) from exc

        raw_cards = payload.get("data") if isinstance(payload, dict) else None
        cards = [
            _parse_card(raw)
            for raw in raw_cards or []
            if isinstance(raw, dict)
        ]
        return TcgCardSearchResponse(cards=cards)


def _catalog_query(query: str) -> str:
    value = query.strip()
    if not value:
        return ""
    if ":" in value:
        return value
    tokens = _SIMPLE_QUERY_TOKEN_RE.findall(value)
    if not tokens:
        return ""
    return " ".join(f"name:*{_escape_query_token(token)}*" for token in tokens[:4])


def _escape_query_token(value: str) -> str:
    return value.replace("\\", "").replace('"', "").replace(":", "").strip()


def _parse_card(raw: dict[str, Any]) -> TcgCardSearchResult:
    images = raw.get("images")
    if not isinstance(images, dict):
        images = {}
    card_set = raw.get("set")
    if not isinstance(card_set, dict):
        card_set = {}
    tcgplayer = raw.get("tcgplayer")
    if not isinstance(tcgplayer, dict):
        tcgplayer = {}

    return TcgCardSearchResult(
        id=str(raw.get("id") or ""),
        name=str(raw.get("name") or ""),
        set_id=str(card_set.get("id") or ""),
        set_name=str(card_set.get("name") or ""),
        number=str(raw.get("number") or ""),
        rarity=str(raw.get("rarity") or ""),
        small_image_url=str(images.get("small") or ""),
        large_image_url=str(images.get("large") or ""),
        tcgplayer_url=str(tcgplayer.get("url") or ""),
    )
