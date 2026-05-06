"""Service — full collection export and import."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from tracker.binder_models import BinderConfigPayload, BinderPlacementsPayload
from tracker.models import (
    Card,
    CardList,
    CollectionProgress,
    ExportPayload,
    ImportPayload,
    ImportResponse,
)
from tracker.repository.base import (
    BinderConfigRepository,
    BinderPlacementsRepository,
    CardRepository,
    ProgressRepository,
)
from tracker.services.badge_service import BADGES

_MEGA_FORM_RE = re.compile(r"\b(?:méga|mega)\b", re.IGNORECASE)


class ExportService:
    def __init__(
        self,
        progress_repo: ProgressRepository,
        config_repo: BinderConfigRepository,
        placements_repo: BinderPlacementsRepository,
        card_repo: CardRepository | None = None,
        pokedex_path: Path | None = None,
    ) -> None:
        self._progress = progress_repo
        self._config = config_repo
        self._placements = placements_repo
        self._cards = card_repo
        self._pokedex_path = pokedex_path

    def export_all(self) -> ExportPayload:
        cfg = self._config.load()
        progress = self._sanitize_progress_badges(self._progress.load())
        placements = self._placements.load()
        cards = self._cards.load() if self._cards is not None else CardList()
        allowed = self._allowed_slug_scope(cfg)
        if allowed is not None:
            progress = self._sanitize_progress(progress, allowed)
            placements = self._sanitize_placements(placements, allowed)
            cards = self._sanitize_cards(cards, allowed)
        return ExportPayload(
            exported_at=datetime.now(UTC).isoformat(),
            progress=progress,
            binder_config=cfg,
            binder_placements=placements,
            cards=list(cards.cards),
        )

    def import_all(self, payload: ImportPayload) -> ImportResponse:
        allowed = self._allowed_slug_scope(payload.binder_config)
        progress_in = payload.progress
        placements_in = payload.binder_placements
        cards_in = CardList(cards=list(payload.cards))
        if allowed is not None:
            progress_in = self._sanitize_progress(progress_in, allowed)
            placements_in = self._sanitize_placements(placements_in, allowed)
            cards_in = self._sanitize_cards(cards_in, allowed)

        progress = CollectionProgress(
            caught=progress_in.caught,
            statuses=progress_in.statuses,
            notes=progress_in.notes,
            badges_unlocked=self._sanitize_badge_unlocks(progress_in.badges_unlocked),
        )
        self._progress.save(progress)

        config = BinderConfigPayload(
            convention=payload.binder_config.convention,
            binders=payload.binder_config.binders,
            form_rules=payload.binder_config.form_rules,
        )
        self._config.save(config)

        placements = BinderPlacementsPayload(
            by_binder=placements_in.by_binder,
        )
        self._placements.save(placements)

        card_count = 0
        if self._cards is not None:
            self._cards.save(cards_in)
            card_count = len(cards_in.cards)

        return ImportResponse(
            caught_count=len(progress.caught),
            binder_count=len(config.binders),
            card_count=card_count,
        )

    def _load_pokedex_rows(self) -> list[dict[str, Any]]:
        if not self._pokedex_path or not self._pokedex_path.is_file():
            return []
        try:
            data = json.loads(self._pokedex_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict) and isinstance(data.get("pokemon"), list):
            rows = data["pokemon"]
        else:
            rows = []
        return [r for r in rows if isinstance(r, dict)]

    def _allowed_slug_scope(self, cfg: BinderConfigPayload) -> set[str] | None:
        rows = self._load_pokedex_rows()
        if not rows:
            return None
        rule = self._effective_rule_for_collection(cfg)
        scoped = [p for p in rows if self._pokemon_matches_binder_rule(p, rule)]
        unique = self._keep_single_classic_form_per_number(scoped)
        out: set[str] = set()
        for p in unique:
            slug = str(p.get("slug") or "")
            if slug:
                out.add(slug)
        return out

    @staticmethod
    def _effective_rule_for_collection(cfg: BinderConfigPayload) -> dict[str, Any]:
        binders = [b for b in cfg.binders if isinstance(b, dict) and b.get("id")]
        b0 = binders[0] if binders else None
        fallback = {
            "include_base": True,
            "include_mega": False,
            "include_gigamax": False,
            "include_regional": False,
            "include_other_named_forms": False,
        }
        if not b0:
            return fallback
        rule_id = b0.get("form_rule_id")
        if not rule_id:
            return fallback
        for r in cfg.form_rules:
            if isinstance(r, dict) and str(r.get("id")) == str(rule_id):
                return dict(r)
        return fallback

    @staticmethod
    def _norm_txt(value: Any) -> str:
        return str(value or "").lower()

    @classmethod
    def _is_mega_form(cls, p: dict[str, Any]) -> bool:
        # Bornes de mot sur le libellé `form` pour ne pas confondre un nom
        # contenant « mega » (ex. Méganium #0154) avec une forme Méga.
        f = cls._norm_txt(p.get("form"))
        slug = cls._norm_txt(p.get("slug"))
        if _MEGA_FORM_RE.search(f):
            return True
        return (
            "-mega-" in slug
            or slug.endswith("-mega-x")
            or slug.endswith("-mega-y")
            or slug.endswith("-mega")
        )

    @classmethod
    def _is_gigamax(cls, p: dict[str, Any]) -> bool:
        f = cls._norm_txt(p.get("form"))
        slug = cls._norm_txt(p.get("slug"))
        return "gigamax" in f or "g-max" in f or "gmax" in slug or "gigantamax" in slug

    @classmethod
    def _is_regional_form(cls, p: dict[str, Any]) -> bool:
        if cls._is_mega_form(p) or cls._is_gigamax(p):
            return False
        f = cls._norm_txt(p.get("form"))
        slug = cls._norm_txt(p.get("slug"))
        if (
            "alola" in f
            or "de galar" in f
            or "hisui" in f
            or "hisu" in f
            or "paldea" in f
        ):
            return True
        slug_bounded = f"-{slug}-"
        return (
            "-alola-" in slug_bounded
            or "-galar-" in slug_bounded
            or "-hisui-" in slug_bounded
            or "-paldea-" in slug_bounded
            or "alolan" in slug
            or "galarian" in slug
            or "hisuian" in slug
        )

    @classmethod
    def _is_other_named_form(cls, p: dict[str, Any]) -> bool:
        number = str(p.get("number") or "")
        slug = cls._norm_txt(p.get("slug"))
        if number == "0025" and slug and slug != "0025-pikachu":
            return True
        form = str(p.get("form") or "").strip()
        if not form:
            return False
        return not (cls._is_mega_form(p) or cls._is_gigamax(p) or cls._is_regional_form(p))

    @classmethod
    def _is_excluded_special_form_for_binder(cls, p: dict[str, Any]) -> bool:
        number = str(p.get("number") or "")
        slug = cls._norm_txt(p.get("slug"))
        form = cls._norm_txt(p.get("form"))
        if number == "0201" and (
            form.startswith("lettre ") or "zarbi-" in slug or "unown-" in slug
        ):
            return True
        return number == "0493" and (
            form.startswith("type ") or slug.startswith("0493-arceus-")
        )

    @classmethod
    def _pokemon_matches_form_rule(cls, p: dict[str, Any], rule: dict[str, Any]) -> bool:
        mega = bool(rule.get("include_mega"))
        giga = bool(rule.get("include_gigamax"))
        regional = rule.get("include_regional") is not False
        other = bool(rule.get("include_other_named_forms"))
        if cls._is_mega_form(p) and not mega:
            return False
        if cls._is_gigamax(p) and not giga:
            return False
        if cls._is_regional_form(p) and not regional:
            return False
        if cls._is_other_named_form(p) and not other:
            return False
        return rule.get("include_base") is not False

    @classmethod
    def _pokemon_matches_binder_rule(cls, p: dict[str, Any], rule: dict[str, Any]) -> bool:
        if cls._is_excluded_special_form_for_binder(p):
            return False
        return cls._pokemon_matches_form_rule(p, rule)

    @staticmethod
    def _is_base_form(p: dict[str, Any]) -> bool:
        return not str(p.get("form") or "").strip()

    @classmethod
    def _keep_single_classic_form_per_number(
        cls, pokemon: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        by_number: dict[str, dict[str, Any]] = {}
        for p in pokemon:
            number = str(p.get("number") or "")
            if not number:
                continue
            cur = by_number.get(number)
            if cur is None:
                by_number[number] = p
                continue
            if (not cls._is_base_form(cur)) and cls._is_base_form(p):
                by_number[number] = p
        return [
            p
            for p in pokemon
            if str(p.get("number") or "") and by_number.get(str(p.get("number"))) is p
        ]

    @staticmethod
    def _sanitize_badge_unlocks(badge_ids: list[str]) -> list[str]:
        current = {badge.id for badge in BADGES}
        seen: set[str] = set()
        out: list[str] = []
        for badge_id in badge_ids:
            if badge_id in current and badge_id not in seen:
                out.append(badge_id)
                seen.add(badge_id)
        return out

    @classmethod
    def _sanitize_progress_badges(
        cls,
        progress: CollectionProgress,
    ) -> CollectionProgress:
        return progress.model_copy(
            update={"badges_unlocked": cls._sanitize_badge_unlocks(progress.badges_unlocked)}
        )

    @staticmethod
    def _sanitize_progress(progress: CollectionProgress, allowed: set[str]) -> CollectionProgress:
        filtered_caught = {
            k: bool(v) for k, v in progress.caught.items() if str(k) in allowed
        }
        filtered_statuses = {
            slug: entry
            for slug, entry in progress.statuses.items()
            if str(slug) in allowed
        }
        filtered_notes = {
            slug: entry
            for slug, entry in progress.notes.items()
            if str(slug) in allowed
        }
        return CollectionProgress(
            caught=filtered_caught,
            statuses=filtered_statuses,
            notes=filtered_notes,
            badges_unlocked=ExportService._sanitize_badge_unlocks(progress.badges_unlocked),
        )

    @staticmethod
    def _sanitize_cards(cards: CardList, allowed: set[str]) -> CardList:
        kept: list[Card] = [c for c in cards.cards if c.pokemon_slug in allowed]
        return CardList(cards=kept)

    @staticmethod
    def _sanitize_placements(
        placements: BinderPlacementsPayload, allowed: set[str]
    ) -> BinderPlacementsPayload:
        by_binder: dict[str, dict[str, dict[str, Any]]] = {}
        for binder_id, slots in placements.by_binder.items():
            if not isinstance(slots, dict):
                continue
            by_binder[binder_id] = {
                slug: slot
                for slug, slot in slots.items()
                if str(slug) in allowed and isinstance(slot, dict)
            }
        return BinderPlacementsPayload(by_binder=by_binder)
