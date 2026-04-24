#!/usr/bin/env python3
"""
main.py — CLI Pokédex Scraper
Usage : python main.py [COMMAND] [OPTIONS]
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path

import typer
from rich.console import Console

app = typer.Typer(
    name="pokevault",
    help="🎮 Pokédex Scraper — Pokepedia → JSON / CSV / YAML / XML",
    add_completion=False,
    rich_markup_mode="rich",
)
console = Console()

DEFAULT_DATA = Path("data/pokedex.json")
DEFAULT_IMAGES = Path("data/images")


class OutputFormat(str, Enum):  # noqa: UP042
    json = "json"
    csv = "csv"
    yaml = "yaml"
    xml = "xml"


# ── fetch ──────────────────────────────────────────────────────────────────────

@app.command()
def fetch(
    output_format: OutputFormat = typer.Option(
        OutputFormat.json, "--format", "-f",
        help="Format de sortie : json | csv | yaml | xml",
    ),
    output: Path | None = typer.Option(
        None, "--output", "-o",
        help="Fichier de sortie (défaut : data/pokedex.[ext])",
    ),
    limit: int | None = typer.Option(
        None, "--limit", "-l",
        help="Limiter au N premiers Pokémon (0 = pas de limite)",
    ),
    no_images: bool = typer.Option(
        False, "--no-images",
        help="Ne pas télécharger les images",
    ),
    images_dir: Path = typer.Option(
        DEFAULT_IMAGES, "--images-dir",
        help="Dossier de destination des images",
    ),
    debug: bool = typer.Option(
        False, "--debug",
        help="Afficher le HTML brut des premières lignes",
    ),
) -> None:
    """
    🌐 Scrape le Pokédex depuis Pokepedia et exporte les données.

    Exemples :
      python main.py fetch
      python main.py fetch --format yaml --limit 50
      python main.py fetch --no-images --output mon-pokédex.json
    """
    from pokedex.exporters import EXTENSIONS, export
    from pokedex.scraper import scrape

    actual_limit = None if (limit is None or limit == 0) else limit

    try:
        pokedex = scrape(
            limit=actual_limit,
            download_images=not no_images,
            images_dir=images_dir,
            debug=debug,
        )
    except Exception as e:
        console.print(f"[red]❌ Erreur lors du scraping : {e}[/red]")
        raise typer.Exit(1)  # noqa: B904

    if output is None:
        ext = EXTENSIONS[output_format.value]
        output = Path("data") / f"pokedex{ext}"

    export(pokedex, output, output_format.value)
    console.print(f"\n[green]💾 {pokedex.total} Pokémon → {output}[/green]")
    if not no_images:
        console.print(f"[green]🖼  Images → {images_dir}/[/green]")


# ── fetch-shiny ────────────────────────────────────────────────────────────────

@app.command("fetch-shiny")
def fetch_shiny(
    input_path: Path = typer.Option(
        DEFAULT_DATA, "--input", "-i",
        help="Fichier Pokédex JSON de référence (défaut : data/pokedex.json)",
    ),
    output_dir: Path = typer.Option(
        Path("data/images_shiny"), "--output-dir", "-o",
        help="Dossier de destination des shiny",
    ),
    limit: int | None = typer.Option(
        None, "--limit", "-l",
        help="Limiter au N premiers slugs (0 = pas de limite)",
    ),
    force: bool = typer.Option(
        False, "--force",
        help="Retélécharger même si le fichier existe déjà",
    ),
) -> None:
    """
    ✨ Télécharge les artworks shiny depuis le CDN PokéAPI (roadmap F11).

    Les images sont sauvegardées sous ``data/images_shiny/<slug>.png`` et
    consommées directement par l'artwork switcher en mode « Shiny ». Sans
    ce download, le switcher retombe sur le CDN distant
    (``raw.githubusercontent.com/PokeAPI/sprites``).

    Exemples :
      python main.py fetch-shiny
      python main.py fetch-shiny --limit 151          # Kanto uniquement
      python main.py fetch-shiny --force              # overwrite local
    """
    import re as _re

    import requests as _requests

    from pokedex.exporters import load_pokedex
    from pokedex.scraper import download_image

    if not input_path.exists():
        console.print(
            f"[red]Fichier introuvable : {input_path}[/red]\n"
            "[dim]Lance d'abord : make fetch[/dim]"
        )
        raise typer.Exit(1)  # noqa: B904

    pokedex = load_pokedex(input_path)
    pokemon = list(pokedex.pokemon)
    if limit and limit > 0:
        pokemon = pokemon[:limit]

    output_dir.mkdir(parents=True, exist_ok=True)
    base = (
        "https://raw.githubusercontent.com/PokeAPI/sprites/master/"
        "sprites/pokemon/other/official-artwork/shiny"
    )

    session = _requests.Session()
    session.headers.update({"User-Agent": "pokevault/fetch-shiny"})

    ok = 0
    skip = 0
    fail: list[str] = []
    for p in pokemon:
        slug = p.slug
        m = _re.match(r"^(\d{1,4})", slug)
        if not m:
            continue
        nat_id = int(m.group(1))
        dest = output_dir / f"{slug}.png"
        if dest.exists() and not force:
            skip += 1
            continue
        if force and dest.exists():
            dest.unlink()
        url = f"{base}/{nat_id}.png"
        if download_image(session, url, dest):
            ok += 1
        else:
            fail.append(slug)

    console.print(
        f"\n[green]✨ Shiny : {ok} téléchargés · {skip} déjà présents · "
        f"{len(fail)} échecs[/green]"
    )
    if fail:
        console.print(f"[yellow]Slugs en échec : {', '.join(fail[:10])}…[/yellow]")


# ── view ───────────────────────────────────────────────────────────────────────

@app.command()
def view(
    input_path: Path = typer.Option(
        DEFAULT_DATA, "--input", "-i",
        help="Fichier JSON source (généré par fetch)",
    ),
    number: str | None = typer.Option(
        None, "--number", "-n",
        help="Afficher un Pokémon par son numéro (ex: 006)",
    ),
    type_filter: str | None = typer.Option(
        None, "--type", "-t",
        help="Filtrer par type (ex: Feu)",
    ),
    search: str | None = typer.Option(
        None, "--search", "-s",
        help="Rechercher par nom (toutes langues)",
    ),
    region: str | None = typer.Option(
        None,
        "--region",
        "-r",
        help=(
            "Filtrer par région d'affichage (id : kanto, alola, galar…). "
            "Cumulable avec --type / --search."
        ),
    ),
    limit: int = typer.Option(
        0, "--limit", "-l",
        help="Limiter l'affichage à N lignes (0 = tout)",
    ),
) -> None:
    """
    👁  Affiche les données du Pokédex depuis le fichier JSON.

    Exemples :
      python main.py view
      python main.py view --number 025
      python main.py view --type Feu
      python main.py view --search pikachu
      python main.py view --region alola
    """
    from pokedex.exporters import load_pokedex
    from pokedex.regions import filter_pokemon_by_region
    from pokedex.viewer import view_detail, view_list

    if not input_path.exists():
        console.print(
            f"[red]Fichier introuvable : {input_path}[/red]\n"
            "[dim]Lance d'abord : python main.py fetch[/dim]"
        )
        raise typer.Exit(1)  # noqa: B904

    pokedex = load_pokedex(input_path)

    if number:
        results = pokedex.by_number(number)
        if not results:
            console.print(f"[red]Aucun Pokémon avec le numéro {number}.[/red]")
            raise typer.Exit(1)  # noqa: B904
        for p in results:
            view_detail(p)
        return

    # Filtrage
    if type_filter:
        pokemon = pokedex.by_type(type_filter)
        title = f"Pokémon de type [bold]{type_filter}[/bold] ({len(pokemon)})"
    elif search:
        pokemon = pokedex.search(search)
        title = f"Résultats pour « {search} » ({len(pokemon)})"
    else:
        pokemon = pokedex.pokemon
        title = f"Pokédex national ({pokedex.total})"

    if region:
        pokemon = filter_pokemon_by_region(pokemon, region)
        title = f"{title} · région [bold]{region}[/bold] ({len(pokemon)})"

    if limit > 0:
        pokemon = pokemon[:limit]

    if not pokemon:
        console.print("[yellow]Aucun résultat.[/yellow]")
        return

    view_list(pokemon, title=title)


# ── edit ───────────────────────────────────────────────────────────────────────

@app.command()
def edit(
    slug: str | None = typer.Argument(
        None,
        help="Slug du Pokémon à éditer (ex: 0025-pikachu)",
    ),
    number: str | None = typer.Option(
        None, "--number", "-n",
        help="Sélectionner par numéro à la place du slug",
    ),
    field: str | None = typer.Option(
        None, "--field",
        help="Champ à modifier (ex: names.fr, types, form)",
    ),
    value: str | None = typer.Option(
        None, "--value",
        help="Nouvelle valeur (nécessite --field)",
    ),
    input_path: Path = typer.Option(
        DEFAULT_DATA, "--input", "-i",
        help="Fichier JSON source",
    ),
) -> None:
    """
    ✏️  Édite un Pokémon dans le fichier JSON.

    Mode interactif (prompts) :
      python main.py edit 0001-bulbasaur
      python main.py edit --number 001

    Mode direct :
      python main.py edit 0025-pikachu --field names.fr --value "Pikachu modifié"
      python main.py edit 0006-charizard --field types --value "Feu/Vol"
    """
    from pokedex.exporters import load_pokedex
    from pokedex.viewer import edit_direct, edit_interactive, view_list

    if not input_path.exists():
        console.print(
            f"[red]Fichier introuvable : {input_path}[/red]\n"
            "[dim]Lance d'abord : python main.py fetch[/dim]"
        )
        raise typer.Exit(1)  # noqa: B904

    pokedex = load_pokedex(input_path)

    # Résolution du slug via --number
    if not slug and number:
        results = pokedex.by_number(number)
        if not results:
            console.print(f"[red]Aucun Pokémon avec le numéro {number}.[/red]")
            raise typer.Exit(1)  # noqa: B904
        if len(results) > 1:
            console.print(f"[yellow]{len(results)} formes trouvées pour #{number} :[/yellow]")
            view_list(results, title="Choisir une forme")
            slug = typer.prompt("Slug exact")
        else:
            slug = results[0].slug

    if not slug:
        console.print("[red]Précise un slug (argument) ou --number.[/red]")
        raise typer.Exit(1)  # noqa: B904

    if field and value is not None:
        edit_direct(pokedex, slug, field, value, input_path)
    else:
        edit_interactive(pokedex, slug, input_path)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app()
