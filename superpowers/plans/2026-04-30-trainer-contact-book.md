# Trainer Contact Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the optional `Dresseurs` tab into a usable local contact book with search, readable received cards, private notes, and contact deletion.

**Architecture:** Keep all behavior in the existing local Trainer Contacts surface. The backend endpoints already exist, so implementation is a frontend-focused increment with docs updates. The client keeps a normalized in-memory book, filters locally, and only mutates persisted state after successful API calls.

**Tech Stack:** FastAPI tracker backend, vanilla browser JavaScript in `web/trainer-contacts.js`, CSS in `web/styles.css`, Node test runner for web tests, pytest for docs/API guard tests.

---

## File Structure

- Modify `web/trainer-contacts.js`: add local search helpers, richer contact rendering, private note PATCH flow, delete flow, and test exports.
- Modify `web/styles.css`: add layout rules for search, richer contact cards, local notes, action rows, and tag lists.
- Modify `tests/web/trainer-contacts.test.mjs`: add pure helper and rendered-markup coverage for the new contact book behavior.
- Modify `docs/TRAINER_CONTACTS.md`: document contact search, notes, and deletion as local-only book capabilities.
- Modify `README.md`: clarify that Trainer Cards include a local received-contact book.
- Modify `docs/features.html`: mention searchable local contact book behavior on the public GitHub Pages feature page.
- Modify `docs/roadmap.html` and `docs/ROADMAP.md`: mark the useful received-contact book increment in the optional Dresseurs track.

---

### Task 1: Add Contact Book Test Coverage

**Files:**
- Modify: `tests/web/trainer-contacts.test.mjs`
- Modify later: `web/trainer-contacts.js`

- [ ] **Step 1: Add failing tests for filtering, list rendering, note payloads, and delete confirmation**

Append these tests to `tests/web/trainer-contacts.test.mjs`:

```javascript
test("filterContacts matches local book fields and keeps display-name order", async () => {
  const api = await loadModule();
  const contacts = {
    misty: {
      card: {
        trainer_id: "misty",
        display_name: "Misty",
        favorite_region: "Kanto",
        favorite_pokemon_slug: "0121-starmie",
        public_note: "Water trades",
        contact_links: [{ kind: "discord", label: "Discord", value: "misty#0001" }],
        wants: ["0054-psyduck"],
        for_trade: ["0118-goldeen"],
        updated_at: "2026-04-30T10:00:00+00:00",
      },
      private_note: "met at local league",
      first_received_at: "2026-04-30T11:00:00+00:00",
      last_received_at: "2026-04-30T11:00:00+00:00",
    },
    brock: {
      card: {
        trainer_id: "brock",
        display_name: "Brock",
        favorite_region: "Kanto",
        favorite_pokemon_slug: "0095-onix",
        public_note: "Rock cards",
        contact_links: [],
        wants: ["0074-geodude"],
        for_trade: [],
        updated_at: "2026-04-30T10:00:00+00:00",
      },
      private_note: "",
      first_received_at: "2026-04-30T12:00:00+00:00",
      last_received_at: "2026-04-30T12:00:00+00:00",
    },
  };

  assert.deepEqual(
    api.filterContacts(contacts, "kanto").map((contact) => contact.card.display_name),
    ["Brock", "Misty"],
  );
  assert.deepEqual(
    api.filterContacts(contacts, "psyduck").map((contact) => contact.card.display_name),
    ["Misty"],
  );
  assert.deepEqual(
    api.filterContacts(contacts, "local league").map((contact) => contact.card.display_name),
    ["Misty"],
  );
});

test("renderContact exposes trade lists, private note controls, and delete action", async () => {
  const api = await loadModule();
  const article = api.renderContact({
    card: {
      trainer_id: "misty-123",
      display_name: "Misty",
      favorite_region: "Kanto",
      favorite_pokemon_slug: "0121-starmie",
      public_note: "Water trades",
      contact_links: [{ kind: "discord", label: "Discord", value: "misty#0001" }],
      wants: ["0054-psyduck"],
      for_trade: ["0118-goldeen"],
      updated_at: "2026-04-30T10:00:00+00:00",
    },
    private_note: "Bring sleeves",
    first_received_at: "2026-04-30T11:00:00+00:00",
    last_received_at: "2026-04-30T11:00:00+00:00",
  });

  assert.match(article.innerHTML, /Cherche/);
  assert.match(article.innerHTML, /0054-psyduck/);
  assert.match(article.innerHTML, /Echange/);
  assert.match(article.innerHTML, /0118-goldeen/);
  assert.match(article.innerHTML, /data-trainer-note-form/);
  assert.match(article.innerHTML, /Bring sleeves/);
  assert.match(article.innerHTML, /data-trainer-delete/);
});

test("notePatchPayload trims private notes before saving", async () => {
  const api = await loadModule();

  assert.deepEqual(api.notePatchPayload("  Bring sleeves  "), { note: "Bring sleeves" });
});

test("shouldDeleteContact delegates the final decision to browser confirmation", async () => {
  const api = await loadModule();
  const calls = [];

  assert.equal(api.shouldDeleteContact("Misty", (message) => {
    calls.push(message);
    return false;
  }), false);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /Misty/);
});
```

- [ ] **Step 2: Run the focused web test and verify it fails**

Run:

```bash
node --test tests/web/trainer-contacts.test.mjs
```

Expected: FAIL because `filterContacts`, `renderContact`, `notePatchPayload`, and `shouldDeleteContact` are not exported in `_test`.

- [ ] **Step 3: Commit is not allowed yet**

Do not commit this task until the implementation in Task 2 makes the new tests pass.

---

### Task 2: Implement Search, Rich Contact Cards, Notes, and Delete

**Files:**
- Modify: `web/trainer-contacts.js`
- Test: `tests/web/trainer-contacts.test.mjs`

- [ ] **Step 1: Add state and pure helpers near the top of `web/trainer-contacts.js`**

Add `activeSearch` next to `cachedBook`:

```javascript
let cachedBook = { version: 1, own_card: null, contacts: {} };
let activeSearch = "";
let started = false;
```

Add these helpers after `labelForImportAction`:

```javascript
function contactSearchText(contact) {
  const card = contact?.card || {};
  return [
    card.display_name,
    card.favorite_region,
    card.favorite_pokemon_slug,
    card.public_note,
    contact?.private_note,
    ...(card.contact_links || []).flatMap((link) => [link.label, link.value]),
    ...(card.wants || []),
    ...(card.for_trade || []),
  ].join(" ").toLowerCase();
}

function filterContacts(contacts, query) {
  const needle = String(query || "").trim().toLowerCase();
  return Object.values(contacts || {})
    .filter((contact) => !needle || contactSearchText(contact).includes(needle))
    .sort((a, b) => a.card.display_name.localeCompare(b.card.display_name, "fr"));
}

function notePatchPayload(value) {
  return { note: String(value || "").trim() };
}

function shouldDeleteContact(name, confirmFn = window.confirm) {
  return confirmFn(`Supprimer ${name} du carnet local ?`);
}
```

- [ ] **Step 2: Replace `renderContactList` with searchable rendering**

Replace the existing `renderContactList` implementation with:

```javascript
function renderContactList() {
  const section = document.createElement("section");
  section.className = "trainer-panel";
  const contacts = filterContacts(cachedBook.contacts, activeSearch);
  const hasContacts = Object.keys(cachedBook.contacts || {}).length > 0;
  section.innerHTML = `
    <div class="trainer-panel-head">
      <div>
        <p class="stats-kpi-label">Contacts dresseurs</p>
        <p class="stats-kpi-sub">Les fiches reçues restent dans ce profil local.</p>
      </div>
    </div>
    <label class="trainer-search">
      <span>Rechercher</span>
      <input name="trainer_search" class="search-input" placeholder="Pseudo, région, note, Pokémon..." value="${escapeAttr(activeSearch)}" data-trainer-search>
    </label>
  `;
  const list = document.createElement("div");
  list.className = "trainer-contact-list";
  if (!contacts.length) {
    const empty = document.createElement("p");
    empty.className = "trainer-empty";
    empty.textContent = hasContacts
      ? "Aucun contact ne correspond à cette recherche."
      : "Aucune carte reçue pour le moment.";
    list.append(empty);
  }
  for (const contact of contacts) list.append(renderContact(contact));
  section.append(list);
  return section;
}
```

- [ ] **Step 3: Replace `renderContact` with the richer card**

Replace the existing `renderContact` implementation with:

```javascript
function renderContact(contact) {
  const article = document.createElement("article");
  article.className = "trainer-contact-card";
  const wants = renderTagGroup("Cherche", contact.card.wants);
  const trades = renderTagGroup("Echange", contact.card.for_trade);
  const links = renderContactLinks(contact.card.contact_links);
  article.innerHTML = `
    <div class="trainer-contact-card-head">
      <div>
        <h2>${escapeText(contact.card.display_name)}</h2>
        <p>${escapeText(contact.card.public_note || "Carte dresseur locale")}</p>
      </div>
      <button type="button" class="trainer-danger-btn" data-trainer-delete data-trainer-id="${escapeAttr(contact.card.trainer_id)}" data-trainer-name="${escapeAttr(contact.card.display_name)}">
        <span class="material-symbols-outlined" aria-hidden="true">delete</span>
        Supprimer
      </button>
    </div>
    <p class="stats-kpi-sub">MAJ reçue : ${escapeText(formatDate(contact.last_received_at))}</p>
    <dl class="trainer-contact-meta">
      <div><dt>Région</dt><dd>${escapeText(contact.card.favorite_region || "-")}</dd></div>
      <div><dt>Favori</dt><dd>${escapeText(contact.card.favorite_pokemon_slug || "-")}</dd></div>
    </dl>
    ${links}
    <div class="trainer-list-groups">
      ${wants}
      ${trades}
    </div>
    <form class="trainer-note-form" data-trainer-note-form data-trainer-id="${escapeAttr(contact.card.trainer_id)}">
      <label>
        <span>Note privée</span>
        <textarea class="search-input" name="private_note" placeholder="Visible seulement dans ce carnet local.">${escapeText(contact.private_note || "")}</textarea>
      </label>
      <button type="submit" class="settings-action-btn">
        <span class="material-symbols-outlined" aria-hidden="true">save</span>
        Enregistrer la note
      </button>
    </form>
  `;
  return article;
}
```

Add these helper functions immediately after `renderContact`:

```javascript
function renderTagGroup(title, items) {
  const clean = normalizeList(items);
  if (!clean.length) {
    return `<div class="trainer-tag-group"><h3>${title}</h3><p class="stats-kpi-sub">Rien indiqué.</p></div>`;
  }
  return `
    <div class="trainer-tag-group">
      <h3>${title}</h3>
      <ul>${clean.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderContactLinks(links) {
  const clean = Array.isArray(links) ? links.filter((link) => link.value) : [];
  if (!clean.length) return "";
  return `
    <ul class="trainer-contact-links">
      ${clean.map((link) => `<li><span>${escapeText(link.label || link.kind || "Contact")}</span>${escapeText(link.value)}</li>`).join("")}
    </ul>
  `;
}
```

- [ ] **Step 4: Add API mutation helpers before `wire`**

Add:

```javascript
async function savePrivateNote(trainerId, note) {
  const res = await fetch(`${API_TRAINERS}/${encodeURIComponent(trainerId)}/note`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notePatchPayload(note)),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await loadBook();
  render("Note privée enregistrée.");
}

async function deleteTrainerContact(trainerId) {
  const res = await fetch(`${API_TRAINERS}/${encodeURIComponent(trainerId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await loadBook();
  render("Contact supprimé.");
}
```

- [ ] **Step 5: Extend `wire` for search, note save, and deletion**

Inside `wire(root)`, after the import button listener, add:

```javascript
root.querySelector("[data-trainer-search]")?.addEventListener("input", (event) => {
  activeSearch = event.target.value;
  render();
});
for (const noteForm of root.querySelectorAll("[data-trainer-note-form]")) {
  noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const trainerId = noteForm.dataset.trainerId || "";
    const note = new FormData(noteForm).get("private_note");
    void savePrivateNote(trainerId, note).catch((err) => render(`Erreur : ${err.message}`));
  });
}
for (const button of root.querySelectorAll("[data-trainer-delete]")) {
  button.addEventListener("click", () => {
    const trainerId = button.dataset.trainerId || "";
    const name = button.dataset.trainerName || "ce contact";
    if (!shouldDeleteContact(name)) return;
    void deleteTrainerContact(trainerId).catch((err) => render(`Erreur : ${err.message}`));
  });
}
```

- [ ] **Step 6: Export helpers for tests**

Replace the test export block with:

```javascript
const api = { start, normalizeBook, cardFromForm };
if (window.__POKEVAULT_TRAINERS_TESTS__) {
  api._test = {
    normalizeBook,
    cardFromForm,
    filterContacts,
    notePatchPayload,
    renderContact,
    shouldDeleteContact,
  };
}
window.PokevaultTrainerContacts = api;
```

- [ ] **Step 7: Run the focused web test and verify it passes**

Run:

```bash
node --test tests/web/trainer-contacts.test.mjs
```

Expected: PASS, 6 trainer contact tests.

- [ ] **Step 8: Commit the frontend behavior and tests**

Run:

```bash
git add web/trainer-contacts.js tests/web/trainer-contacts.test.mjs
git commit -m "feat(web): improve trainer contact book"
```

---

### Task 3: Style the Contact Book UI

**Files:**
- Modify: `web/styles.css`
- Test: `tests/test_mobile_home_css.py`

- [ ] **Step 1: Add CSS assertions before changing styles**

Extend `test_trainer_contacts_are_optional_and_isolated` in `tests/test_mobile_home_css.py` with:

```python
    assert "trainer-search" in CSS
    assert "trainer-note-form" in CSS
    assert "trainer-danger-btn" in CSS
    assert "trainer-list-groups" in CSS
```

- [ ] **Step 2: Run the focused CSS test and verify it fails**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_trainer_contacts_are_optional_and_isolated -q
```

Expected: FAIL because the new CSS classes are not present yet.

- [ ] **Step 3: Add styles near the existing trainer CSS block in `web/styles.css`**

Add:

```css
.trainer-search {
  display: grid;
  gap: 0.35rem;
  margin-top: 1rem;
}

.trainer-search span,
.trainer-note-form span {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 650;
}

.trainer-contact-card {
  display: grid;
  gap: 0.85rem;
}

.trainer-contact-card-head {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
}

.trainer-contact-card-head p {
  margin: 0;
  color: var(--muted);
  line-height: 1.45;
}

.trainer-danger-btn {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.35rem;
  align-items: center;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(255, 143, 143, 0.45);
  border-radius: 0.35rem;
  background: transparent;
  color: var(--danger);
  cursor: pointer;
}

.trainer-contact-links,
.trainer-tag-group ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.trainer-contact-links li,
.trainer-tag-group li {
  padding: 0.25rem 0.45rem;
  border: 1px solid var(--outline-soft);
  border-radius: 0.35rem;
  color: var(--text);
  overflow-wrap: anywhere;
}

.trainer-contact-links span {
  margin-right: 0.35rem;
  color: var(--muted);
}

.trainer-list-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.trainer-tag-group h3 {
  margin: 0 0 0.4rem;
  font-size: 0.78rem;
  color: var(--muted);
  text-transform: uppercase;
}

.trainer-note-form {
  display: grid;
  gap: 0.5rem;
}

.trainer-note-form label {
  display: grid;
  gap: 0.35rem;
}

.trainer-note-form textarea {
  min-height: 4.5rem;
  resize: vertical;
}

.trainer-empty {
  margin: 0;
  color: var(--muted);
}
```

Inside the existing `@media (max-width: 760px)` block, add:

```css
  .trainer-contact-card-head,
  .trainer-list-groups {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
```

- [ ] **Step 4: Run the focused CSS test and verify it passes**

Run:

```bash
uv run pytest tests/test_mobile_home_css.py::test_trainer_contacts_are_optional_and_isolated -q
```

Expected: PASS.

- [ ] **Step 5: Commit styles**

Run:

```bash
git add web/styles.css tests/test_mobile_home_css.py
git commit -m "style(web): refine trainer contact book"
```

---

### Task 4: Update Documentation and Public Docs

**Files:**
- Modify: `docs/TRAINER_CONTACTS.md`
- Modify: `README.md`
- Modify: `docs/features.html`
- Modify: `docs/roadmap.html`
- Modify: `docs/ROADMAP.md`
- Test: `tests/test_docs_site.py`

- [ ] **Step 1: Add docs assertions before editing docs**

Extend `test_trainer_contacts_are_documented_publicly` in `tests/test_docs_site.py` with:

```python
    guide = guide.read_text(encoding="utf-8")
    assert "searchable local contact book" in guide
    assert "private notes" in guide
    assert "searchable local contact book" in readme
    assert "searchable local contact book" in features
```

- [ ] **Step 2: Run the focused docs test and verify it fails**

Run:

```bash
uv run pytest tests/test_docs_site.py::test_trainer_contacts_are_documented_publicly -q
```

Expected: FAIL because the new public wording is not documented yet.

- [ ] **Step 3: Update `docs/TRAINER_CONTACTS.md`**

Add this paragraph after the storage paragraph:

```markdown
The `Dresseurs` tab also acts as a searchable local contact book. Received
cards can be searched by trainer name, region, favorite Pokemon, contact lines,
wishlist, trade list and private notes. Private notes stay local to the contact
book and are never included in exported Trainer Cards.
```

Add this sentence near the end:

```markdown
Deleting a received contact only removes the local copy from this profile; it
does not affect the exported card file or any other trainer.
```

- [ ] **Step 4: Update `README.md`**

Replace:

```markdown
- Creates and imports optional Trainer Cards for local collector contacts.
```

with:

```markdown
- Creates and imports optional Trainer Cards with a searchable local contact book.
```

- [ ] **Step 5: Update public GitHub Pages docs**

In `docs/features.html`, replace the Trainer Cards paragraph with:

```html
<article class="feature"><h3>Trainer Cards</h3><p>Create a local card, export it as a file, import received Dresseurs and keep a searchable local contact book without accounts or server sync.</p></article>
```

In `docs/roadmap.html`, replace the v0.2 Dresseurs paragraph with:

```html
<article class="feature"><h3>v0.2 received contacts</h3><p>Import cards from other collectors, update by stable trainer identity, search the local book, keep private notes and delete stale contacts.</p></article>
```

In `docs/ROADMAP.md`, replace the v0.2 bullet with:

```markdown
- v0.2: update an existing contact by stable `trainer_id`, preserve private
  notes, search the local contact book and delete stale contacts.
```

- [ ] **Step 6: Run the focused docs test and verify it passes**

Run:

```bash
uv run pytest tests/test_docs_site.py::test_trainer_contacts_are_documented_publicly -q
```

Expected: PASS.

- [ ] **Step 7: Commit docs**

Run:

```bash
git add docs/TRAINER_CONTACTS.md README.md docs/features.html docs/roadmap.html docs/ROADMAP.md tests/test_docs_site.py
git commit -m "docs: document trainer contact book"
```

---

### Task 5: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run lint**

Run:

```bash
uv run ruff check pokedex/ tracker/ main.py tests/
```

Expected: `All checks passed!`

- [ ] **Step 2: Run focused Python tests**

Run:

```bash
uv run pytest tests/tracker/test_trainer_contact_service.py tests/tracker/test_trainer_contact_api.py tests/test_mobile_home_css.py tests/test_docs_site.py -q
```

Expected: all selected tests pass.

- [ ] **Step 3: Run all web tests**

Run:

```bash
node --test tests/web/*.test.mjs
```

Expected: all web tests pass, including the expanded trainer contact tests.

- [ ] **Step 4: Inspect git state**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: clean feature worktree, with recent commits for plan, frontend behavior, styles, and docs.
