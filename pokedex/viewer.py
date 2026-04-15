"""
pokedex/viewer.py — Affichage et édition Rich en CLI
"""

from __future__ import annotations

from pathlib import Path

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.table import Table

from .exporters import export_json
from .form_labels import form_display_label
from .models import Pokedex, Pokemon
from .regions import pokemon_effective_region_id

console = Console()

# ── Couleurs par type ──────────────────────────────────────────────────────────
TYPE_COLORS: dict[str, str] = {
    "Feu": "bold red",
    "Eau": "bold blue",
    "Plante": "bold green",
    "Électrik": "bold yellow",
    "Glace": "bold cyan",
    "Combat": "bold dark_red",
    "Poison": "bold magenta",
    "Sol": "bold yellow3",
    "Vol": "bold sky_blue1",
    "Psy": "bold hot_pink",
    "Insecte": "bold yellow_green",
    "Roche": "bold khaki3",
    "Spectre": "bold purple",
    "Dragon": "bold blue_violet",
    "Ténèbres": "bold grey39",
    "Acier": "bold grey70",
    "Fée": "bold pink1",
    "Normal": "white",
}


def type_badge(t: str) -> str:
    color = TYPE_COLORS.get(t, "white")
    return f"[{color}]{t}[/{color}]"


def types_display(types: list[str]) -> str:
    return "  ".join(type_badge(t) for t in types)


def _parse_region_native_flag(value: str) -> bool | None:
    """Interprète oui/non (et variantes). None = entrée invalide."""
    v = (value or "").strip().lower()
    if not v:
        return True
    if v in ("oui", "o", "yes", "y", "true", "1", "vrai"):
        return True
    if v in ("non", "n", "no", "false", "0", "faux"):
        return False
    return None


def form_cell(p: Pokemon) -> str:
    """Libellé de forme (cohérent avec le scrape : primale, partenaire, Pikachu spéciaux…)."""
    return form_display_label(p.names.fr, p.names.en, p.number, p.slug) or "—"


def region_cell(p: Pokemon) -> str:
    """Libellé région pour le tableau ( * = forme importée)."""
    rid = (getattr(p, "region", None) or "").strip() or pokemon_effective_region_id(p)
    label = (getattr(p, "region_label_fr", None) or "").strip()
    base = label or rid
    if getattr(p, "region_native", True) is False:
        return f"{base} *"
    return base


# ── Affichage liste ────────────────────────────────────────────────────────────


def view_list(pokemon: list[Pokemon], title: str = "Pokédex") -> None:
    table = Table(
        title=title,
        box=box.ROUNDED,
        show_lines=False,
        header_style="bold cyan",
        expand=False,
    )
    table.add_column("N°", style="dim", width=6, justify="right")
    table.add_column("Nom FR", min_width=16)
    table.add_column("Nom EN", min_width=16, style="dim")
    table.add_column("Types", min_width=20)
    table.add_column("Forme", style="italic dim", min_width=12)
    table.add_column("Région", style="dim", min_width=18, no_wrap=False)
    table.add_column("Image", justify="center", width=7)

    for p in pokemon:
        table.add_row(
            f"#{p.number}",
            p.names.fr or "—",
            p.names.en or "—",
            types_display(p.types),
            form_cell(p),
            region_cell(p),
            "✓" if p.has_image() else "✗",
        )

    console.print(table)
    console.print(f"\n[dim]{len(pokemon)} entrée(s)[/dim]")


# ── Fiche détaillée ────────────────────────────────────────────────────────────


def view_detail(p: Pokemon) -> None:
    lines = []
    lines.append(f"[bold]N°[/bold]         #{p.number}")
    lines.append(f"[bold]Slug[/bold]       {p.slug}")
    lines.append("")

    lines.append("[bold]Noms[/bold]")
    if p.names.fr:
        lines.append(f"  FR  {p.names.fr}")
    if p.names.en:
        lines.append(f"  EN  {p.names.en}")
    if p.names.ja:
        lines.append(f"  JA  {p.names.ja}")
    lines.append("")

    lines.append(f"[bold]Types[/bold]      {types_display(p.types) or '—'}")

    form_label = form_display_label(p.names.fr, p.names.en, p.number, p.slug)
    if form_label:
        lines.append(f"[bold]Forme[/bold]      {form_label}")

    rid = (getattr(p, "region", None) or "").strip() or pokemon_effective_region_id(p)
    rlabel = (getattr(p, "region_label_fr", None) or "").strip() or rid
    rdex = (getattr(p, "region_dex", None) or "").strip() or "—"
    lines.append(f"[bold]Région[/bold]     {rlabel} [dim](id {rid}, dex {rdex})[/dim]")
    if getattr(p, "region_native", True) is False:
        lines.append("             [dim]Forme importée (n° hors tranche régionale)[/dim]")

    lines.append("")
    if p.image:
        status = "✓ présente" if p.has_image() else "✗ fichier manquant"
        lines.append(f"[bold]Image[/bold]      {p.image} [{status}]")
    else:
        lines.append("[bold]Image[/bold]      [dim]non disponible[/dim]")

    title = p.names.display()
    if form_label:
        title += f" [dim]({form_label})[/dim]"

    console.print(
        Panel(
            "\n".join(lines),
            title=f"[bold cyan]{title}[/bold cyan]",
            border_style="cyan",
            expand=False,
        )
    )


# ── Édition interactive ────────────────────────────────────────────────────────

EDITABLE_FIELDS = {
    "names.fr": "Nom français",
    "names.en": "Nom anglais",
    "names.ja": "Nom japonais",
    "types": "Types (séparés par /)",
    "form": "Forme/variante",
    "image": "Chemin image",
    "region": "Id région (kanto, alola, …)",
    "region_label_fr": "Libellé région (FR)",
    "region_dex": "Réf. dex régionale",
    "region_native": "Région native (oui/non)",
}


def edit_interactive(pokedex: Pokedex, slug: str, data_path: Path) -> None:
    """Édition interactive d'un Pokémon par son slug."""
    pokemon = next((p for p in pokedex.pokemon if p.slug == slug), None)
    if not pokemon:
        console.print(f"[red]Pokémon '{slug}' non trouvé.[/red]")
        raise SystemExit(1)

    console.print()
    view_detail(pokemon)
    console.print("\n[bold]Champs éditables :[/bold]")
    for i, (field, label) in enumerate(EDITABLE_FIELDS.items(), 1):
        console.print(f"  {i}. {label} [dim]({field})[/dim]")

    console.print()
    choice = Prompt.ask("Numéro du champ à éditer (Enter pour annuler)", default="")
    if not choice.strip():
        console.print("[dim]Annulé.[/dim]")
        return

    fields = list(EDITABLE_FIELDS.items())
    try:
        idx = int(choice) - 1
        field, label = fields[idx]
    except (ValueError, IndexError):
        console.print("[red]Choix invalide.[/red]")
        return

    # Valeur actuelle
    if "." in field:
        parent, child = field.split(".", 1)
        current = getattr(getattr(pokemon, parent, None), child, None) or ""
    elif field == "types":
        current = "/".join(pokemon.types)
    elif field == "region_native":
        current = "oui" if pokemon.region_native else "non"
    else:
        current = getattr(pokemon, field, "") or ""

    new_val = Prompt.ask(f"{label}", default=str(current))

    if not Confirm.ask(f"Confirmer : [bold]{field}[/bold] = [green]{new_val}[/green] ?"):
        console.print("[dim]Annulé.[/dim]")
        return

    # Traitement spécial pour les types
    if field == "types":
        value = [t.strip() for t in new_val.split("/") if t.strip()][:2]
        pokedex.update_pokemon(slug, types=value)
    elif field == "region_native":
        flag = _parse_region_native_flag(new_val)
        if flag is None:
            console.print("[red]Valeur invalide pour région native (oui/non).[/red]")
            return
        pokedex.update_pokemon(slug, region_native=flag)
    elif field in ("region", "region_label_fr", "region_dex"):
        pokedex.update_pokemon(slug, **{field: (new_val or "").strip()})
    else:
        pokedex.update_pokemon(slug, **{field: new_val or None})

    export_json(pokedex, data_path)
    console.print(f"[green]✓ Sauvegardé dans {data_path}[/green]")


def edit_direct(pokedex: Pokedex, slug: str, field: str, value: str, data_path: Path) -> None:
    """Édition directe sans prompt (--field / --value)."""
    if field == "types":
        typed = [t.strip() for t in value.split("/") if t.strip()][:2]
        ok = pokedex.update_pokemon(slug, types=typed)
    elif field == "region_native":
        flag = _parse_region_native_flag(value)
        if flag is None:
            console.print("[red]Valeur invalide pour région native (oui/non).[/red]")
            raise SystemExit(1)
        ok = pokedex.update_pokemon(slug, region_native=flag)
    elif field in ("region", "region_label_fr", "region_dex"):
        ok = pokedex.update_pokemon(slug, **{field: (value or "").strip()})
    else:
        ok = pokedex.update_pokemon(slug, **{field: value or None})

    if not ok:
        console.print(f"[red]Pokémon '{slug}' non trouvé.[/red]")
        raise SystemExit(1)

    export_json(pokedex, data_path)
    console.print(f"[green]✓ {slug} → {field} = {value!r}[/green]")
    console.print(f"[dim]Sauvegardé dans {data_path}[/dim]")
