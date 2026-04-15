"""
Tranches du Pokédex national par région d'origine (ordre officiel),
plus déduction de la région « affichage » (formes régionales : ex. Rattata d'Alola → Alola).

Référence (tranches inclusives, n° national) :
Kanto 1–151, Johto 152–251, Hoenn 252–386, Sinnoh 387–493, Unys 494–649,
Kalos 650–721, Alola 722–807, 808–809 (Meltan / Melmetal), Galar 810–898,
Hisui 899–905, Paldea 906–1025.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class RegionDef:
    id: str
    label_fr: str
    low: int
    high: int


NATIONAL_REGIONS: tuple[RegionDef, ...] = (
    RegionDef("kanto", "Kanto", 1, 151),
    RegionDef("johto", "Johto", 152, 251),
    RegionDef("hoenn", "Hoenn", 252, 386),
    RegionDef("sinnoh", "Sinnoh", 387, 493),
    RegionDef("unys", "Unys", 494, 649),
    RegionDef("kalos", "Kalos", 650, 721),
    RegionDef("alola", "Alola", 722, 807),
    RegionDef("meltan", "Meltan / Melmetal", 808, 809),
    RegionDef("galar", "Galar", 810, 898),
    RegionDef("hisui", "Hisui", 899, 905),
    RegionDef("paldea", "Paldea", 906, 1025),
)

_UNKNOWN = RegionDef("unknown", "Inconnu", -1, -1)


def national_int(number: str) -> int:
    s = str(number).replace("#", "").strip()
    if not s:
        return 0
    return int(s.lstrip("0") or "0")


def region_from_national(n: int) -> RegionDef:
    for r in NATIONAL_REGIONS:
        if r.low <= n <= r.high:
            return r
    if n < 1:
        return _UNKNOWN
    return _UNKNOWN


def _norm(s: str) -> str:
    return (
        s.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("`", "'")
        .lower()
    )


# (sous-chaîne normalisée, id région) — ordre : du plus spécifique au plus large
_FORM_REGION_HINTS: tuple[tuple[str, str], ...] = (
    ("d'alola", "alola"),
    ("de paldea", "paldea"),
    ("de hisui", "hisui"),
    ("de galar", "galar"),
    ("de kalos", "kalos"),
    ("d'unys", "unys"),
    ("de hoenn", "hoenn"),
    ("de sinnoh", "sinnoh"),
    ("de johto", "johto"),
    ("de kanto", "kanto"),
)


def form_override_region_id(name_fr: str | None, form: str | None) -> str | None:
    """Si le nom / la forme indique une région (ex. « d'Alola »), retourne l'id région."""
    blob = _norm(" ".join(x for x in (name_fr or "", form or "") if x))
    for needle, rid in _FORM_REGION_HINTS:
        if needle in blob:
            return rid
    return None


def _def_by_id(rid: str) -> RegionDef | None:
    for r in NATIONAL_REGIONS:
        if r.id == rid:
            return r
    return None


def attach_region_fields(number: str, names: dict[str, Any], form: str | None) -> dict[str, Any]:
    """
    Champs pour le JSON / le modèle Pokémon :
    - region : région « collection » (forme régionale prioritaire sur le n°)
    - region_dex : région déduite du seul n° national
    - region_label_fr : libellé de `region`
    - region_native : True si le n° national tombe dans la tranche de `region`
      (sinon la forme est considérée comme importée : fin de section classeur région).
    """
    n = national_int(number)
    dex_r = region_from_national(n)
    override = form_override_region_id(
        names.get("fr") if isinstance(names.get("fr"), str) else None,
        form,
    )
    display_id = override if override else dex_r.id
    display_def = _def_by_id(display_id)
    if display_def is None:
        display_id = dex_r.id
        display_def = dex_r
    region_native = bool(display_def.low <= n <= display_def.high)
    return {
        "region": display_id,
        "region_dex": dex_r.id,
        "region_label_fr": display_def.label_fr,
        "region_native": region_native,
    }


def regions_meta_json() -> list[dict[str, Any]]:
    return [
        {"id": r.id, "label_fr": r.label_fr, "low": r.low, "high": r.high}
        for r in NATIONAL_REGIONS
    ]


def pokemon_effective_region_id(p: object) -> str:
    """Id région d’affichage (champ `region` ou recalcul via `attach_region_fields`)."""
    reg = getattr(p, "region", None) or ""
    if isinstance(reg, str) and reg.strip():
        return reg
    names = getattr(p, "names", None)
    nd: dict[str, Any] = (
        names.model_dump()
        if names is not None and hasattr(names, "model_dump")
        else {}
    )
    if not isinstance(nd, dict):
        nd = {}
    return attach_region_fields(
        str(getattr(p, "number", "") or ""),
        nd,
        getattr(p, "form", None),
    )["region"]


def filter_pokemon_by_region(pokemon: Sequence[T], region_id: str | None) -> list[T]:
    """
    Filtre une séquence de Pokémon par id de région d’affichage.
    ``None``, ``""``, ``"all"`` ou ``"none"`` → pas de filtre.
    """
    if not region_id or str(region_id).lower() in ("all", "none", ""):
        return list(pokemon)
    rid = str(region_id).lower()
    return [p for p in pokemon if pokemon_effective_region_id(p) == rid]
