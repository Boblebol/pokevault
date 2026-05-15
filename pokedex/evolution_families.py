"""Build local evolution-family layout data for binder views."""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests

POKEAPI_ROOT = "https://pokeapi.co/api/v2"


def species_id_from_url(url: str) -> int:
    parts = [p for p in str(url).rstrip("/").split("/") if p]
    return int(parts[-1])


def layout_rows_from_paths(paths: Iterable[Iterable[int]]) -> list[list[int | None]]:
    """Return stage-aligned rows, blanking already-emitted ancestors."""

    normalized = [list(path) for path in paths if path]
    if not normalized:
        return []
    width = max(len(path) for path in normalized)
    seen: set[int] = set()
    rows: list[list[int | None]] = []
    for path in normalized:
        row: list[int | None] = []
        for idx in range(width):
            if idx >= len(path):
                row.append(None)
                continue
            number = int(path[idx])
            if number in seen:
                row.append(None)
                continue
            row.append(number)
            seen.add(number)
        rows.append(row)
    return rows


def paths_from_chain_node(node: Mapping[str, Any]) -> list[list[int]]:
    species = node.get("species") if isinstance(node, Mapping) else None
    if not isinstance(species, Mapping) or not species.get("url"):
        return []
    current = species_id_from_url(str(species["url"]))
    children = node.get("evolves_to")
    if not isinstance(children, list) or not children:
        return [[current]]
    paths: list[list[int]] = []
    for child in children:
        if not isinstance(child, Mapping):
            continue
        for path in paths_from_chain_node(child):
            paths.append([current, *path])
    return paths or [[current]]


def _national_number(row: Mapping[str, Any]) -> int:
    raw = str(row.get("number") or "").replace("#", "").strip()
    return int(raw.lstrip("0") or "0")


def _is_base_entry(row: Mapping[str, Any]) -> bool:
    return not str(row.get("form") or "").strip()


def _preferred_pokemon_by_number(
    pokedex_payload: Mapping[str, Any],
) -> dict[int, Mapping[str, Any]]:
    raw_pokemon = pokedex_payload.get("pokemon", [])
    if not isinstance(raw_pokemon, list):
        return {}
    by_number: dict[int, Mapping[str, Any]] = {}
    for row in raw_pokemon:
        if not isinstance(row, Mapping):
            continue
        number = _national_number(row)
        slug = str(row.get("slug") or "")
        if number <= 0 or not slug:
            continue
        current = by_number.get(number)
        if current is None or (not _is_base_entry(current) and _is_base_entry(row)):
            by_number[number] = row
    return by_number


def _display_name_fr(row: Mapping[str, Any]) -> str:
    names = row.get("names")
    if isinstance(names, Mapping):
        for key in ("fr", "en", "ja"):
            value = str(names.get(key) or "").strip()
            if value:
                return value
    return str(row.get("slug") or "").strip()


def _slug_rows_from_number_rows(
    rows: Iterable[Iterable[int | None]],
    by_number: Mapping[int, Mapping[str, Any]],
) -> list[list[str | None]]:
    out: list[list[str | None]] = []
    for row in rows:
        mapped: list[str | None] = []
        has_value = False
        for number in row:
            if number is None:
                mapped.append(None)
                continue
            pokemon = by_number.get(int(number))
            if not pokemon:
                mapped.append(None)
                continue
            mapped.append(str(pokemon["slug"]))
            has_value = True
        if has_value:
            out.append(mapped)
    return out


def _members_from_rows(rows: Iterable[Iterable[str | None]]) -> list[str]:
    members: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for slug in row:
            if not slug or slug in seen:
                continue
            seen.add(slug)
            members.append(slug)
    return members


def build_family_payload(
    pokedex_payload: Mapping[str, Any],
    chains: Iterable[Mapping[str, Any]],
    *,
    generated_at: str | None = None,
    overrides: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    by_number = _preferred_pokemon_by_number(pokedex_payload)
    valid_slugs = {str(row["slug"]) for row in by_number.values()}
    families: list[dict[str, Any]] = []
    covered: set[str] = set()

    for chain in chains:
        raw_paths = chain.get("paths", [])
        paths = [list(path) for path in raw_paths if isinstance(path, list) and path]
        if not paths:
            raw_chain = chain.get("chain")
            if isinstance(raw_chain, Mapping):
                paths = paths_from_chain_node(raw_chain)
        rows = _slug_rows_from_number_rows(layout_rows_from_paths(paths), by_number)
        members = _members_from_rows(rows)
        if not members:
            continue
        root = by_number.get(int(paths[0][0]))
        root_slug = members[0]
        label_source = root or by_number.get(int(str(root_slug).split("-", 1)[0]))
        label = _display_name_fr(label_source) if label_source else root_slug
        sort_key = min(
            _national_number(by_number[int(number)])
            for path in paths
            for number in path
            if int(number) in by_number
        )
        families.append(
            {
                "id": root_slug,
                "label_fr": f"Famille {label}",
                "root_slug": root_slug,
                "members": members,
                "layout_rows": rows,
                "sort_key": sort_key,
                "source_chain_id": chain.get("id"),
            }
        )
        covered.update(members)

    for number in sorted(by_number):
        row = by_number[number]
        slug = str(row["slug"])
        if slug in covered:
            continue
        families.append(
            {
                "id": slug,
                "label_fr": f"Famille {_display_name_fr(row)}",
                "root_slug": slug,
                "members": [slug],
                "layout_rows": [[slug]],
                "sort_key": number,
                "source_chain_id": None,
            }
        )

    _apply_family_overrides(families, overrides, valid_slugs)
    families.sort(key=lambda item: (int(item["sort_key"]), str(item["id"])))
    pokemon_count = sum(len(family["members"]) for family in families)
    return {
        "version": 1,
        "source": "pokeapi/evolution-chain + local pokedex slugs",
        "generated_at": generated_at or datetime.now(UTC).replace(microsecond=0).isoformat(),
        "family_count": len(families),
        "pokemon_count": pokemon_count,
        "families": families,
    }


def _apply_family_overrides(
    families: list[dict[str, Any]],
    overrides: Mapping[str, Any] | None,
    valid_slugs: set[str],
) -> None:
    if not overrides:
        return
    raw_families = overrides.get("families")
    if not isinstance(raw_families, Mapping):
        return
    by_id = {str(family["id"]): family for family in families}
    moved_members = set()
    overridden_ids = set()

    for family_id, override in raw_families.items():
        family = by_id.get(str(family_id))
        if not family or not isinstance(override, Mapping):
            continue
        overridden_ids.add(family["id"])
        label = str(override.get("label_fr") or "").strip()
        if label:
            family["label_fr"] = label
        rows = override.get("layout_rows")
        if isinstance(rows, list):
            family["layout_rows"] = _validated_override_rows(rows, valid_slugs)
            family["members"] = _members_from_rows(family["layout_rows"])
            for m in family["members"]:
                if m != family["id"]:
                    moved_members.add(m)

    if moved_members:
        for family in families:
            if family["id"] in overridden_ids:
                continue
            family["members"] = [m for m in family["members"] if m not in moved_members]
            family["layout_rows"] = [
                [m for m in row if m is None or m not in moved_members]
                for row in family["layout_rows"]
            ]
            # Clean up rows that only contain None after removal
            family["layout_rows"] = [row for row in family["layout_rows"] if any(m is not None for m in row)]

        families[:] = [f for f in families if f["members"]]


def _validated_override_rows(rows: list[Any], valid_slugs: set[str]) -> list[list[str | None]]:
    out: list[list[str | None]] = []
    for row in rows:
        if not isinstance(row, list):
            continue
        mapped: list[str | None] = []
        for value in row:
            if value is None or value == "":
                mapped.append(None)
                continue
            slug = str(value)
            if slug not in valid_slugs:
                msg = f"Unknown evolution family override slug: {slug}"
                raise ValueError(msg)
            mapped.append(slug)
        if any(mapped):
            out.append(mapped)
    return out


def fetch_pokeapi_evolution_chains(session: requests.Session | None = None) -> list[dict[str, Any]]:
    client = session or requests.Session()
    listing = client.get(f"{POKEAPI_ROOT}/evolution-chain?limit=10000", timeout=30)
    listing.raise_for_status()
    payload = listing.json()
    chains: list[dict[str, Any]] = []
    for item in payload.get("results", []):
        if not isinstance(item, Mapping) or not item.get("url"):
            continue
        url = str(item["url"])
        response = client.get(url, timeout=30)
        response.raise_for_status()
        chain_payload = response.json()
        chains.append(
            {
                "id": chain_payload.get("id") or species_id_from_url(url),
                "paths": paths_from_chain_node(chain_payload.get("chain", {})),
            }
        )
    return chains


def generate_family_payload_from_files(
    pokedex_path: Path,
    *,
    overrides_path: Path | None = None,
    session: requests.Session | None = None,
) -> dict[str, Any]:
    pokedex_payload = json.loads(pokedex_path.read_text(encoding="utf-8"))
    overrides = None
    if overrides_path and overrides_path.exists():
        overrides = json.loads(overrides_path.read_text(encoding="utf-8"))
    chains = fetch_pokeapi_evolution_chains(session)
    return build_family_payload(pokedex_payload, chains, overrides=overrides)
