"""Logique métier — profils Pokédex multiples (roadmap F15).

Each profile has an isolated set of JSON files. The **default**
profile keeps the historical layout (``data/collection-progress.json``,
``data/collection-cards.json``, ``data/binder-config.json``,
``data/binder-placements.json``) so existing installs transparently
become the first profile. Additional profiles live under
``data/profiles/<id>/...``.

The registry ``data/profiles.json`` tracks the list of known profiles
and which one is currently active. Reads are tolerant (missing /
malformed file = implicit default). Writes always persist a
normalised, well-formed registry.
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException

from tracker.models import Profile, ProfileCreate, ProfileRegistry

DEFAULT_ID = "default"
DEFAULT_NAME = "Profil principal"
PROFILE_SUBDIR = "profiles"
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


class ProfileService:
    """Registry + path resolver for profile-aware storage."""

    def __init__(self, data_root: Path, registry_path: Path) -> None:
        self._data_root = data_root
        self._registry_path = registry_path

    def load(self) -> ProfileRegistry:
        reg = self._read_raw()
        reg = _ensure_default(reg)
        return reg

    def list_profiles(self) -> ProfileRegistry:
        return self.load()

    def create(self, body: ProfileCreate) -> Profile:
        reg = self.load()
        new_id = _unique_slug_from_name(body.name, {p.id for p in reg.profiles})
        profile = Profile(
            id=new_id,
            name=body.name.strip(),
            created_at=_now_iso(),
        )
        reg.profiles.append(profile)
        self._write(reg)
        profile_dir = self._profile_root(profile.id)
        profile_dir.mkdir(parents=True, exist_ok=True)
        return profile

    def set_active(self, profile_id: str) -> ProfileRegistry:
        reg = self.load()
        ids = {p.id for p in reg.profiles}
        if profile_id not in ids:
            raise HTTPException(status_code=404, detail="profile not found")
        reg.active_id = profile_id
        self._write(reg)
        return reg

    def delete(self, profile_id: str) -> int:
        if profile_id == DEFAULT_ID:
            raise HTTPException(
                status_code=400,
                detail="default profile cannot be deleted",
            )
        reg = self.load()
        before = len(reg.profiles)
        reg.profiles = [p for p in reg.profiles if p.id != profile_id]
        removed = before - len(reg.profiles)
        if removed == 0:
            return 0
        if reg.active_id == profile_id:
            reg.active_id = DEFAULT_ID
        self._write(reg)
        return removed

    def active_id(self) -> str:
        return self.load().active_id

    def progress_path(self, profile_id: str | None = None) -> Path:
        return self._path_for(profile_id, "collection-progress.json")

    def cards_path(self, profile_id: str | None = None) -> Path:
        return self._path_for(profile_id, "collection-cards.json")

    def binder_config_path(self, profile_id: str | None = None) -> Path:
        return self._path_for(profile_id, "binder-config.json")

    def binder_placements_path(self, profile_id: str | None = None) -> Path:
        return self._path_for(profile_id, "binder-placements.json")

    def hunts_path(self, profile_id: str | None = None) -> Path:
        return self._path_for(profile_id, "hunts.json")

    def _path_for(self, profile_id: str | None, filename: str) -> Path:
        pid = profile_id or self.active_id()
        if pid == DEFAULT_ID:
            return self._data_root / filename
        return self._profile_root(pid) / filename

    def _profile_root(self, profile_id: str) -> Path:
        return self._data_root / PROFILE_SUBDIR / profile_id

    def _read_raw(self) -> ProfileRegistry:
        if not self._registry_path.is_file():
            return ProfileRegistry()
        try:
            raw = json.loads(self._registry_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return ProfileRegistry()
        try:
            return ProfileRegistry.model_validate(raw)
        except Exception:
            return ProfileRegistry()

    def _write(self, reg: ProfileRegistry) -> None:
        self._registry_path.parent.mkdir(parents=True, exist_ok=True)
        payload = reg.model_dump(mode="json")
        self._registry_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def _ensure_default(reg: ProfileRegistry) -> ProfileRegistry:
    """Guarantee that a ``default`` profile exists and is the active fallback."""
    ids = {p.id for p in reg.profiles}
    if DEFAULT_ID not in ids:
        reg.profiles.insert(
            0,
            Profile(id=DEFAULT_ID, name=DEFAULT_NAME, created_at=_now_iso()),
        )
    if reg.active_id not in {p.id for p in reg.profiles}:
        reg.active_id = DEFAULT_ID
    return reg


def _unique_slug_from_name(name: str, existing: set[str]) -> str:
    base = _slugify(name) or "profil"
    if base not in existing:
        return base
    suffix = 2
    while f"{base}-{suffix}" in existing:
        suffix += 1
    return f"{base}-{suffix}"


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii").lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    cleaned = cleaned[:32]
    if not _SLUG_RE.match(cleaned):
        cleaned = re.sub(r"[^a-z0-9_-]", "", cleaned) or ""
    return cleaned


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
