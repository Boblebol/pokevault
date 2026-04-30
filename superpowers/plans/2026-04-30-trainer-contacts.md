# Trainer Contacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional local-first Dresseurs tab where users create a portable Trainer Card, export it as a file, import cards received from other collectors, and update contacts without adding friction to the core Pokedex flow.

**Architecture:** Keep the feature isolated as a profile-scoped JSON domain next to cards, hunts and binders. The backend owns validation, timestamps, identity-based upsert, and persistence; the web app adds a lazy route (`#/dresseurs`) that only loads and renders when users open the tab. The full backup/export flow remains unchanged so Trainer Card sharing is explicit and separate from collection backup.

**Tech Stack:** Python 3.11+ / FastAPI / Pydantic v2 / JSON repositories, vanilla HTML/CSS/JS, Node built-in test runner, pytest, ruff.

---

## File Structure

- Create `tracker/repository/json_trainer_contact_repository.py`: tolerant JSON persistence for `data/trainer-contacts.json` and `data/profiles/<id>/trainer-contacts.json`.
- Create `tracker/services/trainer_contact_service.py`: business rules for own card save, export payload generation, import/upsert, private notes and delete.
- Create `tracker/api/controllers/trainer_contact_controller.py`: REST routes under `/api/trainers`.
- Create `tests/tracker/test_trainer_contact_service.py`: service and repository behavior.
- Create `tests/tracker/test_trainer_contact_api.py`: FastAPI endpoint behavior.
- Create `web/trainer-contacts.js`: route-local client state, import/export file handling and DOM rendering.
- Create `tests/web/trainer-contacts.test.mjs`: pure normalization/import decision tests for the web client.
- Create `docs/TRAINER_CONTACTS.md`: durable format notes for the public Trainer Card file.
- Modify `tracker/models.py`: Pydantic models for Trainer Card, contact book and API responses.
- Modify `tracker/repository/base.py`: `TrainerContactRepository` protocol.
- Modify `tracker/config.py`: legacy default path property.
- Modify `tracker/services/profile_service.py`: profile-scoped `trainer_contacts_path()`.
- Modify `tracker/api/dependencies.py`: repository and service dependency providers.
- Modify `tracker/api/controllers/__init__.py` and `tracker/app.py`: expose the new router.
- Modify `tests/tracker/test_config.py`, `tests/tracker/test_profile_service.py`, `tests/tracker/test_dependencies.py`, `tests/tracker/test_app.py`: assert routing and paths.
- Modify `web/index.html`: add optional top-nav item, `viewDresseurs`, hidden file input and script tag.
- Modify `web/app.js`: route `#/dresseurs`, lazy-start `PokevaultTrainerContacts.start()`, title and active nav state.
- Modify `web/styles.css`: Dresseurs layout using existing cards/buttons/tokens, no new forced onboarding or overlay.
- Modify `README.md`: feature list, user state file, API table and privacy wording.
- Modify `docs/features.html`, `docs/roadmap.html`, `docs/ROADMAP.md`, `docs/architecture.html`: GitHub Pages and roadmap updates.
- Modify `tests/test_docs_site.py`: check public docs mention Trainer Cards and local-first optionality.

## Data Contracts

Use these model names and fields consistently:

```python
TrainerContactMethod = Literal["email", "phone", "discord", "website", "other"]

class TrainerContactLink(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: TrainerContactMethod = "other"
    label: str = Field(default="", max_length=32)
    value: str = Field(default="", max_length=160)

class TrainerCard(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    app: Literal["pokevault"] = "pokevault"
    kind: Literal["trainer_card"] = "trainer_card"
    trainer_id: str = Field(min_length=8, max_length=80)
    display_name: str = Field(min_length=1, max_length=64)
    favorite_region: str = Field(default="", max_length=32)
    favorite_pokemon_slug: str = Field(default="", max_length=80)
    public_note: str = Field(default="", max_length=280)
    contact_links: list[TrainerContactLink] = Field(default_factory=list, max_length=6)
    wants: list[str] = Field(default_factory=list, max_length=40)
    for_trade: list[str] = Field(default_factory=list, max_length=40)
    updated_at: str

class TrainerContact(BaseModel):
    model_config = ConfigDict(extra="forbid")
    card: TrainerCard
    private_note: str = Field(default="", max_length=500)
    first_received_at: str
    last_received_at: str

class TrainerContactBook(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Literal[1] = 1
    own_card: TrainerCard | None = None
    contacts: dict[str, TrainerContact] = Field(default_factory=dict)
```

The import endpoint receives a `TrainerCard` directly. It returns:

```python
class TrainerContactImportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ok: bool = True
    action: Literal["created", "updated", "unchanged"]
    contact: TrainerContact
```

## API Contract

- `GET /api/trainers` returns `TrainerContactBook`.
- `PUT /api/trainers/me` saves and returns the local `own_card`.
- `GET /api/trainers/card` returns the exportable `TrainerCard`; `404` when no card exists.
- `POST /api/trainers/import` imports a received `TrainerCard`.
- `PATCH /api/trainers/{trainer_id}/note` updates private note only.
- `DELETE /api/trainers/{trainer_id}` removes a contact and returns `{ "ok": true, "deleted": 0|1 }`.

## Task 1: Backend Models, Repository and Service

**Files:**
- Modify: `tracker/models.py`
- Modify: `tracker/repository/base.py`
- Create: `tracker/repository/json_trainer_contact_repository.py`
- Create: `tracker/services/trainer_contact_service.py`
- Test: `tests/tracker/test_trainer_contact_service.py`

- [ ] **Step 1: Write failing service/repository tests**

Add `tests/tracker/test_trainer_contact_service.py` with these tests:

```python
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from tracker.models import TrainerCard, TrainerContactNotePatch
from tracker.repository.json_trainer_contact_repository import JsonTrainerContactRepository
from tracker.services.trainer_contact_service import TrainerContactService


def _card(trainer_id: str = "trainer-123", name: str = "Alex") -> TrainerCard:
    return TrainerCard(
        trainer_id=trainer_id,
        display_name=name,
        favorite_region="kanto",
        favorite_pokemon_slug="0025-pikachu",
        public_note="Local only",
        wants=["0001-bulbasaur"],
        for_trade=["0004-charmander"],
        updated_at="2026-04-30T10:00:00+00:00",
    )


def test_save_own_card_creates_stable_id_and_trims_fields(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    card = service.save_own_card(_card(trainer_id="manual-id", name="  Alex  "))

    assert card.trainer_id == "manual-id"
    assert card.display_name == "Alex"
    assert card.updated_at
    assert service.export_own_card().trainer_id == "manual-id"


def test_import_card_creates_then_updates_by_trainer_id(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    created = service.import_card(_card(name="Alex"))
    updated = service.import_card(_card(name="Alexandre"))

    assert created.action == "created"
    assert updated.action == "updated"
    assert updated.contact.card.display_name == "Alexandre"
    assert len(service.get_book().contacts) == 1


def test_import_card_ignores_same_or_older_timestamp(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    service.import_card(_card(name="New"))
    response = service.import_card(
        _card(name="Old").model_copy(update={"updated_at": "2026-04-29T10:00:00+00:00"})
    )

    assert response.action == "unchanged"
    assert response.contact.card.display_name == "New"


def test_private_note_is_local_and_survives_contact_update(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))
    service.import_card(_card())

    noted = service.patch_private_note("trainer-123", TrainerContactNotePatch(note="Vu au tournoi"))
    service.import_card(_card(name="Alex v2").model_copy(update={"updated_at": "2026-05-01T10:00:00+00:00"}))

    assert noted.private_note == "Vu au tournoi"
    assert service.get_book().contacts["trainer-123"].private_note == "Vu au tournoi"


def test_delete_contact_returns_count(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))
    service.import_card(_card())

    assert service.delete_contact("trainer-123") == 1
    assert service.delete_contact("trainer-123") == 0


def test_repository_tolerates_missing_malformed_and_invalid_files(tmp_path: Path) -> None:
    assert JsonTrainerContactRepository(tmp_path / "missing.json").load().contacts == {}

    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    assert JsonTrainerContactRepository(broken).load().contacts == {}

    invalid = tmp_path / "invalid.json"
    invalid.write_text('{"version": 1, "contacts": []}', encoding="utf-8")
    assert JsonTrainerContactRepository(invalid).load().contacts == {}


def test_export_own_card_requires_existing_card(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))

    with pytest.raises(HTTPException) as exc:
        service.export_own_card()

    assert exc.value.status_code == 404
    assert exc.value.detail == "trainer card not found"
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `uv run pytest tests/tracker/test_trainer_contact_service.py -q`

Expected: FAIL during import because `TrainerCard`, `TrainerContactNotePatch`, `JsonTrainerContactRepository`, and `TrainerContactService` do not exist.

- [ ] **Step 3: Implement models, repository protocol and JSON repository**

Add the data contract models from this plan to `tracker/models.py`.

Add to `tracker/repository/base.py`:

```python
from tracker.models import TrainerContactBook


class TrainerContactRepository(Protocol):
    def load(self) -> TrainerContactBook: ...
    def save(self, data: TrainerContactBook) -> None: ...
```

Create `tracker/repository/json_trainer_contact_repository.py`:

```python
"""Persistance JSON des contacts dresseurs."""

from __future__ import annotations

import json
from pathlib import Path

from tracker.models import TrainerContactBook


class JsonTrainerContactRepository:
    def __init__(self, file_path: Path) -> None:
        self._path = file_path

    def load(self) -> TrainerContactBook:
        if not self._path.is_file():
            return TrainerContactBook()
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return TrainerContactBook()
        if not isinstance(raw, dict):
            return TrainerContactBook()
        try:
            state = TrainerContactBook.model_validate(raw)
        except Exception:
            return TrainerContactBook()
        contacts = {
            trainer_id.strip(): contact
            for trainer_id, contact in state.contacts.items()
            if isinstance(trainer_id, str)
            and trainer_id.strip()
            and contact.card.trainer_id == trainer_id.strip()
        }
        return TrainerContactBook(own_card=state.own_card, contacts=contacts)

    def save(self, data: TrainerContactBook) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = data.model_dump(mode="json")
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
```

- [ ] **Step 4: Implement `TrainerContactService`**

Create `tracker/services/trainer_contact_service.py` with:

```python
"""Logique métier — cartes dresseur locales."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException

from tracker.models import (
    TrainerCard,
    TrainerContact,
    TrainerContactBook,
    TrainerContactImportResponse,
    TrainerContactNotePatch,
)
from tracker.repository.base import TrainerContactRepository


class TrainerContactService:
    def __init__(self, repository: TrainerContactRepository) -> None:
        self._repository = repository

    def get_book(self) -> TrainerContactBook:
        return self._repository.load()

    def save_own_card(self, card: TrainerCard) -> TrainerCard:
        book = self._repository.load()
        clean = self._clean_card(card, stamp=True)
        book.own_card = clean
        self._repository.save(book)
        return clean

    def export_own_card(self) -> TrainerCard:
        card = self._repository.load().own_card
        if card is None:
            raise HTTPException(status_code=404, detail="trainer card not found")
        return card

    def import_card(self, card: TrainerCard) -> TrainerContactImportResponse:
        clean = self._clean_card(card, stamp=False)
        if not clean.trainer_id:
            raise HTTPException(status_code=400, detail="trainer_id is required")
        book = self._repository.load()
        existing = book.contacts.get(clean.trainer_id)
        now = _now_iso()
        if existing is None:
            contact = TrainerContact(card=clean, first_received_at=now, last_received_at=now)
            book.contacts[clean.trainer_id] = contact
            self._repository.save(book)
            return TrainerContactImportResponse(action="created", contact=contact)
        if _is_newer(clean.updated_at, existing.card.updated_at):
            contact = TrainerContact(
                card=clean,
                private_note=existing.private_note,
                first_received_at=existing.first_received_at,
                last_received_at=now,
            )
            book.contacts[clean.trainer_id] = contact
            self._repository.save(book)
            return TrainerContactImportResponse(action="updated", contact=contact)
        return TrainerContactImportResponse(action="unchanged", contact=existing)

    def patch_private_note(self, trainer_id: str, body: TrainerContactNotePatch) -> TrainerContact:
        key = trainer_id.strip()
        book = self._repository.load()
        contact = book.contacts.get(key)
        if contact is None:
            raise HTTPException(status_code=404, detail="trainer contact not found")
        updated = contact.model_copy(update={"private_note": body.note.strip()})
        book.contacts[key] = updated
        self._repository.save(book)
        return updated

    def delete_contact(self, trainer_id: str) -> int:
        key = trainer_id.strip()
        book = self._repository.load()
        if key not in book.contacts:
            return 0
        del book.contacts[key]
        self._repository.save(book)
        return 1

    @staticmethod
    def _clean_card(card: TrainerCard, *, stamp: bool) -> TrainerCard:
        links = [
            link.model_copy(update={"label": link.label.strip(), "value": link.value.strip()})
            for link in card.contact_links
            if link.value.strip()
        ]
        return card.model_copy(
            update={
                "trainer_id": card.trainer_id.strip(),
                "display_name": card.display_name.strip(),
                "favorite_region": card.favorite_region.strip(),
                "favorite_pokemon_slug": card.favorite_pokemon_slug.strip(),
                "public_note": card.public_note.strip(),
                "contact_links": links,
                "wants": _clean_list(card.wants),
                "for_trade": _clean_list(card.for_trade),
                "updated_at": _now_iso() if stamp else card.updated_at,
            }
        )


def _clean_list(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = str(value or "").strip()
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def _is_newer(candidate: str, current: str) -> bool:
    return candidate > current


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
```

- [ ] **Step 5: Run service tests and verify GREEN**

Run: `uv run pytest tests/tracker/test_trainer_contact_service.py -q`

Expected: PASS.

## Task 2: API Wiring and Profile-Scoped Storage

**Files:**
- Modify: `tracker/config.py`
- Modify: `tracker/services/profile_service.py`
- Modify: `tracker/api/dependencies.py`
- Modify: `tracker/api/controllers/__init__.py`
- Modify: `tracker/app.py`
- Create: `tracker/api/controllers/trainer_contact_controller.py`
- Test: `tests/tracker/test_trainer_contact_api.py`
- Test: `tests/tracker/test_config.py`
- Test: `tests/tracker/test_profile_service.py`
- Test: `tests/tracker/test_dependencies.py`
- Test: `tests/tracker/test_app.py`

- [ ] **Step 1: Write failing API tests**

Create `tests/tracker/test_trainer_contact_api.py`:

```python
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.api.controllers.trainer_contact_controller import router as trainer_router
from tracker.api.dependencies import get_trainer_contact_service
from tracker.repository.json_trainer_contact_repository import JsonTrainerContactRepository
from tracker.services.trainer_contact_service import TrainerContactService


def _client(tmp_path: Path) -> TestClient:
    service = TrainerContactService(
        JsonTrainerContactRepository(tmp_path / "data" / "trainer-contacts.json")
    )
    app = FastAPI()
    app.include_router(trainer_router)
    app.dependency_overrides[get_trainer_contact_service] = lambda: service
    return TestClient(app)


def _payload(name: str = "Alex") -> dict:
    return {
        "schema_version": 1,
        "app": "pokevault",
        "kind": "trainer_card",
        "trainer_id": "trainer-123",
        "display_name": name,
        "favorite_region": "kanto",
        "favorite_pokemon_slug": "0025-pikachu",
        "public_note": "Local first",
        "contact_links": [{"kind": "discord", "label": "Discord", "value": "alex#0001"}],
        "wants": ["0001-bulbasaur"],
        "for_trade": ["0004-charmander"],
        "updated_at": "2026-04-30T10:00:00+00:00",
    }


def test_get_trainers_starts_empty(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.get("/api/trainers")

    assert response.status_code == 200
    assert response.json() == {"version": 1, "own_card": None, "contacts": {}}


def test_put_and_export_own_card(tmp_path: Path) -> None:
    client = _client(tmp_path)

    saved = client.put("/api/trainers/me", json=_payload()).json()
    exported = client.get("/api/trainers/card").json()

    assert saved["display_name"] == "Alex"
    assert exported["trainer_id"] == "trainer-123"


def test_import_card_creates_contact_then_updates(tmp_path: Path) -> None:
    client = _client(tmp_path)

    created = client.post("/api/trainers/import", json=_payload()).json()
    updated_payload = _payload("Alexandre")
    updated_payload["updated_at"] = "2026-05-01T10:00:00+00:00"
    updated = client.post("/api/trainers/import", json=updated_payload).json()

    assert created["action"] == "created"
    assert updated["action"] == "updated"
    assert client.get("/api/trainers").json()["contacts"]["trainer-123"]["card"]["display_name"] == "Alexandre"


def test_patch_note_and_delete_contact(tmp_path: Path) -> None:
    client = _client(tmp_path)
    client.post("/api/trainers/import", json=_payload())

    note = client.patch("/api/trainers/trainer-123/note", json={"note": "Rencontré IRL"}).json()
    deleted = client.delete("/api/trainers/trainer-123").json()

    assert note["private_note"] == "Rencontré IRL"
    assert deleted == {"ok": True, "deleted": 1}
```

Append focused assertions:

- `tests/tracker/test_config.py`: `assert s.trainer_contacts_path == root / "data" / "trainer-contacts.json"`.
- `tests/tracker/test_profile_service.py`: default path is `data/trainer-contacts.json`, custom path is `data/profiles/<id>/trainer-contacts.json`.
- `tests/tracker/test_dependencies.py`: `get_trainer_contact_repository` and `get_trainer_contact_service` return usable objects.
- `tests/tracker/test_app.py`: `client.get("/api/trainers").status_code == 200`.

- [ ] **Step 2: Run API/path tests and verify RED**

Run: `uv run pytest tests/tracker/test_trainer_contact_api.py tests/tracker/test_config.py tests/tracker/test_profile_service.py tests/tracker/test_dependencies.py tests/tracker/test_app.py -q`

Expected: FAIL because the controller, dependency providers and path helpers do not exist.

- [ ] **Step 3: Implement path helpers and dependency wiring**

Add to `tracker/config.py`:

```python
@property
def trainer_contacts_path(self) -> Path:
    """Local trainer cards received from other collectors."""
    return self.data_dir / "trainer-contacts.json"
```

Add to `ProfileService`:

```python
def trainer_contacts_path(self, profile_id: str | None = None) -> Path:
    return self._path_for(profile_id, "trainer-contacts.json")
```

Wire `tracker/api/dependencies.py`:

```python
from tracker.repository.base import TrainerContactRepository
from tracker.repository.json_trainer_contact_repository import JsonTrainerContactRepository
from tracker.services.trainer_contact_service import TrainerContactService


def get_trainer_contact_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
    profiles: Annotated[ProfileService, Depends(get_profile_service)],
) -> TrainerContactRepository:
    return JsonTrainerContactRepository(profiles.trainer_contacts_path())


def get_trainer_contact_service(
    repository: Annotated[TrainerContactRepository, Depends(get_trainer_contact_repository)],
) -> TrainerContactService:
    return TrainerContactService(repository)
```

- [ ] **Step 4: Implement controller and mount it**

Create `tracker/api/controllers/trainer_contact_controller.py`:

```python
"""API — contacts dresseurs locaux."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from tracker.api.dependencies import get_trainer_contact_service
from tracker.models import (
    DeleteResponse,
    TrainerCard,
    TrainerContact,
    TrainerContactBook,
    TrainerContactImportResponse,
    TrainerContactNotePatch,
)
from tracker.services.trainer_contact_service import TrainerContactService

router = APIRouter(prefix="/api", tags=["trainers"])


@router.get("/trainers", response_model=TrainerContactBook)
def get_trainers(
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerContactBook:
    return service.get_book()


@router.put("/trainers/me", response_model=TrainerCard)
def put_own_trainer_card(
    body: TrainerCard,
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerCard:
    return service.save_own_card(body)


@router.get("/trainers/card", response_model=TrainerCard)
def export_own_trainer_card(
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerCard:
    return service.export_own_card()


@router.post("/trainers/import", response_model=TrainerContactImportResponse)
def import_trainer_card(
    body: TrainerCard,
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerContactImportResponse:
    return service.import_card(body)


@router.patch("/trainers/{trainer_id}/note", response_model=TrainerContact)
def patch_trainer_note(
    trainer_id: str,
    body: TrainerContactNotePatch,
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> TrainerContact:
    return service.patch_private_note(trainer_id, body)


@router.delete("/trainers/{trainer_id}", response_model=DeleteResponse)
def delete_trainer_contact(
    trainer_id: str,
    service: Annotated[TrainerContactService, Depends(get_trainer_contact_service)],
) -> DeleteResponse:
    return DeleteResponse(deleted=service.delete_contact(trainer_id))
```

If `DeleteResponse` does not exist, add this model once in `tracker/models.py`:

```python
class DeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ok: bool = True
    deleted: int = Field(ge=0)
```

Export router from `tracker/api/controllers/__init__.py` as `trainer_contact_router`, then include it in `tracker/app.py` before `export_router`.

- [ ] **Step 5: Run API/path tests and verify GREEN**

Run: `uv run pytest tests/tracker/test_trainer_contact_api.py tests/tracker/test_config.py tests/tracker/test_profile_service.py tests/tracker/test_dependencies.py tests/tracker/test_app.py -q`

Expected: PASS.

## Task 3: Optional Dresseurs Web Client

**Files:**
- Create: `web/trainer-contacts.js`
- Create: `tests/web/trainer-contacts.test.mjs`
- Modify: `web/index.html`
- Modify: `web/app.js`
- Test: `tests/web/trainer-contacts.test.mjs`

- [ ] **Step 1: Write failing web tests**

Create `tests/web/trainer-contacts.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";

function installBrowserStubs() {
  globalThis.__POKEVAULT_TRAINERS_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.document = {
    addEventListener() {},
    dispatchEvent() {},
    getElementById() {
      return null;
    },
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/trainer-contacts.js?case=${Date.now()}`);
  return globalThis.window.PokevaultTrainerContacts._test;
}

test("normalizeBook keeps own card and contacts keyed by trainer id", async () => {
  const api = await loadModule();
  const book = api.normalizeBook({
    own_card: { trainer_id: "me", display_name: "Me", updated_at: "2026-04-30T10:00:00+00:00" },
    contacts: {
      alex: {
        card: { trainer_id: "alex", display_name: "Alex", wants: ["0025-pikachu"], updated_at: "2026-04-30T10:00:00+00:00" },
        private_note: "trade",
        first_received_at: "2026-04-30T11:00:00+00:00",
        last_received_at: "2026-04-30T11:00:00+00:00",
      },
      bad: { card: { trainer_id: "", display_name: "" } },
    },
  });

  assert.equal(book.own_card.display_name, "Me");
  assert.deepEqual(Object.keys(book.contacts), ["alex"]);
  assert.equal(book.contacts.alex.card.wants[0], "0025-pikachu");
});

test("cardFromForm trims optional lists and contact link values", async () => {
  const api = await loadModule();
  const card = api.cardFromForm({
    trainer_id: "trainer-123",
    display_name: " Alex ",
    favorite_region: "kanto",
    favorite_pokemon_slug: " 0025-pikachu ",
    public_note: " hello ",
    contact_kind: "discord",
    contact_label: " Discord ",
    contact_value: " alex#0001 ",
    wants: "0001-bulbasaur\\n\\n0004-charmander",
    for_trade: "0007-squirtle",
  });

  assert.equal(card.display_name, "Alex");
  assert.equal(card.favorite_pokemon_slug, "0025-pikachu");
  assert.deepEqual(card.wants, ["0001-bulbasaur", "0004-charmander"]);
  assert.deepEqual(card.for_trade, ["0007-squirtle"]);
  assert.equal(card.contact_links[0].value, "alex#0001");
});
```

- [ ] **Step 2: Run web tests and verify RED**

Run: `node --test tests/web/trainer-contacts.test.mjs`

Expected: FAIL because `web/trainer-contacts.js` does not exist.

- [ ] **Step 3: Add route shell and script tag**

Modify `web/index.html`:

- Add a top-nav link after `Classeurs`:

```html
<a href="#/dresseurs" class="app-switch-link" data-view="dresseurs">Dresseurs</a>
```

- Add a hidden route section after `viewClasseur`:

```html
<div id="viewDresseurs" class="app-view" hidden>
  <header class="header binder-header app-collection-header">
    <h1 class="title title-binder">Dresseurs</h1>
    <p class="collection-subtitle">Cartes dresseur locales, importées par fichier, sans compte ni serveur.</p>
  </header>
  <section class="trainer-shell" id="trainerContactsRoot" aria-label="Contacts dresseurs"></section>
  <input type="file" id="trainerImportFileInput" accept=".json,.pokevault.json,.pokevault-trainer.json" hidden />
</div>
```

- Add before `app.js`:

```html
<script src="/trainer-contacts.js" defer></script>
```

Modify `web/app.js`:

```javascript
if (raw === "dresseurs") return "dresseurs";
```

Add `viewDresseurs` hide/show, title `"pokevault — Dresseurs"`, and:

```javascript
if (view === "dresseurs" && typeof window.PokevaultTrainerContacts?.start === "function") {
  window.PokevaultTrainerContacts.start();
}
```

- [ ] **Step 4: Implement `web/trainer-contacts.js`**

Create a client module exposing `window.PokevaultTrainerContacts` with:

```javascript
/**
 * Pokevault — optional local-first Trainer Cards client.
 */
(function initTrainerContacts() {
  "use strict";

  const API_TRAINERS = "/api/trainers";
  let cachedBook = { version: 1, own_card: null, contacts: {} };
  let started = false;

  function normalizeList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 40);
  }

  function normalizeCard(raw) {
    if (!raw || typeof raw !== "object") return null;
    const trainerId = String(raw.trainer_id || "").trim();
    const displayName = String(raw.display_name || "").trim();
    if (!trainerId || !displayName) return null;
    const contactLinks = Array.isArray(raw.contact_links) ? raw.contact_links : [];
    return {
      schema_version: 1,
      app: "pokevault",
      kind: "trainer_card",
      trainer_id: trainerId,
      display_name: displayName,
      favorite_region: String(raw.favorite_region || "").trim(),
      favorite_pokemon_slug: String(raw.favorite_pokemon_slug || "").trim(),
      public_note: String(raw.public_note || "").trim(),
      contact_links: contactLinks
        .map((link) => ({
          kind: ["email", "phone", "discord", "website", "other"].includes(link?.kind) ? link.kind : "other",
          label: String(link?.label || "").trim(),
          value: String(link?.value || "").trim(),
        }))
        .filter((link) => link.value)
        .slice(0, 6),
      wants: normalizeList(raw.wants),
      for_trade: normalizeList(raw.for_trade),
      updated_at: String(raw.updated_at || new Date().toISOString()),
    };
  }

  function normalizeContact(raw) {
    const card = normalizeCard(raw?.card);
    if (!card) return null;
    return {
      card,
      private_note: String(raw?.private_note || ""),
      first_received_at: String(raw?.first_received_at || ""),
      last_received_at: String(raw?.last_received_at || ""),
    };
  }

  function normalizeBook(raw) {
    const out = { version: 1, own_card: normalizeCard(raw?.own_card), contacts: {} };
    const contacts = raw && typeof raw.contacts === "object" ? raw.contacts : {};
    for (const [id, value] of Object.entries(contacts)) {
      const contact = normalizeContact(value);
      if (contact && contact.card.trainer_id === String(id)) out.contacts[id] = contact;
    }
    return out;
  }

  function splitLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 40);
  }

  function cardFromForm(values) {
    const linkValue = String(values.contact_value || "").trim();
    return {
      schema_version: 1,
      app: "pokevault",
      kind: "trainer_card",
      trainer_id: String(values.trainer_id || "").trim(),
      display_name: String(values.display_name || "").trim(),
      favorite_region: String(values.favorite_region || "").trim(),
      favorite_pokemon_slug: String(values.favorite_pokemon_slug || "").trim(),
      public_note: String(values.public_note || "").trim(),
      contact_links: linkValue
        ? [{
            kind: ["email", "phone", "discord", "website", "other"].includes(values.contact_kind) ? values.contact_kind : "other",
            label: String(values.contact_label || "").trim(),
            value: linkValue,
          }]
        : [],
      wants: splitLines(values.wants),
      for_trade: splitLines(values.for_trade),
      updated_at: new Date().toISOString(),
    };
  }

  async function loadBook() {
    const res = await fetch(API_TRAINERS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedBook = normalizeBook(await res.json());
    return cachedBook;
  }

  async function saveOwnCard(card) {
    const res = await fetch(`${API_TRAINERS}/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadBook();
    render();
  }

  async function importCard(card) {
    const res = await fetch(`${API_TRAINERS}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    await loadBook();
    render(`Import ${body.action}`);
  }

  function render(message = "") {
    const root = document.getElementById("trainerContactsRoot");
    if (!root) return;
    root.replaceChildren();
    const own = document.createElement("section");
    own.className = "trainer-panel";
    own.innerHTML = `
      <div class="trainer-panel-head">
        <div>
          <p class="stats-kpi-label">Ma carte dresseur</p>
          <p class="stats-kpi-sub">Choisis uniquement ce que tu veux partager.</p>
        </div>
        <div class="trainer-actions">
          <button type="button" class="settings-action-btn" data-trainer-export>Exporter</button>
          <button type="button" class="settings-action-btn" data-trainer-import>Importer</button>
        </div>
      </div>
      <form class="trainer-card-form" data-trainer-form>
        <input name="trainer_id" class="search-input" placeholder="Identifiant stable" value="${escapeAttr(cachedBook.own_card?.trainer_id || crypto.randomUUID?.() || `trainer-${Date.now()}`)}">
        <input name="display_name" class="search-input" placeholder="Pseudo dresseur" value="${escapeAttr(cachedBook.own_card?.display_name || "")}">
        <input name="favorite_region" class="search-input" placeholder="Région favorite" value="${escapeAttr(cachedBook.own_card?.favorite_region || "")}">
        <input name="favorite_pokemon_slug" class="search-input" placeholder="Pokémon favori (slug)" value="${escapeAttr(cachedBook.own_card?.favorite_pokemon_slug || "")}">
        <textarea name="public_note" class="search-input" placeholder="Note publique">${escapeText(cachedBook.own_card?.public_note || "")}</textarea>
        <select name="contact_kind" class="region-filter"><option value="discord">Discord</option><option value="email">Email</option><option value="phone">Téléphone</option><option value="website">Site</option><option value="other">Autre</option></select>
        <input name="contact_label" class="search-input" placeholder="Libellé contact">
        <input name="contact_value" class="search-input" placeholder="Valeur contact">
        <textarea name="wants" class="search-input" placeholder="Je cherche (un slug par ligne)">${escapeText((cachedBook.own_card?.wants || []).join("\n"))}</textarea>
        <textarea name="for_trade" class="search-input" placeholder="Je peux échanger (un slug par ligne)">${escapeText((cachedBook.own_card?.for_trade || []).join("\n"))}</textarea>
        <button type="submit" class="settings-action-btn settings-action-btn--confirm">Enregistrer</button>
      </form>
      <p class="sync-hint" ${message ? "" : "hidden"}>${escapeText(message)}</p>
    `;
    root.append(own, renderContactList());
    wire(root);
  }

  function renderContactList() {
    const section = document.createElement("section");
    section.className = "trainer-panel";
    const contacts = Object.values(cachedBook.contacts);
    section.innerHTML = `<p class="stats-kpi-label">Contacts dresseurs</p>`;
    const list = document.createElement("div");
    list.className = "trainer-contact-list";
    if (!contacts.length) {
      const empty = document.createElement("p");
      empty.className = "stats-kpi-sub";
      empty.textContent = "Aucune carte reçue pour le moment.";
      list.append(empty);
    }
    for (const contact of contacts) list.append(renderContact(contact));
    section.append(list);
    return section;
  }

  function renderContact(contact) {
    const article = document.createElement("article");
    article.className = "trainer-contact-card";
    article.innerHTML = `
      <h2>${escapeText(contact.card.display_name)}</h2>
      <p>${escapeText(contact.card.public_note || "Carte dresseur locale")}</p>
      <p class="stats-kpi-sub">MAJ reçue : ${escapeText(contact.last_received_at || "inconnue")}</p>
      <p class="trainer-tags">${escapeText((contact.card.wants || []).join(" · "))}</p>
    `;
    return article;
  }

  function wire(root) {
    const form = root.querySelector("[data-trainer-form]");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      void saveOwnCard(cardFromForm(data)).catch((err) => render(`Erreur : ${err.message}`));
    });
    root.querySelector("[data-trainer-export]")?.addEventListener("click", exportFile);
    root.querySelector("[data-trainer-import]")?.addEventListener("click", () => {
      document.getElementById("trainerImportFileInput")?.click();
    });
  }

  function exportFile() {
    if (!cachedBook.own_card) {
      render("Crée ta carte avant de l'exporter.");
      return;
    }
    const blob = new Blob([JSON.stringify(cachedBook.own_card, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cachedBook.own_card.display_name || "trainer"}-pokevault-trainer.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function wireImportInput() {
    const input = document.getElementById("trainerImportFileInput");
    if (!input || input.dataset.wired) return;
    input.dataset.wired = "1";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const card = normalizeCard(JSON.parse(reader.result));
          if (!card) throw new Error("Carte dresseur invalide");
          void importCard(card);
        } catch (err) {
          render(`Fichier invalide : ${err.message}`);
        }
        input.value = "";
      };
      reader.readAsText(file);
    });
  }

  async function start() {
    if (started) return;
    started = true;
    wireImportInput();
    try {
      await loadBook();
      render();
    } catch (err) {
      render(`Erreur API : ${err.message}`);
    }
  }

  function escapeText(value) {
    return String(value || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  }

  function escapeAttr(value) {
    return escapeText(value).replace(/"/g, "&quot;");
  }

  const api = { start, normalizeBook, cardFromForm };
  if (window.__POKEVAULT_TRAINERS_TESTS__) api._test = { normalizeBook, cardFromForm };
  window.PokevaultTrainerContacts = api;
})();
```

- [ ] **Step 5: Run web tests and verify GREEN**

Run: `node --test tests/web/trainer-contacts.test.mjs`

Expected: PASS.

## Task 4: Dresseurs Styling and No-Friction UX

**Files:**
- Modify: `web/styles.css`
- Test: `tests/test_mobile_home_css.py`
- Test: `tests/web/trainer-contacts.test.mjs`

- [ ] **Step 1: Write failing CSS guard**

Add this test to `tests/test_mobile_home_css.py`:

```python
def test_trainer_contacts_are_optional_and_isolated() -> None:
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "web" / "styles.css").read_text(encoding="utf-8")

    assert 'href="#/dresseurs"' in html
    assert 'id="viewDresseurs"' in html
    assert "trainer-shell" in css
    assert "onboarding" not in html.split('id="viewDresseurs"', 1)[1].split("</div>", 1)[0].lower()
```

- [ ] **Step 2: Run CSS guard and verify RED**

Run: `uv run pytest tests/test_mobile_home_css.py::test_trainer_contacts_are_optional_and_isolated -q`

Expected: FAIL until the route and CSS classes exist.

- [ ] **Step 3: Add responsive styles using existing tokens**

Append to `web/styles.css`:

```css
.trainer-shell {
  display: grid;
  gap: 1rem;
  max-width: 1180px;
  margin: 0 auto;
  padding: 1rem;
}

.trainer-panel {
  background: var(--card);
  border: 1px solid var(--outline-soft);
  border-radius: 0.5rem;
  padding: 1rem;
}

.trainer-panel-head,
.trainer-actions {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
}

.trainer-card-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.trainer-card-form textarea {
  min-height: 5.5rem;
  resize: vertical;
}

.trainer-card-form textarea,
.trainer-card-form button {
  grid-column: 1 / -1;
}

.trainer-contact-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.trainer-contact-card {
  background: var(--surface-low);
  border: 1px solid var(--outline-soft);
  border-radius: 0.5rem;
  padding: 1rem;
}

.trainer-contact-card h2 {
  margin: 0 0 0.4rem;
  font-family: "Space Grotesk", Inter, sans-serif;
  font-size: 1.05rem;
}

.trainer-tags {
  color: var(--electric);
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .trainer-panel-head,
  .trainer-actions,
  .trainer-card-form {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
```

- [ ] **Step 4: Run CSS guard and web tests**

Run: `uv run pytest tests/test_mobile_home_css.py::test_trainer_contacts_are_optional_and_isolated -q`

Expected: PASS.

Run: `node --test tests/web/trainer-contacts.test.mjs`

Expected: PASS.

## Task 5: Documentation and GitHub Pages

**Files:**
- Create: `docs/TRAINER_CONTACTS.md`
- Modify: `README.md`
- Modify: `docs/features.html`
- Modify: `docs/roadmap.html`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/architecture.html`
- Modify: `tests/test_docs_site.py`

- [ ] **Step 1: Write failing docs tests**

Add to `tests/test_docs_site.py`:

```python
def test_trainer_contacts_are_documented_publicly() -> None:
    guide = DOCS / "TRAINER_CONTACTS.md"
    assert guide.is_file()

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    features = (DOCS / "features.html").read_text(encoding="utf-8")
    roadmap = (DOCS / "roadmap.html").read_text(encoding="utf-8")
    architecture = (DOCS / "architecture.html").read_text(encoding="utf-8")

    assert "Trainer Cards" in readme
    assert "data/trainer-contacts.json" in readme
    assert "/api/trainers" in readme
    assert "Trainer Cards" in features
    assert "Dresseurs" in roadmap
    assert "trainer-contacts.json" in architecture
```

- [ ] **Step 2: Run docs test and verify RED**

Run: `uv run pytest tests/test_docs_site.py::test_trainer_contacts_are_documented_publicly -q`

Expected: FAIL because the guide and doc mentions do not exist yet.

- [ ] **Step 3: Add docs content**

Create `docs/TRAINER_CONTACTS.md`:

```markdown
# Trainer Cards

Trainer Cards are optional local contact files for collectors who want to trade
or compare wishlists without creating an account.

The app stores received cards in `data/trainer-contacts.json` for the default
profile, or `data/profiles/<id>/trainer-contacts.json` for additional profiles.
The file is user state and is not versioned by Git.

Exporting a Trainer Card does not export the full collection. It only includes
the fields the user placed on their card: display name, favorite region,
favorite Pokemon, public note, optional contact link, wishlist and trade list.

There is no server sync. If a trainer updates their card, they send a new file;
Pokevault detects the stable `trainer_id` and updates the local contact when the
incoming `updated_at` is newer.
```

Update README:

- Add feature bullet: `Creates and imports optional Trainer Cards for local collector contacts.`
- Add user state bullet: `data/trainer-contacts.json`.
- Add API row: ``/api/trainers``.
- Add one privacy sentence: `Trainer Cards are separate from full backups and never sync automatically.`

Update GitHub Pages:

- `docs/features.html`: add a `Trainer Cards` feature card.
- `docs/roadmap.html`: add active v1.2-style panel for optional `Dresseurs`.
- `docs/ROADMAP.md`: add a short "Next: Dresseurs local-first" section before postponed ideas.
- `docs/architecture.html`: mention profile-scoped `trainer-contacts.json` in local JSON state.

- [ ] **Step 4: Run docs tests and verify GREEN**

Run: `uv run pytest tests/test_docs_site.py -q`

Expected: PASS.

## Task 6: Full Verification and Local Dev Server

**Files:**
- All changed files

- [ ] **Step 1: Run formatter/linter**

Run: `uv run ruff check pokedex/ tracker/ main.py tests/`

Expected: PASS.

- [ ] **Step 2: Run backend and docs tests**

Run: `uv run pytest tests/ --cov=tracker --cov-report=term-missing --cov-fail-under=100`

Expected: PASS with coverage `100%`.

- [ ] **Step 3: Run web tests**

Run: `node --test tests/web/*.test.mjs`

Expected: PASS.

- [ ] **Step 4: Smoke-test the local API**

Run: `TRACKER_HOST=127.0.0.1 TRACKER_PORT=8768 uv run python -m tracker`

Expected: server starts on `http://127.0.0.1:8768/`.

In another shell, run: `curl http://127.0.0.1:8768/api/trainers`

Expected response:

```json
{"version":1,"own_card":null,"contacts":{}}
```

- [ ] **Step 5: Leave the dev server running for review**

Keep the server session alive and report `http://127.0.0.1:8768/#/dresseurs`.

## Self-Review

- Spec coverage: local-first, optional tab, no account/server, manual import/export, stable identity update, docs/GitHub Pages and tests are covered.
- Placeholder scan: no placeholder markers or unspecified "handle errors" steps remain.
- Type consistency: `TrainerCard`, `TrainerContactBook`, `TrainerContactService`, `/api/trainers`, `trainer-contacts.json`, and `PokevaultTrainerContacts` names are consistent across tasks.
