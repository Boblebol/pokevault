"""
pokedex/exporters.py — Export du Pokédex en JSON, CSV, YAML, XML
"""

from __future__ import annotations

import csv
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml

from .models import Pokedex
from .regions import regions_meta_json


def _pokedex_to_dicts(pokedex: Pokedex) -> list[dict]:
    return [
        {
            "number": p.number,
            "slug": p.slug,
            "name_fr": p.names.fr or "",
            "name_en": p.names.en or "",
            "name_ja": p.names.ja or "",
            "types": p.types_str("/"),
            "form": p.form or "",
            "image": p.image or "",
        }
        for p in pokedex.pokemon
    ]


def export_json(pokedex: Pokedex, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "meta": {
            "total": pokedex.total,
            "generated_at": pokedex.generated_at.isoformat(),
            "source_url": pokedex.source_url,
            "regions": regions_meta_json(),
        },
        "pokemon": [p.model_dump() for p in pokedex.pokemon],
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def export_csv(pokedex: Pokedex, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = _pokedex_to_dicts(pokedex)
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def export_yaml(pokedex: Pokedex, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "meta": {
            "total": pokedex.total,
            "generated_at": pokedex.generated_at.isoformat(),
            "source_url": pokedex.source_url,
            "regions": regions_meta_json(),
        },
        "pokemon": [p.model_dump() for p in pokedex.pokemon],
    }
    path.write_text(
        yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False),
        encoding="utf-8",
    )


def export_xml(pokedex: Pokedex, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    root = ET.Element("pokedex")
    meta = ET.SubElement(root, "meta")
    ET.SubElement(meta, "total").text = str(pokedex.total)
    ET.SubElement(meta, "generated_at").text = pokedex.generated_at.isoformat()
    ET.SubElement(meta, "source_url").text = pokedex.source_url

    pokemon_list = ET.SubElement(root, "pokemon_list")
    for p in pokedex.pokemon:
        poke = ET.SubElement(pokemon_list, "pokemon")
        ET.SubElement(poke, "number").text = p.number
        ET.SubElement(poke, "slug").text = p.slug
        names_el = ET.SubElement(poke, "names")
        for lang, val in p.names.all_names().items():
            ET.SubElement(names_el, lang).text = val
        types_el = ET.SubElement(poke, "types")
        for t in p.types:
            ET.SubElement(types_el, "type").text = t
        if p.form:
            ET.SubElement(poke, "form").text = p.form
        if p.image:
            ET.SubElement(poke, "image").text = p.image

    ET.indent(root, space="  ")
    path.write_bytes(ET.tostring(root, encoding="utf-8", xml_declaration=True))


# ── Dispatcher ─────────────────────────────────────────────────────────────────

EXPORTERS = {
    "json": export_json,
    "csv": export_csv,
    "yaml": export_yaml,
    "xml": export_xml,
}

EXTENSIONS = {
    "json": ".json",
    "csv": ".csv",
    "yaml": ".yaml",
    "xml": ".xml",
}


def export(pokedex: Pokedex, path: Path, fmt: str) -> None:
    """Exporte le Pokédex dans le format demandé."""
    if fmt not in EXPORTERS:
        raise ValueError(f"Format inconnu : {fmt}. Choix : {list(EXPORTERS)}")
    EXPORTERS[fmt](pokedex, path)


def load_pokedex(path: Path) -> Pokedex:
    """Charge un fichier JSON exporté et retourne un objet Pokedex."""
    data = json.loads(path.read_text(encoding="utf-8"))
    # Support ancien format (liste directe) et nouveau format (avec meta)
    pokemon_data = data if isinstance(data, list) else data.get("pokemon", [])

    from .models import Pokemon, PokemonNames

    pokemon_list = []
    for item in pokemon_data:
        names_raw = item.get("names", {})
        kw: dict = {
            "number": item["number"],
            "slug": item["slug"],
            "names": PokemonNames(**names_raw) if isinstance(names_raw, dict) else PokemonNames(),
            "types": item.get("types", []),
            "form": item.get("form"),
            "image": item.get("image"),
        }
        for k in ("region", "region_dex", "region_label_fr", "region_native"):
            if k in item:
                kw[k] = item[k]
        pokemon_list.append(Pokemon(**kw))
    return Pokedex(pokemon=pokemon_list)
