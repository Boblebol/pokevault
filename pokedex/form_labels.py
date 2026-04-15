"""
Libellés de formes : détection depuis le nom FR (scrape),
puis raffinage (Primo / partenaire / Pikachu spéciaux / lettres Zarbi) pour persistance et affichage.
"""

from __future__ import annotations

import re

from .regions import form_override_region_id

FORM_PATTERNS = [
    r"\b(Méga(?:[\s\-][A-Z])?)\b",
    r"(d['']Alola)",
    r"(de Galar)",
    r"(de Hisui)",
    r"(de Paldea)",
    r"(Forme\s+\w+)",
]

_REGIONAL_FORM_LABELS: frozenset[str] = frozenset(
    {
        "d'Alola",
        "de Galar",
        "de Hisui",
        "de Paldea",
        "de Kalos",
        "d'Unys",
        "de Hoenn",
        "de Sinnoh",
        "de Johto",
        "de Kanto",
    }
)

_MEGA_GIGA: frozenset[str] = frozenset({"Méga", "Méga X", "Méga Y", "Gigamax"})

_ZARBI_NUM = "0201"
_ZARBI_LETTRE_LABEL = "Zarbi lettre"


def _norm_blob(s: str | None) -> str:
    return (
        str(s or "")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("`", "'")
        .lower()
    )


def detect_form(name_fr: str) -> str | None:
    """Extrait une forme « générique » depuis le nom français (Méga, région, Forme …)."""
    if not name_fr or not name_fr.strip():
        return None
    n = name_fr.strip()
    if re.search(r"Méga\s+X\b", n, re.I) or re.search(r"Méga[-–].*X\b", n, re.I):
        return "Méga X"
    if re.search(r"Méga\s+Y\b", n, re.I) or re.search(r"Méga[-–].*Y\b", n, re.I):
        return "Méga Y"
    if re.match(r"Méga[-–]", n, re.I):
        return "Méga"
    if re.search(r"\bGigamax\b", n, re.I):
        return "Gigamax"
    for pat in FORM_PATTERNS:
        m = re.search(pat, name_fr, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def _padded_number(number: str) -> str:
    return str(number or "").replace("#", "").strip().zfill(4)


def _zarbi_is_letter_variant(name_fr: str | None, name_en: str | None, slug_n: str) -> bool:
    """
    N°201 : chaque graphisme (A–Z, !, ?, etc.) est une forme spéciale « Zarbi lettre ».
    Slug de base : ``0201-unown`` ou ``0201-zarbi`` (2 segments après le n°) ; suffixe → variante.
    """
    parts = slug_n.split("-")
    if len(parts) >= 2 and parts[0] == _ZARBI_NUM and parts[1] in ("unown", "zarbi"):
        if len(parts) > 2:
            return True

    fr_n = _norm_blob(name_fr)
    if fr_n.startswith("zarbi") and fr_n[5:].strip():
        return True
    en_n = _norm_blob(name_en)
    if en_n.startswith("unown") and en_n[5:].strip():
        return True
    return False


def refine_form_label(
    name_fr: str | None,
    name_en: str | None,
    number: str,
    slug: str,
    detected: str | None,
) -> str | None:
    """
    Applique les règles métier : formes primales, partenaires, Pikachu spéciaux, Zarbi lettre.
    `detected` est typiquement le retour de ``detect_form(name_fr)``.
    """
    fr = _norm_blob(name_fr)
    en = _norm_blob(name_en)
    slug_n = _norm_blob(slug)
    num = _padded_number(number)

    if num in ("0382", "0383") and (
        "primo" in fr
        or "primo" in slug_n
        or "primal" in en
        or "primal" in slug_n
    ):
        return "Forme primale"

    is_partner = "partenaire" in fr or "partner" in en or "partner" in slug_n
    if is_partner and (
        num == "0025"
        or "pikachu" in slug_n
        or num == "0133"
        or "evoli" in slug_n
        or "eevee" in slug_n
    ):
        return "Forme partenaire"

    if num == "0025" and "pikachu" in slug_n:
        if detected in _MEGA_GIGA:
            return detected
        if detected in _REGIONAL_FORM_LABELS:
            return detected
        if form_override_region_id(name_fr, detected):
            return detected
        plain = (name_fr or "").strip().casefold() == "pikachu".casefold()
        if detected is None:
            return None if plain else "Forme spéciale Pikachu"
        return "Forme spéciale Pikachu"

    if num == _ZARBI_NUM and _zarbi_is_letter_variant(name_fr, name_en, slug_n):
        return _ZARBI_LETTRE_LABEL

    return detected


def resolve_stored_form_label(
    name_fr: str | None,
    name_en: str | None,
    number: str,
    slug: str,
) -> str | None:
    """Chaîne `form` à enregistrer après scrape (détection + raffinage)."""
    return refine_form_label(name_fr, name_en, number, slug, detect_form(name_fr or ""))


def form_display_label(
    name_fr: str | None,
    name_en: str | None,
    number: str,
    slug: str,
) -> str | None:
    """Libellé de forme pour l’affichage (viewer, etc.), recalculé depuis noms + slug."""
    return resolve_stored_form_label(name_fr, name_en, number, slug)
