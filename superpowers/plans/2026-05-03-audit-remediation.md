# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Resolve the audit findings around local data exposure, backup restore, QA gates, local-first claims, and documentation accuracy.

**Architecture:** Keep the local-first app shape: FastAPI serves a vanilla web UI and a small whitelist of public reference assets. User JSON state stays reachable only through typed API endpoints. Tests are added before behavior changes.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest, ruff, vanilla JavaScript, Node native test runner, Docker Compose.

**Status:** Completed on 2026-05-03. Verification: `make check` and `git diff --check`.

---

## Workstreams

### Task 1: Protect User State Under `data/`

**Files:**
- Modify: `tracker/app.py`
- Modify: `tests/tracker/test_app.py`
- Modify: `docker-compose.yml`
- Optional docs: `README.md`, `SECURITY.md`

- [x] **Step 1: Write failing tests**

Add tests proving that public reference files still work and user-state JSON files are not served by static routes:

```python
def test_data_static_mount_does_not_expose_user_state(tmp_path: Path) -> None:
    _minimal_layout(tmp_path)
    data = tmp_path / "data"
    (data / "pokedex.json").write_text('{"pokemon":[]}', encoding="utf-8")
    (data / "narrative-tags.json").write_text('{"tags":[]}', encoding="utf-8")
    (data / "collection-progress.json").write_text('{"caught":{"secret":true}}', encoding="utf-8")
    (data / "trainer-contacts.json").write_text('{"contacts":{"secret":{}}}', encoding="utf-8")

    app = create_app(TrackerSettings(repo_root=tmp_path))
    client = TestClient(app)

    assert client.get("/data/pokedex.json").status_code == 200
    assert client.get("/data/narrative-tags.json").status_code == 200
    assert client.get("/data/collection-progress.json").status_code == 404
    assert client.get("/data/trainer-contacts.json").status_code == 404
```

- [x] **Step 2: Run the focused test**

Run:

```bash
uv run pytest tests/tracker/test_app.py::test_data_static_mount_does_not_expose_user_state -q
```

Expected: FAIL because `StaticFiles(directory=data_dir)` currently serves all files.

- [x] **Step 3: Implement a whitelist**

Replace the broad `/data` static mount with explicit routes for:

- `/data/pokedex.json`
- `/data/narrative-tags.json`
- `/data/evolution-families.json`
- `/data/evolution-family-overrides.json`
- `/data/images/{path}`
- `/data/images_shiny/{path}` if the directory exists

Do not serve `collection-progress.json`, `collection-cards.json`, `hunts.json`, `binder-*.json`, `trainer-contacts.json`, `profiles.json` or `profiles/<id>/...`.

- [x] **Step 4: Harden Docker localhost binding**

Change Compose port mapping to:

```yaml
ports:
  - "127.0.0.1:8765:8765"
```

Keep `TRACKER_HOST=0.0.0.0` inside the container so Uvicorn remains reachable from Docker’s port forward.

- [x] **Step 5: Run focused and full backend checks**

Run:

```bash
uv run pytest tests/tracker/test_app.py -q
uv run pytest tests/ --cov=tracker --cov-report=term-missing --cov-fail-under=100
```

Expected: all pass, tracker coverage stays 100%.

### Task 2: Fix UI Backup Import for Schema v3

**Files:**
- Modify: `web/app.js`
- Add or modify: `tests/web/app-ownership.test.mjs` or a new focused web test file

- [x] **Step 1: Expose testable helpers**

Add a small test-only helper surface for backup validation if needed, without changing runtime behavior:

```javascript
function isSupportedBackupSchemaVersion(value) {
  return value === 1 || value === 2 || value === 3;
}
```

- [x] **Step 2: Write failing JS test**

Add a Node test proving schema v3 is accepted because `/api/export` emits v3:

```javascript
test("backup import accepts schema versions emitted by the backend", async () => {
  const api = await loadAppTestApi();
  assert.equal(api.isSupportedBackupSchemaVersion(1), true);
  assert.equal(api.isSupportedBackupSchemaVersion(2), true);
  assert.equal(api.isSupportedBackupSchemaVersion(3), true);
  assert.equal(api.isSupportedBackupSchemaVersion(99), false);
});
```

- [x] **Step 3: Run the focused JS test**

Run:

```bash
node --test tests/web/app-ownership.test.mjs
```

Expected: FAIL before implementation or before helper export.

- [x] **Step 4: Implement import guard**

Replace:

```javascript
if (data.schema_version !== 1) throw new Error(t("app.import.unsupported"));
```

with:

```javascript
if (!isSupportedBackupSchemaVersion(data.schema_version)) {
  throw new Error(t("app.import.unsupported"));
}
```

- [x] **Step 5: Run web tests**

Run:

```bash
node --test tests/web/*.test.mjs
```

Expected: all pass.

### Task 3: Put Web Tests Into the Default QA Gate and Fix Docs Drift

**Files:**
- Modify: `Makefile`
- Modify: `CONTRIBUTING.md`
- Modify: `README.md`
- Modify: `tests/test_repo_hygiene.py`
- Modify: `tests/test_docs_site.py` if docs expectations need updates

- [x] **Step 1: Write failing hygiene test**

Add assertions that `make check` includes the web test target and that docs mention `uv`, not `pip`, for Dependabot.

- [x] **Step 2: Run focused hygiene tests**

Run:

```bash
uv run pytest tests/test_repo_hygiene.py -q
```

Expected: FAIL until `Makefile` and docs are updated.

- [x] **Step 3: Update Makefile**

Add:

```make
.PHONY: web-test

web-test: ## Lancer les tests web vanilla Node
	node --test tests/web/*.test.mjs

check: lint test-cov web-test ## Executer lint + tests couverture + tests web
```

- [x] **Step 4: Update docs drift**

Update README data model to list all versioned reference data:

- `data/pokedex.json`
- `data/narrative-tags.json`
- `data/evolution-families.json`
- `data/evolution-family-overrides.json`

Update `CONTRIBUTING.md` Dependabot wording from `pip / docker / github-actions` to `uv / docker / github-actions`.

- [x] **Step 5: Run checks**

Run:

```bash
uv run pytest tests/test_repo_hygiene.py tests/test_docs_site.py -q
make check
```

Expected: all pass, including Node web tests through `make check`.

### Task 4: Align Local-First Marketing With Runtime Assets

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `README.md`
- Modify: `docs/index.html`
- Modify: `tests/test_docs_site.py`

- [x] **Step 1: Decide asset policy**

Preferred policy: no third-party browser requests on the local app. Remove Google Fonts links and rely on local/system font stacks unless local font files are added explicitly.

- [x] **Step 2: Write a failing docs/site test**

Add a test that rejects `fonts.googleapis.com` in `web/index.html`.

- [x] **Step 3: Run focused test**

Run:

```bash
uv run pytest tests/test_docs_site.py::test_web_app_has_no_third_party_font_requests -q
```

Expected: FAIL until links are removed or replaced.

- [x] **Step 4: Remove remote font requests**

Remove the Google Fonts stylesheet links from `web/index.html`. Keep CSS font stacks functional with system fallbacks. For Material Symbols, either self-host the font files or keep the current dependency documented as an explicit exception; do not silently claim zero external browser requests if the icon font stays remote.

- [x] **Step 5: Update marketing copy**

If any external runtime request remains, update README and docs to say “no account, no hosted database; optional public catalog and asset requests may happen for TCG lookup/artwork/font surfaces.”

- [x] **Step 6: Run tests**

Run:

```bash
uv run pytest tests/test_docs_site.py -q
node --test tests/web/*.test.mjs
```

Expected: all pass.

### Task 5: Add Follow-Up Tickets for Non-Blocking Hardening

**Files:**
- Modify: `docs/POSTPONED.md` or `docs/ROADMAP.md`

- [x] **Step 1: Document atomic JSON writes**

Add a scoped follow-up: temp-file + replace and optional lock around repository writes.

- [x] **Step 2: Document browser E2E coverage**

Add a scoped follow-up: Playwright smoke tests for onboarding, backup restore, data exposure, collection mobile, and Docker runtime.

- [x] **Step 3: Document screenshot format cleanup**

Add a scoped follow-up: re-encode or rename JPEG screenshots currently stored with `.png` extensions.
