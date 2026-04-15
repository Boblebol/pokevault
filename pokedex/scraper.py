"""
pokedex/scraper.py — Logique de scraping Pokepedia
"""

from __future__ import annotations

import re
import time
import unicodedata
from pathlib import Path
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

from .form_labels import resolve_stored_form_label
from .models import Pokedex, Pokemon, PokemonNames
from .regions import attach_region_fields

BASE_URL = "https://www.pokepedia.fr"
PAGE_URL = (
    "https://www.pokepedia.fr/"
    "Liste_des_Pok%C3%A9mon_dans_l%27ordre_du_Pok%C3%A9dex_National"
)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}
REQUEST_DELAY = 0.3
TIMEOUT = 15

ARCEUS_NATIONAL_NUMBER = "0493"
ARCEUS_TYPE_FORMS_FR = (
    "Acier",
    "Combat",
    "Dragon",
    "Eau",
    "Électrik",
    "Fée",
    "Feu",
    "Glace",
    "Insecte",
    "Normal",
    "Plante",
    "Poison",
    "Psy",
    "Roche",
    "Sol",
    "Spectre",
    "Ténèbres",
    "Vol",
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def get_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def fetch_page(session: requests.Session, url: str) -> BeautifulSoup:
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    return BeautifulSoup(resp.text, "lxml")


def resolve_wiki_image_url(thumb_url: str) -> str:
    """Convertit un thumb MediaWiki vers l'URL originale."""
    match = re.match(r"(/images/thumb/[a-f0-9]/[a-f0-9]+/(.+?))/\d+px-.+", thumb_url)
    if match:
        return BASE_URL + match.group(1)
    return BASE_URL + thumb_url if thumb_url.startswith("/") else thumb_url


def download_image(
    session: requests.Session, img_url: str, dest: Path, retries: int = 3
) -> bool:
    if dest.exists():
        return True
    for attempt in range(retries):
        try:
            resp = session.get(img_url, timeout=TIMEOUT, stream=True)
            resp.raise_for_status()
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
            return True
        except requests.RequestException as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                tqdm.write(f"  ⚠ {dest.name}: {e}")
    return False


# ── Parsing ────────────────────────────────────────────────────────────────────

def parse_number(text: str) -> str | None:
    m = re.search(r"(\d{3,4})", text.replace("\xa0", "").strip())
    return m.group(1).zfill(4) if m else None


_TYPE_HREF_RE = re.compile(r"_\(type\)", re.I)


def parse_types(cell) -> list[str]:
    """Extrait Plante / Poison… depuis liens `_(type)`, titres ou `img[alt]`."""
    types: list[str] = []
    for a in cell.find_all("a", href=True):
        href = unquote(a.get("href", "") or "")
        title = (a.get("title") or "").strip()
        if _TYPE_HREF_RE.search(href):
            if title:
                types.append(title.split("(")[0].strip() or title)
            else:
                m = re.search(r"/([^/]+?)_\(type\)", href)
                if m:
                    types.append(m.group(1).replace("_", " "))
            continue
        txt = a.get_text(strip=True)
        if txt:
            types.append(txt)
    if not types:
        for img in cell.find_all("img", alt=True):
            alt = (img.get("alt") or "").strip()
            if alt and not re.fullmatch(r"\d{3,4}", alt):
                types.append(alt)
    if not types:
        types = [t for t in cell.get_text(" ", strip=True).split() if len(t) > 2]
    seen: set[str] = set()
    out: list[str] = []
    for t in types:
        k = t.lower()
        if k not in seen:
            seen.add(k)
            out.append(t)
    return out[:2]


def detect_columns(header_row) -> dict:
    """
    Mappe les rôles → index de colonne **dans les lignes de données**.
    Tient compte des `colspan` (ex. « Nom japonais » colspan=2 sur Pokepedia).
    """
    cols: dict[str, int] = {}
    col_index = 0
    for th in header_row.find_all(["th", "td"]):
        text = th.get_text(" ", strip=True).lower()
        try:
            colspan = max(1, int(th.get("colspan", 1) or 1))
        except (TypeError, ValueError):
            colspan = 1
        if re.search(r"n°|num[eé]ro|^#$|^\s*#\s*$", text) or text.strip() in ("#", "n°"):
            cols.setdefault("number", col_index)
        elif re.search(r"image|sprite|mini", text):
            cols.setdefault("image", col_index)
        elif re.search(r"nom.*(fr|franc)", text) or text in ("nom", "nom français"):
            cols.setdefault("name_fr", col_index)
        elif re.search(r"nom.*(en|angl)", text) or "english" in text:
            cols.setdefault("name_en", col_index)
        elif re.search(r"nom.*(all?emand|allemand)", text):
            cols.setdefault("name_de", col_index)
        elif re.search(r"nom.*(jp|jap|japon)", text) or "japanese" in text:
            cols.setdefault("name_ja", col_index)
        elif re.search(r"type", text):
            cols.setdefault("types", col_index)
        col_index += colspan
    return cols


def _number_from_sprite_cell(cell) -> str | None:
    """Numéro national depuis une cellule image (titre du lien ou alt du sprite)."""
    if not cell:
        return None
    for a in cell.find_all("a", title=True):
        m = re.search(r"(?:n°|n[o°\u00b0]\s*)(\d{3,4})", a.get("title", ""), re.I)
        if m:
            return m.group(1).zfill(4)
    for img in cell.find_all("img", alt=True):
        alt = img.get("alt", "")
        m = re.search(r"(\d{3,4})", alt)
        if m:
            return m.group(1).zfill(4)
    return parse_number(cell.get_text("", strip=True))


def _cell_name_text(cell) -> str:
    """Texte cellule nom : `get_text(' ')` évite la fusion Florizarre + Gigamax."""
    if not cell:
        return ""
    return cell.get_text(" ", strip=True)


def _parse_row_variant_form(cells: list, session: requests.Session) -> dict | None:
    """
    Ligne « forme alternative » (Méga, etc.) : 7 cellules, sans colonne # (rowspan).
    Image | FR | EN | DE | JA (ruby) | romaji | types
    """
    number = _number_from_sprite_cell(cells[0])
    if not number:
        return None
    names: dict[str, str] = {}
    if len(cells) > 1:
        names["fr"] = _cell_name_text(cells[1])
    if len(cells) > 2:
        names["en"] = _cell_name_text(cells[2])
    if len(cells) > 4:
        names["ja"] = _cell_name_text(cells[4])
    types = parse_types(cells[6]) if len(cells) > 6 else []

    img_url = None
    img = cells[0].find("img") if cells else None
    if img:
        src = img.get("src", "")
        img_url = resolve_wiki_image_url(src)

    slug_base = slugify(names.get("en") or names.get("fr") or f"pokemon-{number}")
    slug = f"{number}-{slug_base}"
    form = resolve_stored_form_label(
        names.get("fr"),
        names.get("en"),
        number,
        slug,
    )

    return {
        "number": number,
        "slug": slug,
        "names": names,
        "types": types,
        "form": form,
        "_img_url": img_url,
    }


def parse_row(cells, col_map: dict, session: requests.Session) -> dict | None:
    types_col = col_map.get("types")
    if len(cells) == 7 and types_col is not None and types_col >= len(cells):
        return _parse_row_variant_form(cells, session)

    def cell(role):
        idx = col_map.get(role)
        return cells[idx] if idx is not None and idx < len(cells) else None

    # Numéro
    num_cell = cell("number")
    number = parse_number(num_cell.get_text()) if num_cell else None
    if not number:
        for c in cells[:3]:
            number = parse_number(c.get_text())
            if number:
                break
    if not number:
        return None

    # Noms
    names = {}
    fr_cell = cell("name_fr")
    if fr_cell:
        names["fr"] = _cell_name_text(fr_cell)
    elif len(cells) > 2:
        val = _cell_name_text(cells[2])
        if val and not val.startswith("#"):
            names["fr"] = val

    en_cell = cell("name_en")
    if en_cell:
        names["en"] = _cell_name_text(en_cell)

    ja_cell = cell("name_ja")
    if ja_cell:
        names["ja"] = _cell_name_text(ja_cell)

    # Types
    types_cell = cell("types")
    types = parse_types(types_cell) if types_cell else []

    # Image URL
    img_url = None
    img_cell = cell("image")
    if img_cell:
        img = img_cell.find("img")
        if img:
            src = img.get("src", "")
            img_url = resolve_wiki_image_url(src)

    # Slug
    slug_base = slugify(names.get("en") or names.get("fr") or f"pokemon-{number}")
    slug = f"{number}-{slug_base}"

    # Forme (détection + règles primale / partenaire / Pikachu spéciaux)
    form = resolve_stored_form_label(
        names.get("fr"),
        names.get("en"),
        number,
        slug,
    )

    return {
        "number": number, "slug": slug,
        "names": names, "types": types, "form": form,
        "_img_url": img_url,
    }


def expand_arceus_type_forms(
    raw_list: list[dict],
    seen_slugs: set[str],
    limit: int | None = None,
) -> list[dict]:
    """
    Arceus doit exister en une entrée par type : chaque type = une forme.
    Les entrées existantes (déjà formées) sont conservées ; on complète seulement
    les types manquants.
    """
    base_arceus = next(
        (
            e for e in raw_list
            if e.get("number") == ARCEUS_NATIONAL_NUMBER and e.get("form") is None
        ),
        None,
    )
    if not base_arceus:
        return raw_list

    existing_type_forms = {
        tuple(e.get("types") or [])
        for e in raw_list
        if e.get("number") == ARCEUS_NATIONAL_NUMBER and e.get("types")
    }

    for t in ARCEUS_TYPE_FORMS_FR:
        if limit is not None and len(raw_list) >= limit:
            break
        type_sig = (t,)
        if type_sig in existing_type_forms:
            continue
        slug = f"{ARCEUS_NATIONAL_NUMBER}-arceus-{slugify(t)}"
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        existing_type_forms.add(type_sig)
        raw_list.append(
            {
                "number": ARCEUS_NATIONAL_NUMBER,
                "slug": slug,
                "names": dict(base_arceus.get("names") or {}),
                "types": [t],
                "form": f"Type {t}",
                "_img_url": base_arceus.get("_img_url"),
            }
        )
    return raw_list


# ── Scrape principal ───────────────────────────────────────────────────────────

def scrape(
    limit: int | None = None,
    download_images: bool = True,
    images_dir: Path = Path("data/images"),
    debug: bool = False,
) -> Pokedex:
    session = get_session()
    images_dir.mkdir(parents=True, exist_ok=True)

    print("📡 Récupération de la page Pokepedia…")
    soup = fetch_page(session, PAGE_URL)

    tables = (
        soup.find_all("table", class_=re.compile(r"wikitable|sortable"))
        or soup.find_all("table")
    )
    print(f"   {len(tables)} tableau(x) trouvé(s)")

    if debug:
        rows = tables[0].find_all("tr")[:3] if tables else []
        for r in rows:
            print(r.prettify()[:600])
            print("---")

    raw_list: list[dict] = []
    seen: set[str] = set()

    for _t_idx, table in enumerate(tables):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        col_map = detect_columns(rows[0])
        if "number" not in col_map and len(col_map) < 2:
            col_map = detect_columns(rows[1]) if len(rows) > 1 else {}
        if "number" not in col_map and len(col_map) < 2:
            continue

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue
            entry = parse_row(cells, col_map, session)
            if not entry:
                continue
            # Déduplication slug
            slug = entry["slug"]
            if slug in seen:
                i = 2
                while f"{slug}-{i}" in seen:
                    i += 1
                entry["slug"] = f"{slug}-{i}"
            seen.add(entry["slug"])
            raw_list.append(entry)
            if limit and len(raw_list) >= limit:
                break
        if limit and len(raw_list) >= limit:
            break

    print(f"✅ {len(raw_list)} Pokémon parsés")

    raw_list = expand_arceus_type_forms(raw_list, seen, limit=limit)

    # Téléchargement images
    if download_images:
        print("\n🖼  Téléchargement des images…")
        for entry in tqdm(raw_list, unit="img"):
            img_url = entry.pop("_img_url", None)
            if not img_url:
                entry["image"] = None
                continue
            ext = Path(unquote(img_url.split("?")[0])).suffix or ".png"
            dest = images_dir / f"{entry['slug']}{ext}"
            entry["image"] = str(dest) if download_image(session, img_url, dest) else None
            time.sleep(REQUEST_DELAY)
    else:
        for entry in raw_list:
            entry.pop("_img_url", None)
            entry["image"] = None

    pokemon_list = []
    for e in raw_list:
        reg = attach_region_fields(e["number"], e["names"], e.get("form"))
        pokemon_list.append(
            Pokemon(
                number=e["number"],
                slug=e["slug"],
                names=PokemonNames(**e["names"]),
                types=e["types"],
                form=e.get("form"),
                image=e.get("image"),
                **reg,
            ),
        )
    return Pokedex(pokemon=pokemon_list)
