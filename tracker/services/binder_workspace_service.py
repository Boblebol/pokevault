"""Lecture / fusion / suppression d’un classeur dans les deux fichiers JSON."""

from __future__ import annotations

from typing import Any

from tracker.binder_models import BinderConfigPayload, BinderPlacementsPayload
from tracker.repository.base import BinderConfigRepository, BinderPlacementsRepository


class BinderWorkspaceService:
    def __init__(
        self,
        config_repo: BinderConfigRepository,
        placements_repo: BinderPlacementsRepository,
    ) -> None:
        self._config_repo = config_repo
        self._placements_repo = placements_repo

    def list_summaries(self) -> list[dict[str, Any]]:
        cfg = self._config_repo.load()
        out: list[dict[str, Any]] = []
        for b in cfg.binders:
            if not isinstance(b, dict):
                continue
            bid = b.get("id")
            if not bid:
                continue
            out.append(
                {
                    "id": str(bid),
                    "name": str(b.get("name") or ""),
                    "region_scope": b.get("region_scope") or b.get("region_id"),
                }
            )
        return out

    def get_one(self, binder_id: str) -> dict[str, Any] | None:
        cfg = self._config_repo.load()
        pl = self._placements_repo.load()
        binder = next(
            (b for b in cfg.binders if isinstance(b, dict) and str(b.get("id")) == binder_id),
            None,
        )
        if not binder:
            return None
        rule_id = binder.get("form_rule_id")
        form_rule: dict[str, Any] | None = None
        if rule_id:
            for r in cfg.form_rules:
                if isinstance(r, dict) and str(r.get("id")) == str(rule_id):
                    form_rule = r
                    break
        raw_pl = pl.by_binder.get(binder_id)
        placements: dict[str, dict[str, Any]] = raw_pl if isinstance(raw_pl, dict) else {}
        return {
            "id": binder_id,
            "binder": dict(binder),
            "form_rule": dict(form_rule) if form_rule else None,
            "placements": dict(placements),
        }

    def upsert_with_rules(
        self,
        binder_id: str,
        binder: dict[str, Any],
        form_rule: dict[str, Any] | None,
        placements: dict[str, dict[str, Any]],
    ) -> None:
        cfg = self._config_repo.load()
        pl = self._placements_repo.load()
        binders = [b for b in cfg.binders if isinstance(b, dict) and str(b.get("id")) != binder_id]
        merged = dict(binder)
        merged["id"] = binder_id
        rules = [r for r in cfg.form_rules if isinstance(r, dict)]
        if form_rule and isinstance(form_rule, dict) and form_rule.get("id"):
            rid = str(form_rule["id"])
            rules = [r for r in rules if str(r.get("id")) != rid]
            rules.append(dict(form_rule))
            merged["form_rule_id"] = rid
        binders.append(merged)
        by_b = dict(pl.by_binder)
        by_b[binder_id] = dict(placements)
        self._save(cfg, binders, rules, by_b)

    def delete_one(self, binder_id: str) -> bool:
        cfg = self._config_repo.load()
        pl = self._placements_repo.load()
        before = len(cfg.binders)
        binders = [b for b in cfg.binders if isinstance(b, dict) and str(b.get("id")) != binder_id]
        if len(binders) == before:
            return False
        used_rule_ids = {str(b.get("form_rule_id")) for b in binders if b.get("form_rule_id")}
        rules = [
            r for r in cfg.form_rules if isinstance(r, dict) and str(r.get("id")) in used_rule_ids
        ]
        by_b = {k: v for k, v in pl.by_binder.items() if k != binder_id}
        self._save(cfg, binders, rules, by_b)
        return True

    def _save(
        self,
        cfg: BinderConfigPayload,
        binders: list[dict[str, Any]],
        form_rules: list[dict[str, Any]],
        by_binder: dict[str, dict[str, Any]],
    ) -> None:
        self._config_repo.save(
            BinderConfigPayload(
                convention=cfg.convention,
                binders=binders,
                form_rules=form_rules,
            )
        )
        self._placements_repo.save(BinderPlacementsPayload(by_binder=by_binder))
