# Simplified Capture Trade Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace explicit hunts, match/focus flows and Trainer Card wishlists with a simpler capture, duplicate and release model while keeping badges and local-first backups.

**Architecture:** Make the backend schema the source of truth first: Trainer Cards emit only duplicate trade lists, full backups omit hunts, and `/api/hunts` leaves the active API. Then update frontend ownership helpers, card rendering and docs so the UI exposes only `Capturé`, `Double`, `Relâcher 1`, `Relâcher`, text search, badges and `Vu chez`.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest, vanilla JavaScript, Node `node:test`, existing docs/i18n files.

---

## File Map

- Modify `tracker/models.py`: remove public `wants` and `badges` from `TrainerCard`, remove active `Hunt*` models from export shape, keep permissive import of legacy `hunts`.
- Modify `tracker/services/trainer_contact_service.py`: clean only contact links and `for_trade`; ignore legacy wishlist and badge data.
- Modify `tracker/services/export_service.py`: export schema without `hunts`, ignore legacy imported hunts, return no `hunt_count`.
- Modify `tracker/api/dependencies.py`: remove hunt repository/service dependencies from active dependency graph and export service construction.
- Modify `tracker/app.py`: stop mounting `hunt_router`.
- Delete `tracker/api/controllers/hunt_controller.py`, `tracker/services/hunt_service.py`, `tracker/repository/json_hunt_repository.py`, `tests/tracker/test_hunt_api.py`, `tests/tracker/test_hunt_service.py`.
- Modify `tracker/repository/base.py`, `tracker/services/profile_service.py`, `tracker/config.py` only where hunt paths/types are referenced.
- Modify `tests/tracker/test_trainer_contact_service.py`, `tests/tracker/test_trainer_contact_api.py`, `tests/tracker/test_export.py`, `tests/tracker/test_app.py`, `tests/tracker/test_dependencies.py`, `tests/tracker/test_models.py`.
- Modify `web/pokemon-fiche.js`: expose ownership actions for captured, duplicate and release only.
- Modify `web/app.js`: remove hunt writes, wanted state, match badges, focus panels and hunt filters; keep text search and missing/caught filters.
- Modify `web/pokedex-filters.js`: remove `seen`, `shiny` and `hunts` quick-filter modes from the simplified UI filter set.
- Modify `web/trainer-contacts.js`: Trainer Cards share only `for_trade`; contacts render duplicate lists only; trade summary returns `Vu chez` context only.
- Modify `web/pokemon-full-view.js`, `web/pokemon-drawer.js` or the local drawer/full-view helpers currently rendering hunt/priority/match copy.
- Modify `web/badges-view.js`: keep gallery and unlock toasts, remove "follow badge"/mission actions.
- Modify `web/stats-view.js`: keep stats and badge gallery, remove recommendations/focus/objective sections.
- Delete `web/hunt-list.js`, `web/recommendations.js`, `web/pokedex-next-actions.js`, `web/badge-mission.js` after all callers are removed.
- Modify `web/index.html` and `web/i18n.js`: remove hunt/filter/focus/badge-mission scripts, sections and copy; update in-app docs/onboarding.
- Modify `tests/web/pokemon-fiche.test.mjs`, `tests/web/trainer-contacts.test.mjs`, `tests/web/pokemon-full-view.test.mjs`, `tests/web/pokedex-filters.test.mjs`, `tests/web/stats-view.test.mjs`, `tests/test_mobile_home_css.py`, `tests/test_docs_site.py`.
- Modify `README.md`, `docs/TRAINER_CONTACTS.md`, `docs/features.html`, `docs/assets/i18n.js`, `docs/index.html`, `docs/roadmap.html`, `docs/ROADMAP.md`, `docs/architecture.html`, `docs/POSTPONED.md` to match the simplified model.

## Task 1: Backend Trainer Cards Share Duplicates Only

**Files:**
- Modify: `tests/tracker/test_trainer_contact_service.py`
- Modify: `tests/tracker/test_trainer_contact_api.py`
- Modify: `tracker/models.py`
- Modify: `tracker/services/trainer_contact_service.py`

- [ ] **Step 1: Write failing service tests**

In `tests/tracker/test_trainer_contact_service.py`, remove `TrainerCardBadge` from the import list and replace `test_save_own_card_cleans_shared_badges` with:

```python
def test_save_own_card_ignores_legacy_wants_and_badges(tmp_path: Path) -> None:
    service = TrainerContactService(JsonTrainerContactRepository(tmp_path / "trainers.json"))
    legacy = TrainerCard.model_validate(
        {
            "schema_version": 1,
            "app": "pokevault",
            "kind": "trainer_card",
            "trainer_id": "trainer-123",
            "display_name": "Alex",
            "wants": ["0001-bulbasaur"],
            "for_trade": ["0004-charmander", "0004-charmander", ""],
            "badges": [{"id": "kanto_brock", "title": "Badge Roche"}],
            "updated_at": "2026-04-30T10:00:00+00:00",
        }
    )

    saved = service.save_own_card(legacy)
    exported = saved.model_dump()

    assert saved.for_trade == ["0004-charmander"]
    assert "wants" not in exported
    assert "badges" not in exported
```

Also update `_card()` so it no longer passes `wants`:

```python
def _card(trainer_id: str = "trainer-123", name: str = "Alex") -> TrainerCard:
    return TrainerCard(
        trainer_id=trainer_id,
        display_name=name,
        favorite_region="kanto",
        favorite_pokemon_slug="0025-pikachu",
        public_note="Local only",
        for_trade=["0004-charmander"],
        updated_at="2026-04-30T10:00:00+00:00",
    )
```

- [ ] **Step 2: Write failing API tests**

In `tests/tracker/test_trainer_contact_api.py`, keep `_payload()` sending legacy fields to prove imports are tolerant:

```python
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
        "badges": [{"id": "kanto_brock", "title": "Badge Roche"}],
        "updated_at": "2026-04-30T10:00:00+00:00",
    }
```

Replace `test_put_own_card_accepts_shared_badges` with:

```python
def test_put_own_card_drops_legacy_wishlist_and_badges(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.put("/api/trainers/me", json=_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["for_trade"] == ["0004-charmander"]
    assert "wants" not in body
    assert "badges" not in body
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```bash
uv run pytest tests/tracker/test_trainer_contact_service.py tests/tracker/test_trainer_contact_api.py -q
```

Expected: FAIL because `TrainerCard` still serializes `wants` and `badges`.

- [ ] **Step 4: Simplify `TrainerCard`**

In `tracker/models.py`, replace `TrainerCard` with this shape and delete the now-unused `TrainerCardBadge` class:

```python
class TrainerCard(BaseModel):
    """Portable local-first card shared manually between collectors."""

    model_config = ConfigDict(extra="ignore")

    schema_version: Literal[1] = 1
    app: Literal["pokevault"] = "pokevault"
    kind: Literal["trainer_card"] = "trainer_card"
    trainer_id: str = Field(min_length=8, max_length=80)
    display_name: str = Field(min_length=1, max_length=64)
    favorite_region: str = Field(default="", max_length=32)
    favorite_pokemon_slug: str = Field(default="", max_length=80)
    public_note: str = Field(default="", max_length=280)
    contact_links: list[TrainerContactLink] = Field(default_factory=list, max_length=6)
    for_trade: list[str] = Field(default_factory=list, max_length=80)
    updated_at: str
```

In `tracker/services/trainer_contact_service.py`, remove `TrainerCardBadge` imports and `_clean_badges()`, then update `_clean_card()`:

```python
return card.model_copy(
    update={
        "trainer_id": card.trainer_id.strip(),
        "display_name": card.display_name.strip(),
        "favorite_region": card.favorite_region.strip(),
        "favorite_pokemon_slug": card.favorite_pokemon_slug.strip(),
        "public_note": card.public_note.strip(),
        "contact_links": links,
        "for_trade": _clean_list(card.for_trade),
        "updated_at": _now_iso() if stamp else card.updated_at,
    },
)
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
uv run pytest tests/tracker/test_trainer_contact_service.py tests/tracker/test_trainer_contact_api.py -q
```

Expected: PASS.

Commit:

```bash
git add tracker/models.py tracker/services/trainer_contact_service.py tests/tracker/test_trainer_contact_service.py tests/tracker/test_trainer_contact_api.py
git commit -m "refactor(trainers): share duplicate lists only"
```

## Task 2: Remove Hunts From Active Backend And Backups

**Files:**
- Modify: `tests/tracker/test_export.py`
- Modify: `tests/tracker/test_app.py`
- Modify: `tests/tracker/test_dependencies.py`
- Modify: `tests/tracker/test_models.py`
- Modify: `tracker/models.py`
- Modify: `tracker/services/export_service.py`
- Modify: `tracker/api/dependencies.py`
- Modify: `tracker/app.py`
- Modify: `tracker/repository/base.py`
- Modify: `tracker/services/profile_service.py`
- Delete: `tracker/api/controllers/hunt_controller.py`
- Delete: `tracker/services/hunt_service.py`
- Delete: `tracker/repository/json_hunt_repository.py`
- Delete: `tests/tracker/test_hunt_api.py`
- Delete: `tests/tracker/test_hunt_service.py`

- [ ] **Step 1: Write failing export tests**

In `tests/tracker/test_export.py`, update `_setup()` so it stops creating a `JsonHuntRepository` and builds `ExportService` without `hunt_repo`.

Change `test_export_empty_collection()`:

```python
def test_export_empty_collection(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    r = client.get("/api/export")
    assert r.status_code == 200
    data = r.json()
    assert data["schema_version"] == 4
    assert data["app"] == "pokevault"
    assert "exported_at" in data
    assert data["progress"]["caught"] == {}
    assert data["binder_config"]["binders"] == []
    assert data["binder_placements"]["by_binder"] == {}
    assert data["cards"] == []
    assert "hunts" not in data
```

Replace `test_export_import_roundtrips_hunts()` with:

```python
def test_import_accepts_legacy_hunts_and_drops_them_on_export(tmp_path: Path) -> None:
    client = _setup(tmp_path)
    payload = {
        "schema_version": 3,
        "progress": {"version": 1, "caught": {"pikachu": True}},
        "binder_config": {
            "version": 1,
            "convention": "sheet_recto_verso",
            "binders": [],
            "form_rules": [],
        },
        "binder_placements": {"version": 1, "by_binder": {}},
        "cards": [],
        "hunts": {
            "version": 1,
            "hunts": {
                "0025-pikachu": {
                    "wanted": True,
                    "priority": "high",
                    "note": "Holo FR",
                    "updated_at": "2026-04-26T12:00:00+00:00",
                }
            },
        },
    }

    r = client.post("/api/import", json=payload)

    assert r.status_code == 200
    assert r.json()["caught_count"] == 1
    exported = client.get("/api/export").json()
    assert exported["schema_version"] == 4
    assert "hunts" not in exported
```

- [ ] **Step 2: Write failing route test**

In `tests/tracker/test_app.py`, add:

```python
def test_hunts_route_is_not_mounted(tmp_path: Path, monkeypatch) -> None:
    from tracker.app import create_app
    from tracker.config import TrackerSettings

    data = tmp_path / "data"
    web = tmp_path / "web"
    data.mkdir()
    web.mkdir()
    (web / "index.html").write_text("<h1>ok</h1>", encoding="utf-8")
    (data / "pokedex.json").write_text("[]", encoding="utf-8")

    app = create_app(TrackerSettings(data_dir=data, web_dir=web))
    paths = {route.path for route in app.routes}

    assert "/api/hunts" not in paths
    assert "/api/hunts/{slug}" not in paths
```

- [ ] **Step 3: Run focused backend tests and confirm RED**

Run:

```bash
uv run pytest tests/tracker/test_export.py tests/tracker/test_app.py -q
```

Expected: FAIL because exports still include `hunts` and the route is mounted.

- [ ] **Step 4: Update models and export service**

In `tracker/models.py`, remove `HuntPriority`, `HuntEntry`, `HuntList`, and `HuntPatch`. Replace `ExportPayload`, `ImportPayload`, and `ImportResponse` with:

```python
class ExportPayload(BaseModel):
    """Full collection export without legacy hunts."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[4] = 4
    app: str = "pokevault"
    exported_at: str
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload
    cards: list[Card] = Field(default_factory=list)


class ImportPayload(BaseModel):
    """Incoming import accepts legacy hunt-bearing backups and ignores hunts."""

    model_config = ConfigDict(extra="ignore")

    schema_version: Literal[1, 2, 3, 4]
    app: str | None = None
    exported_at: str | None = None
    progress: CollectionProgress
    binder_config: BinderConfigPayload
    binder_placements: BinderPlacementsPayload
    cards: list[Card] = Field(default_factory=list)


class ImportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    caught_count: int = Field(ge=0)
    binder_count: int = Field(ge=0)
    card_count: int = Field(default=0, ge=0)
```

In `tracker/services/export_service.py`, remove `HuntList`, `HuntRepository`, `_hunts`, `_sanitize_hunts` use, and all hunt load/save/count code. `export_all()` returns:

```python
return ExportPayload(
    exported_at=datetime.now(UTC).isoformat(),
    progress=progress,
    binder_config=cfg,
    binder_placements=placements,
    cards=list(cards.cards),
)
```

`import_all()` ends with:

```python
return ImportResponse(
    caught_count=len(progress.caught),
    binder_count=len(config.binders),
    card_count=card_count,
)
```

- [ ] **Step 5: Remove active hunt wiring**

In `tracker/app.py`, remove `hunt_router` from the controller import and remove:

```python
app.include_router(hunt_router)
```

In `tracker/api/dependencies.py`, remove `HuntRepository`, `JsonHuntRepository`, `HuntService`, `get_hunt_repository()`, `get_hunt_service()`, and the `hunt_repo` parameter passed into `ExportService`.

In `tracker/repository/base.py`, delete the `HuntRepository` protocol. In `tracker/services/profile_service.py`, delete `hunts_path()` and any call sites. Delete the hunt controller, repository, service and tests listed in this task.

- [ ] **Step 6: Run backend tests and commit**

Run:

```bash
uv run pytest tests/tracker/test_export.py tests/tracker/test_app.py tests/tracker/test_dependencies.py tests/tracker/test_models.py -q
```

Expected: PASS.

Commit:

```bash
git add tracker tests/tracker
git commit -m "refactor(api): drop active hunt workflow"
```

## Task 3: Simplify Ownership Actions And Release Semantics

**Files:**
- Modify: `tests/web/pokemon-fiche.test.mjs`
- Modify: `tests/web/app-ownership.test.mjs` or create it if no focused app ownership test exists.
- Modify: `web/pokemon-fiche.js`
- Modify: `web/app.js`
- Modify: `web/i18n.js`

- [ ] **Step 1: Write failing fiche helper tests**

In `tests/web/pokemon-fiche.test.mjs`, replace the compact trade action tests with:

```js
test("buildOwnershipActionModel exposes capture duplicate and release actions", async () => {
  const api = await loadModule();

  const empty = api.buildOwnershipActionModel({ caught: false, duplicate: false });
  assert.deepEqual(empty.map((action) => action.id), ["owned", "duplicate", "release_one", "release"]);
  assert.deepEqual(empty.map((action) => action.label), ["Capturé", "Double", "Relâcher 1", "Relâcher"]);
  assert.deepEqual(empty.map((action) => action.disabled), [false, false, true, true]);

  const owned = api.buildOwnershipActionModel({ caught: true, duplicate: false });
  assert.deepEqual(owned.map((action) => action.active), [true, false, false, false]);
  assert.deepEqual(owned.map((action) => action.disabled), [false, false, true, false]);

  const duplicate = api.buildOwnershipActionModel({ caught: true, duplicate: true });
  assert.deepEqual(duplicate.map((action) => action.active), [false, true, false, false]);
  assert.deepEqual(duplicate.map((action) => action.disabled), [false, false, false, false]);
});

test("ownershipPatchForAction maps release one and release all", async () => {
  const api = await loadModule();

  assert.equal(api.ownershipPatchForAction({ caught: false, duplicate: false }, "owned"), "owned");
  assert.equal(api.ownershipPatchForAction({ caught: false, duplicate: false }, "duplicate"), "duplicate");
  assert.equal(api.ownershipPatchForAction({ caught: true, duplicate: true }, "release_one"), "owned");
  assert.equal(api.ownershipPatchForAction({ caught: true, duplicate: true }, "release"), "none");
  assert.equal(api.ownershipPatchForAction({ caught: true, duplicate: false }, "release"), "none");
  assert.equal(api.ownershipPatchForAction({ caught: false, duplicate: false }, "release"), null);
});
```

Update the source-derived ownership test:

```js
test("ownershipStateFromSources derives duplicate from local Trainer Card only", async () => {
  const api = await loadModule();

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "not_met", shiny: false },
      ownCard: { for_trade: [] },
    }),
    { caught: false, duplicate: false },
  );

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "caught", shiny: false },
      ownCard: { for_trade: [] },
    }),
    { caught: true, duplicate: false },
  );

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "not_met", shiny: false },
      ownCard: { for_trade: ["0130-gyarados"] },
    }),
    { caught: true, duplicate: true },
  );
});
```

- [ ] **Step 2: Run fiche tests and confirm RED**

Run:

```bash
node --test tests/web/pokemon-fiche.test.mjs
```

Expected: FAIL because `wanted` still exists and release actions do not.

- [ ] **Step 3: Update `web/pokemon-fiche.js`**

Replace `OWNERSHIP_ACTIONS`:

```js
const OWNERSHIP_ACTIONS = [
  { id: "owned", labelKey: "pokemon_fiche.ownership.owned" },
  { id: "duplicate", labelKey: "pokemon_fiche.ownership.duplicate" },
  { id: "release_one", labelKey: "pokemon_fiche.ownership.release_one" },
  { id: "release", labelKey: "pokemon_fiche.ownership.release" },
];
```

Replace `normalizeOwnershipState()`, `ownershipLabel()`, `buildOwnershipActionModel()`, `ownershipPatchForAction()` and `ownershipStateFromSources()` with:

```js
function normalizeOwnershipState(state) {
  const duplicate = Boolean(state?.duplicate);
  return {
    caught: duplicate || Boolean(state?.caught),
    duplicate,
  };
}

function ownershipLabel(state) {
  const clean = normalizeOwnershipState(state);
  if (clean.duplicate) return t("pokemon_fiche.ownership.duplicate");
  if (clean.caught) return t("pokemon_fiche.ownership.owned");
  return t("pokemon_fiche.ownership.none");
}

function buildOwnershipActionModel(state) {
  const clean = normalizeOwnershipState(state);
  return OWNERSHIP_ACTIONS.map((action) => ({
    ...action,
    label: t(action.labelKey),
    active: action.id === "duplicate" ? clean.duplicate : action.id === "owned" && clean.caught && !clean.duplicate,
    disabled: action.id === "release_one" ? !clean.duplicate : action.id === "release" ? !clean.caught : false,
  }));
}

function ownershipPatchForAction(state, actionId) {
  const clean = normalizeOwnershipState(state);
  if (actionId === "owned") return "owned";
  if (actionId === "duplicate") return "duplicate";
  if (actionId === "release_one") return clean.duplicate ? "owned" : null;
  if (actionId === "release") return clean.caught ? "none" : null;
  return null;
}

function ownershipStateFromSources(slug, options = {}) {
  const key = String(slug || "").trim();
  const status = normalizeStatus(options.status);
  const ownCard = options.ownCard && typeof options.ownCard === "object" ? options.ownCard : {};
  const duplicate = listIncludesSlug(ownCard.for_trade, key);
  return {
    caught: duplicate || status.state === "caught",
    duplicate,
  };
}
```

Update fallback i18n keys in `web/pokemon-fiche.js` and runtime keys in `web/i18n.js`:

```js
"pokemon_fiche.ownership.owned": "Capturé",
"pokemon_fiche.ownership.duplicate": "Double",
"pokemon_fiche.ownership.release_one": "Relâcher 1",
"pokemon_fiche.ownership.release": "Relâcher",
"pokemon_fiche.ownership.none": "Je n'ai pas",
```

- [ ] **Step 4: Update `web/app.js` ownership writes**

Remove `setHuntWanted()`, stop passing `wanted` to `ownershipStateFromSources()`, and replace `setPokemonOwnershipState()` body with:

```js
async function setPokemonOwnershipState(slug, nextState) {
  const key = String(slug || "").trim();
  if (!key) return;
  const next = nextState === "owned" || nextState === "duplicate" ? nextState : "none";
  const current = getStatus(key);
  const tasks = [];

  if (next === "owned") {
    setStatus(key, "caught", current.shiny);
    tasks.push(setTrainerListMembership(key, "for_trade", false));
  } else if (next === "duplicate") {
    setStatus(key, "caught", current.shiny);
    tasks.push(setTrainerListMembership(key, "for_trade", true));
  } else {
    setStatus(key, "not_met", false);
    tasks.push(setTrainerListMembership(key, "for_trade", false));
  }

  try {
    await Promise.all(tasks);
  } catch (err) {
    console.error("ownership update failed", err);
    showOwnershipSyncError(err);
  } finally {
    resetDisplayedCount();
    render();
  }
}
```

Update `cycleOwnershipBySlug()`:

```js
const next = shift
  ? current.duplicate ? "owned" : "duplicate"
  : current.caught ? "none" : "owned";
```

- [ ] **Step 5: Run web ownership tests and commit**

Run:

```bash
node --test tests/web/pokemon-fiche.test.mjs tests/web/app-ownership.test.mjs
```

Expected: PASS.

Commit:

```bash
git add web/pokemon-fiche.js web/app.js web/i18n.js tests/web/pokemon-fiche.test.mjs tests/web/app-ownership.test.mjs
git commit -m "feat(web): simplify capture ownership actions"
```

## Task 4: Trainer Contacts And `Vu Chez` Only

**Files:**
- Modify: `tests/web/trainer-contacts.test.mjs`
- Modify: `tests/web/pokemon-full-view.test.mjs`
- Modify: `web/trainer-contacts.js`
- Modify: `web/app.js`
- Modify: `web/pokemon-full-view.js`
- Modify: `web/i18n.js`

- [ ] **Step 1: Write failing trainer contact tests**

In `tests/web/trainer-contacts.test.mjs`, remove badge rendering tests and replace wishlist/match assertions with:

```js
test("cardFromForm exports duplicate trade list only", async () => {
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
    wants: "0001-bulbasaur",
    for_trade: "0007-squirtle\n0007-squirtle",
  });

  assert.equal(card.display_name, "Alex");
  assert.deepEqual(card.for_trade, ["0007-squirtle"]);
  assert.equal("wants" in card, false);
  assert.equal("badges" in card, false);
});

test("renderContact exposes duplicates but no wishlist or badges", async () => {
  const api = await loadModule();
  const article = api.renderContact({
    card: {
      trainer_id: "misty-123",
      display_name: "Misty",
      wants: ["0054-psyduck"],
      badges: [{ id: "kanto_brock", title: "Badge Roche" }],
      for_trade: ["0118-goldeen"],
      updated_at: "2026-04-30T10:00:00+00:00",
    },
    private_note: "Bring sleeves",
    first_received_at: "2026-04-30T11:00:00+00:00",
    last_received_at: "2026-04-30T11:00:00+00:00",
  });

  assert.doesNotMatch(article.innerHTML, /Cherche|Wants|Badge Roche|Badges/);
  assert.match(article.innerHTML, /Double|For trade|Echange/);
  assert.match(article.innerHTML, /0118-goldeen/);
  assert.match(article.innerHTML, /Bring sleeves/);
});
```

Replace the trade summary test:

```js
test("tradeSummary exposes only available duplicate trainers", async () => {
  const api = await loadModule();
  const book = api.normalizeBook({
    own_card: {
      trainer_id: "trainer-me",
      display_name: "Me",
      for_trade: ["0001-bulbasaur"],
      updated_at: "2026-04-30T10:00:00+00:00",
    },
    contacts: {
      misty: {
        card: {
          trainer_id: "misty",
          display_name: "Misty",
          wants: ["0001-bulbasaur"],
          for_trade: ["0130-gyarados"],
          updated_at: "2026-04-30T10:00:00+00:00",
        },
        first_received_at: "2026-04-30T11:00:00+00:00",
        last_received_at: "2026-04-30T11:00:00+00:00",
      },
    },
  });

  assert.deepEqual(api.contactsTrading(book, "0130-gyarados").map((c) => c.card.display_name), ["Misty"]);
  assert.deepEqual(api.tradeSummary(book, "0130-gyarados"), {
    availableFrom: ["Misty"],
    wantedBy: [],
    matchCount: 0,
    canHelpCount: 0,
  });
});
```

- [ ] **Step 2: Run contact tests and confirm RED**

Run:

```bash
node --test tests/web/trainer-contacts.test.mjs tests/web/pokemon-full-view.test.mjs
```

Expected: FAIL because wishlist, badge and match rendering still exist.

- [ ] **Step 3: Simplify `web/trainer-contacts.js`**

Update `normalizeCard()` to return no `wants` or `badges`:

```js
return {
  schema_version: 1,
  app: "pokevault",
  kind: "trainer_card",
  trainer_id: String(raw.trainer_id || "").trim(),
  display_name: String(raw.display_name || "").trim(),
  favorite_region: String(raw.favorite_region || "").trim(),
  favorite_pokemon_slug: String(raw.favorite_pokemon_slug || "").trim(),
  public_note: String(raw.public_note || "").trim(),
  contact_links: normalizeContactLinks(raw.contact_links),
  for_trade: normalizeList(raw.for_trade),
  updated_at: String(raw.updated_at || new Date().toISOString()),
};
```

Update `cardFromForm()` so it ignores `values.wants` and sets only:

```js
for_trade: splitLines(values.for_trade),
```

Update `updateCardListMembership()` so only `for_trade` is accepted:

```js
function updateCardListMembership(card, listName, slug, enabled) {
  if (listName !== "for_trade") return normalizeCard(card);
  const clean = normalizeCard(card);
  const key = String(slug || "").trim();
  if (!key) return clean;
  const set = new Set(clean.for_trade);
  if (enabled) set.add(key);
  else set.delete(key);
  return { ...clean, for_trade: [...set] };
}
```

Remove rendered wishlist and badge blocks. Keep one list section for `for_trade`, labelled with the existing trade label or the new `trainers.duplicates`.

- [ ] **Step 4: Suppress Match And local-owned `Vu chez`**

In `web/app.js`, render `Vu chez` only when local ownership is missing:

```js
const ownership = ownershipStateForSlug(slug);
const trade = ownership.caught ? emptyTradeSummary() : tradeSummaryForSlug(slug);
```

Remove code that renders `app.card.match_badge` and any `matchCount` badge. In `web/pokemon-full-view.js`, remove `pokemon_full.exchange.match` and `pokemon_full.exchange.wanted_by`; only render:

```js
if (summary.availableFrom.length) {
  line.textContent = t("pokemon_full.exchange.seen", { names: formatNameList(summary.availableFrom) });
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
node --test tests/web/trainer-contacts.test.mjs tests/web/pokemon-full-view.test.mjs
```

Expected: PASS.

Commit:

```bash
git add web/trainer-contacts.js web/app.js web/pokemon-full-view.js web/i18n.js tests/web/trainer-contacts.test.mjs tests/web/pokemon-full-view.test.mjs
git commit -m "refactor(web): show trainer duplicates only"
```

## Task 5: Remove Hunts, Focus And Recommendation UI

**Files:**
- Modify: `tests/web/pokedex-filters.test.mjs`
- Modify: `tests/web/stats-view.test.mjs`
- Modify: `tests/test_mobile_home_css.py`
- Modify: `web/pokedex-filters.js`
- Modify: `web/app.js`
- Modify: `web/stats-view.js`
- Modify: `web/index.html`
- Modify: `web/i18n.js`
- Delete: `web/hunt-list.js`
- Delete: `web/recommendations.js`
- Delete: `web/pokedex-next-actions.js`

- [ ] **Step 1: Write failing filter and page-shell tests**

In `tests/web/pokedex-filters.test.mjs`, assert simplified status filters:

```js
test("normalizeFilterState accepts only simplified status filters", async () => {
  const api = await loadFilters();

  assert.equal(api.normalizeFilterState({ status: "all" }).status, "all");
  assert.equal(api.normalizeFilterState({ status: "missing" }).status, "missing");
  assert.equal(api.normalizeFilterState({ status: "caught" }).status, "caught");
  assert.equal(api.normalizeFilterState({ status: "hunts" }).status, "all");
  assert.equal(api.normalizeFilterState({ status: "seen" }).status, "all");
  assert.equal(api.normalizeFilterState({ status: "shiny" }).status, "all");
});
```

In `tests/test_mobile_home_css.py`, update the relevant app-shell test:

```python
def test_simplified_collection_shell_has_no_focus_or_hunt_copy() -> None:
    html = HTML
    forbidden = [
        "pokedexNextActions",
        "badgeMissionPanel",
        "hunt-list.js",
        "recommendations.js",
        "pokedex-next-actions.js",
        "app.filters.hunts",
        "Cherche",
        "Match",
    ]
    for text in forbidden:
        assert text not in html
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
node --test tests/web/pokedex-filters.test.mjs tests/web/stats-view.test.mjs
uv run pytest tests/test_mobile_home_css.py -q
```

Expected: FAIL because hunt/focus/recommendation UI still exists.

- [ ] **Step 3: Update filters and app rendering**

In `web/pokedex-filters.js`, replace:

```js
const STATUS_FILTERS = new Set(["all", "missing", "seen", "caught", "shiny", "hunts"]);
```

with:

```js
const STATUS_FILTERS = new Set(["all", "missing", "caught"]);
```

In `web/app.js`, remove `filterMode === "seen"`, `filterMode === "shiny"`, and `filterMode === "hunts"` branches from `matchesFilter()`. Remove all `PokevaultHunts`, `PokevaultRecommendations`, `PokevaultNextActions`, and `PokevaultBadgeMission` subscriptions and render calls.

- [ ] **Step 4: Remove script tags and DOM sections**

In `web/index.html`, remove the next-action and badge-mission sections, quick filter buttons for `Cherche`, `Vus`, and `Shiny`, and script tags:

```html
<script src="/badge-mission.js" defer></script>
<script src="/recommendations.js" defer></script>
<script src="/pokedex-next-actions.js" defer></script>
<script src="/hunt-list.js" defer></script>
```

Update in-app docs/onboarding strings to describe `Capturé`, `Double`, `Relâcher 1`, `Relâcher`, text search, badges in Stats and `Vu chez`.

- [ ] **Step 5: Delete obsolete frontend modules**

Delete:

```text
web/hunt-list.js
web/recommendations.js
web/pokedex-next-actions.js
```

Update or delete their tests in the same commit:

```text
tests/web/hunt-list.test.mjs
tests/web/pokedex-next-actions.test.mjs
```

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
node --test tests/web/pokedex-filters.test.mjs tests/web/stats-view.test.mjs
uv run pytest tests/test_mobile_home_css.py -q
```

Expected: PASS.

Commit:

```bash
git add web tests/web tests/test_mobile_home_css.py
git commit -m "refactor(web): remove hunt and focus surfaces"
```

## Task 6: Keep Badges, Remove Badge Missions

**Files:**
- Modify: `tests/tracker/test_badge_service.py`
- Modify: `tests/tracker/test_badge_api.py`
- Modify: `tests/web/badges-view.test.mjs`
- Modify: `tracker/services/badge_service.py`
- Modify: `web/badges-view.js`
- Delete: `web/badge-mission.js`
- Delete or update: `tests/web/badge-mission.test.mjs`

- [ ] **Step 1: Write failing badge behavior tests**

In `tests/tracker/test_badge_service.py`, replace the first encounter test:

```python
def test_first_encounter_badge_is_not_in_simplified_catalog(tmp_path: Path) -> None:
    badge_service, *_ = _wire(tmp_path)

    ids = {badge.id for badge in badge_service.state().catalog}

    assert "first_encounter" not in ids
    assert "first_catch" in ids
```

In `tests/web/badges-view.test.mjs`, add:

```js
test("badge detail does not expose mission follow action", async () => {
  const api = await loadModule();
  const detail = api.buildBadgeDetail({
    id: "kanto_brock",
    title: "Badge Roche",
    description: "Capture team.",
    unlocked: false,
    current: 1,
    target: 2,
    percent: 50,
    requirements: [{ slug: "0074-geodude", caught: true }],
  });

  assert.doesNotMatch(detail.innerHTML || textTree(detail), /Suivre ce badge|Mission active|Follow/);
});
```

- [ ] **Step 2: Run badge tests and confirm RED**

Run:

```bash
uv run pytest tests/tracker/test_badge_service.py tests/tracker/test_badge_api.py -q
node --test tests/web/badges-view.test.mjs
```

Expected: FAIL because `first_encounter` and follow actions still exist.

- [ ] **Step 3: Update backend badge catalog**

In `tracker/services/badge_service.py`, remove the `seen` metric support and the `first_encounter` badge definition. Keep `first_catch`, `first_shiny`, card badges and team badges intact.

Remove:

```python
def _seen_count(progress: CollectionProgress) -> int:
    ...
```

and the branch:

```python
if metric == "seen":
    return _seen_count(progress)
```

Delete the `_milestone_badge(...)` entry with id `"first_encounter"`.

- [ ] **Step 4: Update frontend badge gallery**

In `web/badges-view.js`, remove mission follow copy keys and delete the action block that creates:

```js
follow.className = "badge-detail__mission-btn";
```

Delete `web/badge-mission.js` and its test. Remove any remaining `PokevaultBadgeMission` references from `web/app.js`, `web/index.html`, and styles that are used only by the mission panel.

- [ ] **Step 5: Run badge tests and commit**

Run:

```bash
uv run pytest tests/tracker/test_badge_service.py tests/tracker/test_badge_api.py -q
node --test tests/web/badges-view.test.mjs
```

Expected: PASS.

Commit:

```bash
git add tracker/services/badge_service.py tests/tracker/test_badge_service.py tests/tracker/test_badge_api.py web/badges-view.js web/app.js web/index.html web/styles.css tests/web
git commit -m "refactor(badges): keep gallery without missions"
```

## Task 7: Documentation And Legacy Migration Copy

**Files:**
- Modify: `README.md`
- Modify: `docs/TRAINER_CONTACTS.md`
- Modify: `docs/features.html`
- Modify: `docs/assets/i18n.js`
- Modify: `docs/index.html`
- Modify: `docs/roadmap.html`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/architecture.html`
- Modify: `docs/POSTPONED.md`
- Modify: `tests/test_docs_site.py`

- [ ] **Step 1: Keep public docs aligned**

Ensure these strings are present in the public docs:

```text
Capturé
Double
Relâcher 1
Relâcher
Vu chez
Trainer Cards share only `Double` entries
Older installs may still have `data/hunts.json`
```

Ensure these strings are absent from active public docs except legacy notes and tests:

```text
Cherche
Wanted
/api/hunts
Badge missions
automatically shared unlocked badges
```

- [ ] **Step 2: Run docs tests**

Run:

```bash
uv run pytest tests/test_docs_site.py -q
```

Expected: PASS.

- [ ] **Step 3: Commit docs**

Commit:

```bash
git add README.md docs tests/test_docs_site.py
git commit -m "docs: document simplified capture trade model"
```

## Task 8: Full Verification And Cleanup

**Files:**
- Modify only files required by failed verification.

- [ ] **Step 1: Static search for removed concepts**

Run:

```bash
rg -n "PokevaultHunts|/api/hunts|hunt-list|PokevaultRecommendations|pokedexNextActions|PokevaultBadgeMission|badgeMissionPanel|app.filters.hunts|app.card.match_badge|pokemon_full.exchange.match|trainers.want" tracker web tests README.md docs
```

Expected: no active-code matches. Matches in historical `superpowers/specs` or `superpowers/plans` are acceptable because they are archived implementation history.

- [ ] **Step 2: Run focused backend verification**

Run:

```bash
uv run pytest tests/tracker/test_export.py tests/tracker/test_trainer_contact_service.py tests/tracker/test_trainer_contact_api.py tests/tracker/test_badge_service.py tests/tracker/test_badge_api.py tests/tracker/test_app.py tests/tracker/test_dependencies.py tests/tracker/test_models.py -q
```

Expected: PASS.

- [ ] **Step 3: Run focused frontend verification**

Run:

```bash
node --test tests/web/pokemon-fiche.test.mjs tests/web/trainer-contacts.test.mjs tests/web/pokemon-full-view.test.mjs tests/web/pokedex-filters.test.mjs tests/web/stats-view.test.mjs tests/web/badges-view.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Run docs and mobile shell verification**

Run:

```bash
uv run pytest tests/test_docs_site.py tests/test_mobile_home_css.py -q
```

Expected: PASS.

- [ ] **Step 5: Run full project check**

Run:

```bash
make check
```

Expected: PASS with tracker coverage still at 100%.

- [ ] **Step 6: Final commit if verification changed files**

If verification required follow-up edits, commit them:

```bash
git add tracker web tests README.md docs
git commit -m "test: verify simplified capture trade model"
```

If no files changed after verification, do not create an empty commit.
