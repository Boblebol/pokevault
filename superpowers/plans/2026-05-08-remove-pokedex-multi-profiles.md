# Remove Pokedex Multi-Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the server-side Pokedex multi-profile feature and return Pokevault to one local state under `data/`.

**Architecture:** Repositories resolve directly from `TrackerSettings` instead of going through `ProfileService`. The `/api/profiles` router, profile models, frontend profile switcher, settings card, docs, and dedicated tests disappear.

**Tech Stack:** Python 3.14, FastAPI, Pydantic v2, pytest, Ruff, vanilla JavaScript, Node built-in test runner.

---

### Task 1: Backend Routes And Dependency Wiring

**Files:**
- Modify: `tracker/api/dependencies.py`
- Modify: `tracker/api/controllers/__init__.py`
- Modify: `tracker/app.py`
- Modify: `tracker/config.py`
- Modify: `tracker/services/__init__.py`
- Delete: `tracker/api/controllers/profile_controller.py`
- Delete: `tracker/services/profile_service.py`
- Test: `tests/tracker/test_app.py`
- Test: `tests/tracker/test_dependencies.py`
- Test: `tests/tracker/test_config.py`
- Delete: `tests/tracker/test_profile_api.py`
- Delete: `tests/tracker/test_profile_service.py`

- [ ] **Step 1: Write failing route-removal test**

Add this test to `tests/tracker/test_app.py` near the removed route tests:

```python
def test_profile_routes_are_not_mounted(tmp_path: Path) -> None:
    _minimal_layout(tmp_path)
    (tmp_path / "data" / "pokedex.json").write_text("[]", encoding="utf-8")
    settings = TrackerSettings(repo_root=tmp_path)
    application = create_app(settings)
    paths = {route.path for route in application.routes}

    assert "/api/profiles" not in paths
    assert "/api/profiles/active" not in paths
    assert "/api/profiles/{profile_id}" not in paths
```

- [ ] **Step 2: Run route-removal test and verify RED**

Run: `uv run pytest tests/tracker/test_app.py::test_profile_routes_are_not_mounted -q`

Expected: FAIL because `/api/profiles` is still mounted.

- [ ] **Step 3: Remove profile router from app**

Update `tracker/api/controllers/__init__.py` so it only exports active routers:

```python
from .badge_controller import router as badge_router
from .binder_controller import router as binder_router
from .export_controller import router as export_router
from .health_controller import router as health_router
from .progress_controller import router as progress_router
from .trainer_contact_controller import router as trainer_contact_router

__all__ = [
    "badge_router",
    "binder_router",
    "export_router",
    "health_router",
    "progress_router",
    "trainer_contact_router",
]
```

Update the controller import and router includes in `tracker/app.py`:

```python
from tracker.api.controllers import (
    badge_router,
    binder_router,
    export_router,
    health_router,
    progress_router,
    trainer_contact_router,
)
```

Remove this line from `create_app`:

```python
app.include_router(profile_router)
```

- [ ] **Step 4: Wire repositories to single-state paths**

Remove `ProfileService` imports and dependencies from `tracker/api/dependencies.py`. The repository dependency functions should be:

```python
def get_progress_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> ProgressRepository:
    return JsonProgressRepository(settings.progress_path)
```

```python
def get_binder_config_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> BinderConfigRepository:
    return JsonBinderConfigRepository(settings.binder_config_path)
```

```python
def get_binder_placements_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> BinderPlacementsRepository:
    return JsonBinderPlacementsRepository(settings.binder_placements_path)
```

```python
def get_trainer_contact_repository(
    settings: Annotated[TrackerSettings, Depends(get_settings)],
) -> TrainerContactRepository:
    return JsonTrainerContactRepository(settings.trainer_contacts_path)
```

- [ ] **Step 5: Remove profile settings and service exports**

Delete `profiles_registry_path` from `tracker/config.py`.

Update `tracker/services/__init__.py`:

```python
from .badge_service import BadgeService
from .binder_config_service import BinderConfigService
from .binder_placements_service import BinderPlacementsService
from .binder_workspace_service import BinderWorkspaceService
from .progress_service import ProgressService

__all__ = [
    "BadgeService",
    "BinderConfigService",
    "BinderPlacementsService",
    "BinderWorkspaceService",
    "ProgressService",
]
```

Delete `tracker/api/controllers/profile_controller.py` and `tracker/services/profile_service.py`.

- [ ] **Step 6: Update dependency and config tests**

In `tests/tracker/test_dependencies.py`, remove `get_profile_service`, `ProfileService`, and the `_profiles` helper. Call repository factories directly:

```python
repo = get_progress_repository(settings=settings)
```

```python
cfg_repo = get_binder_config_repository(settings=settings)
pl_repo = get_binder_placements_repository(settings=settings)
```

```python
repo = get_trainer_contact_repository(settings=settings)
```

In `tests/tracker/test_config.py`, remove:

```python
assert s.profiles_registry_path == root / "data" / "profiles.json"
```

Delete `tests/tracker/test_profile_api.py` and `tests/tracker/test_profile_service.py`.

- [ ] **Step 7: Run backend tests for this task**

Run: `uv run pytest tests/tracker/test_app.py tests/tracker/test_dependencies.py tests/tracker/test_config.py -q`

Expected: PASS.

### Task 2: Backend Model Cleanup

**Files:**
- Modify: `tracker/models.py`
- Test: `tests/tracker/test_api_pkg.py`
- Test: `tests/tracker/test_imports.py`

- [ ] **Step 1: Write failing model-removal test**

Add this test to `tests/tracker/test_api_pkg.py`:

```python
def test_profile_api_models_are_removed() -> None:
    import tracker.models as models

    for name in [
        "Profile",
        "ProfileRegistry",
        "ProfileCreate",
        "ProfileSwitchBody",
        "ProfileListResponse",
        "ProfileDeleteResponse",
    ]:
        assert not hasattr(models, name)
```

- [ ] **Step 2: Run model-removal test and verify RED**

Run: `uv run pytest tests/tracker/test_api_pkg.py::test_profile_api_models_are_removed -q`

Expected: FAIL because the profile models still exist.

- [ ] **Step 3: Remove profile Pydantic models**

Delete these classes from `tracker/models.py`:

```python
class Profile(BaseModel): ...
class ProfileRegistry(BaseModel): ...
class ProfileCreate(BaseModel): ...
class ProfileSwitchBody(BaseModel): ...
class ProfileListResponse(BaseModel): ...
class ProfileDeleteResponse(BaseModel): ...
```

Update `PokemonNoteEntry` docstring from:

```python
"""Personal Pokédex note stored per Pokémon slug and profile."""
```

to:

```python
"""Personal Pokédex note stored per Pokémon slug."""
```

- [ ] **Step 4: Run backend model tests**

Run: `uv run pytest tests/tracker/test_api_pkg.py tests/tracker/test_imports.py -q`

Expected: PASS.

### Task 3: Frontend Profile Switcher Removal

**Files:**
- Modify: `web/app.js`
- Modify: `web/index.html`
- Modify: `web/i18n.js`
- Modify: `web/styles.css`
- Delete: `web/profiles.js`
- Test: `tests/test_docs_site.py`
- Test: `tests/test_mobile_home_css.py`

- [ ] **Step 1: Write failing docs/UI removal tests**

Add assertions to `tests/test_docs_site.py` that the app shell no longer loads profile switching:

```python
def test_web_app_no_longer_loads_profile_switcher() -> None:
    index = (WEB / "index.html").read_text(encoding="utf-8")
    app = (WEB / "app.js").read_text(encoding="utf-8")

    assert "/profiles.js" not in index
    assert "settingsProfileSelect" not in index
    assert "PokevaultProfiles" not in app
```

Add assertions to `tests/test_mobile_home_css.py`:

```python
def test_settings_no_longer_exposes_multi_profile_controls() -> None:
    assert "Pokédex multi-profils" not in HTML
    assert "settingsProfileCreateBtn" not in HTML
    assert "settingsProfileDeleteBtn" not in HTML
```

- [ ] **Step 2: Run frontend removal tests and verify RED**

Run: `uv run pytest tests/test_docs_site.py::test_web_app_no_longer_loads_profile_switcher tests/test_mobile_home_css.py::test_settings_no_longer_exposes_multi_profile_controls -q`

Expected: FAIL because the script and settings controls still exist.

- [ ] **Step 3: Remove settings multi-profile card and script**

Delete the "Pokédex multi-profils" card from `web/index.html`, including these controls:

```html
<select id="settingsProfileSelect" ...></select>
<input id="settingsProfileNewName" ... />
<button id="settingsProfileCreateBtn">...</button>
<button id="settingsProfileDeleteBtn">...</button>
<p id="settingsProfileHint" ...></p>
```

Delete this script tag:

```html
<script src="/profiles.js" defer></script>
```

- [ ] **Step 4: Remove profile switcher JavaScript**

Delete `setupProfileSwitcher` from `web/app.js`.

Remove this call from `setupSettingsView`:

```javascript
setupProfileSwitcher();
```

Remove fallback profile-switching i18n entries at the top of `web/app.js`:

```javascript
"app.profile.default": "{name} (défaut)",
"app.profile.label": "Profil : {name}",
"app.profile.switching": "Bascule de profil…",
"app.profile.active_reload": "Profil actif. Rechargement…",
"app.profile.name_required": "Donne un nom au nouveau profil.",
"app.profile.created": "Profil « {name} » créé.",
"app.profile.create_error": "Erreur création : {message}",
"app.profile.delete_confirm": "Supprimer le profil « {id} » ? ...",
"app.profile.deleted": "Profil « {id} » supprimé. Bascule sur défaut…",
"app.profile.delete_error": "Erreur suppression : {message}",
```

Delete `web/profiles.js`.

- [ ] **Step 5: Remove profile-switcher i18n keys and CSS**

In `web/i18n.js`, remove `app.profile.*`, `app.settings.multi_profiles`, `app.settings.multi_profiles_help`, `app.settings.active_profile`, `app.settings.active_profile_aria`, `app.settings.new_profile`, and `app.settings.new_profile_aria` in both French and English.

Remove CSS rules whose selectors are only used by the deleted controls:

```css
.profiles-actions { ... }
.profiles-name-input { ... }
.profiles-name-input:focus { ... }
```

- [ ] **Step 6: Run frontend-focused tests**

Run: `uv run pytest tests/test_docs_site.py tests/test_mobile_home_css.py -q`

Expected: PASS.

Run: `node --test tests/web/*.test.mjs`

Expected: PASS.

### Task 4: Documentation Cleanup

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/TRAINER_CONTACTS.md`
- Modify: `docs/architecture.html`
- Modify: `docs/features.html`
- Modify: `docs/install.html`
- Modify: `docs/assets/i18n.js`
- Modify: `web/index.html`
- Modify: `web/i18n.js`
- Test: `tests/test_docs_site.py`
- Test: `tests/test_repo_hygiene.py`

- [ ] **Step 1: Write failing docs removal assertions**

Update or add docs assertions so active docs no longer advertise profile state:

```python
def test_active_docs_do_not_advertise_multi_profiles() -> None:
    checked = [
        ROOT / "README.md",
        ROOT / "CONTRIBUTING.md",
        DOCS / "architecture.html",
        DOCS / "features.html",
        DOCS / "install.html",
        DOCS / "ROADMAP.md",
        WEB / "index.html",
        WEB / "i18n.js",
    ]
    joined = "\n".join(path.read_text(encoding="utf-8") for path in checked)

    forbidden = [
        "/api/profiles",
        "data/profiles/<id>",
        "data/profiles/&lt;id&gt;",
        "data/profiles/",
        "profiles.json",
        "Multi-profile Pokedex",
        "Pokédex multi-profils",
        "Local profiles with isolated progress",
        "Each profile keeps",
    ]
    for value in forbidden:
        assert value not in joined
```

- [ ] **Step 2: Run docs assertion and verify RED**

Run: `uv run pytest tests/test_docs_site.py::test_active_docs_do_not_advertise_multi_profiles -q`

Expected: FAIL because docs still mention profile-scoped state and `/api/profiles`.

- [ ] **Step 3: Update docs to single-state language**

Update `README.md` user state list to remove:

```markdown
- `data/profiles.json`
- `data/profiles/<id>/...`
```

Remove `/api/profiles` from the REST API table.

Update `CONTRIBUTING.md` ignored user state list to remove `profiles.json` and `profiles/<id>/...`.

Update `docs/architecture.html` so tracker copy names progress, binders, badges, trainer contacts, backup, and health endpoints. The workspace API list should be:

```html
<code>/api/binder</code>, <code>/api/trainers</code>, <code>/api/export</code>, <code>/api/import</code>.
```

Update `docs/features.html` and `docs/assets/i18n.js` so the local-first data feature describes one local state, not multiple profiles.

Update `docs/install.html` to remove the `data/profiles/` row.

Update `docs/ROADMAP.md` to remove completed multi-profile claims from active scope.

Update `docs/TRAINER_CONTACTS.md` to say contacts are stored in `data/trainer-contacts.json`, not profile-scoped files.

Update in-app docs in `web/index.html` and `web/i18n.js` so the section is "Sauvegardes" / "Backups", without default or additional profile bullets and without `/api/profiles`.

- [ ] **Step 4: Run docs tests**

Run: `uv run pytest tests/test_docs_site.py tests/test_repo_hygiene.py -q`

Expected: PASS.

### Task 5: Global Search, Full Verification, Commit

**Files:**
- All touched files

- [ ] **Step 1: Search for removed symbols**

Run: `rg -n "ProfileService|get_profile_service|profile_router|/api/profiles|PokevaultProfiles|settingsProfileSelect|settingsProfileCreateBtn|settingsProfileDeleteBtn|multi_profiles|data/profiles|profiles_registry_path" tracker tests web docs README.md CONTRIBUTING.md`

Expected: no active-code or active-doc hits. Historical `superpowers/` specs and plans may still mention the removed feature.

- [ ] **Step 2: Run full verification**

Run: `make check`

Expected: PASS, with Ruff clean, Python tests passing at 100% tracker coverage, and Node web tests passing.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git status --short
git add tracker tests web docs README.md CONTRIBUTING.md superpowers/plans/2026-05-08-remove-pokedex-multi-profiles.md
git commit -m "refactor: remove pokedex multi-profiles"
```

Expected: one implementation commit on `remove-pokedex-multi-profiles`.

