"""Persistance JSON de la progression (hors pokedex.json)."""

from __future__ import annotations

import json
from pathlib import Path

from tracker.models import CollectionProgress, PokemonStatusEntry


class JsonProgressRepository:
    """Implémentation fichier JSON du :class:`ProgressRepository`.

    Le fichier peut contenir :
    - ``caught`` : dict[str, bool] (schéma legacy, d'avant F03) ;
    - ``statuses`` : dict[str, {state, shiny, seen_at}] (schéma F03).

    Au chargement, le format legacy est migré en vol vers
    ``statuses``. À la sauvegarde, ``caught`` est toujours recalculé
    depuis ``statuses`` pour rester compatible avec les clients qui
    lisent encore le champ historique.
    """

    def __init__(self, file_path: Path) -> None:
        self._path = file_path

    def load(self) -> CollectionProgress:
        if not self._path.is_file():
            return CollectionProgress()
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return CollectionProgress()
        if not isinstance(raw, dict):
            return CollectionProgress()

        statuses = _load_statuses(raw.get("statuses"))
        caught = _load_caught(raw.get("caught"))
        badges = _load_badges(raw.get("badges_unlocked"))

        if not statuses and caught:
            statuses = {
                slug: PokemonStatusEntry(state="caught")
                for slug, v in caught.items()
                if v
            }

        derived_caught = _derive_caught(statuses)
        return CollectionProgress(
            caught=derived_caught,
            statuses=statuses,
            badges_unlocked=badges,
        )

    def save(self, data: CollectionProgress) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        badges = data.badges_unlocked
        if not badges:
            try:
                current = self.load()
                badges = current.badges_unlocked
            except OSError:
                badges = []
        reconciled = CollectionProgress(
            caught=_derive_caught(data.statuses) or data.caught,
            statuses=data.statuses,
            badges_unlocked=list(badges),
        )
        payload = reconciled.model_dump(mode="json")
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def _load_caught(raw: object) -> dict[str, bool]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, bool] = {}
    for k, v in raw.items():
        if isinstance(k, str) and k.strip() and isinstance(v, bool):
            out[k] = v
    return out


def _load_statuses(raw: object) -> dict[str, PokemonStatusEntry]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, PokemonStatusEntry] = {}
    for slug, entry in raw.items():
        if not isinstance(slug, str) or not slug.strip():
            continue
        if not isinstance(entry, dict):
            continue
        state = entry.get("state")
        if state not in ("seen", "caught"):
            continue
        shiny = bool(entry.get("shiny", False)) if state == "caught" else False
        seen_at = entry.get("seen_at")
        seen_at_str = seen_at if isinstance(seen_at, str) else None
        out[slug] = PokemonStatusEntry(
            state=state,
            shiny=shiny,
            seen_at=seen_at_str,
        )
    return out


def _derive_caught(statuses: dict[str, PokemonStatusEntry]) -> dict[str, bool]:
    return {slug: True for slug, entry in statuses.items() if entry.state == "caught"}


def _load_badges(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for v in raw:
        if isinstance(v, str):
            k = v.strip()
            if k and k not in seen:
                seen.add(k)
                out.append(k)
    return out
