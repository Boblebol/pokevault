/**
 * Pokevault — optional local-first Trainer Cards client.
 */
(function initTrainerContacts() {
  "use strict";

  const API_TRAINERS = "/api/trainers";
  let cachedBook = { version: 1, own_card: null, contacts: {} };
  let activeSearch = "";
  let started = false;
  let hasLoaded = false;
  let inflight = null;
  const listeners = new Set();

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
          kind: isContactKind(link?.kind) ? link.kind : "other",
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
            kind: isContactKind(values.contact_kind) ? values.contact_kind : "other",
            label: String(values.contact_label || "").trim(),
            value: linkValue,
          }]
        : [],
      wants: splitLines(values.wants),
      for_trade: splitLines(values.for_trade),
      updated_at: new Date().toISOString(),
    };
  }

  function isContactKind(value) {
    return ["email", "phone", "discord", "website", "other"].includes(value);
  }

  async function loadBook() {
    const res = await fetch(API_TRAINERS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedBook = normalizeBook(await res.json());
    hasLoaded = true;
    notify();
    return cachedBook;
  }

  async function ensureLoaded({ force = false } = {}) {
    if (inflight) return inflight;
    if (!force && hasLoaded) return cachedBook;
    inflight = loadBook().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  function notify() {
    for (const fn of listeners) {
      try {
        fn(cachedBook);
      } catch (err) {
        console.error("trainer contacts: listener failed", err);
      }
    }
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    try {
      fn(cachedBook);
    } catch (err) {
      console.error("trainer contacts: immediate listener failed", err);
    }
    return () => listeners.delete(fn);
  }

  async function saveOwnCard(card) {
    const validationError = validateTrainerCard(card);
    if (validationError) throw new Error(validationError);
    const res = await fetch(`${API_TRAINERS}/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadBook();
    render("Carte dresseur enregistrée.");
    return cachedBook.own_card;
  }

  async function importCard(card) {
    const validationError = validateTrainerCard(card);
    if (validationError) throw new Error(validationError);
    const res = await fetch(`${API_TRAINERS}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    await loadBook();
    render(`Import ${labelForImportAction(body.action)}.`);
  }

  function labelForImportAction(action) {
    if (action === "created") return "créé";
    if (action === "updated") return "mis à jour";
    return "inchangé";
  }

  function validateTrainerCard(card) {
    if (!String(card?.display_name || "").trim()) {
      return "Ajoute un pseudo dresseur avant d'enregistrer.";
    }
    const trainerId = String(card?.trainer_id || "").trim();
    if (trainerId.length < 8) {
      return "Garde un identifiant stable d'au moins 8 caractères.";
    }
    if (trainerId.length > 80) {
      return "L'identifiant stable doit faire 80 caractères maximum.";
    }
    return "";
  }

  function defaultOwnCard(idFactory = generateTrainerId) {
    return {
      schema_version: 1,
      app: "pokevault",
      kind: "trainer_card",
      trainer_id: idFactory(),
      display_name: "Dresseur local",
      favorite_region: "",
      favorite_pokemon_slug: "",
      public_note: "",
      contact_links: [],
      wants: [],
      for_trade: [],
      updated_at: new Date().toISOString(),
    };
  }

  function getOwnCard() {
    return cachedBook.own_card;
  }

  function updateCardListMembership(card, listName, slug, enabled) {
    const key = String(slug || "").trim();
    if (!key || (listName !== "wants" && listName !== "for_trade")) return card;
    const current = normalizeList(card?.[listName]);
    const next = enabled
      ? [...current.filter((item) => item !== key), key]
      : current.filter((item) => item !== key);
    return {
      ...(card || defaultOwnCard()),
      [listName]: next.slice(0, 40),
      updated_at: new Date().toISOString(),
    };
  }

  async function setOwnListMembership(slug, listName, enabled) {
    await ensureLoaded();
    const base = cachedBook.own_card || defaultOwnCard();
    const card = updateCardListMembership(base, listName, slug, enabled);
    return saveOwnCard(card);
  }

  function contactsTrading(bookOrSlug, maybeSlug) {
    const book = typeof bookOrSlug === "string" ? cachedBook : normalizeBook(bookOrSlug);
    const slug = typeof bookOrSlug === "string" ? bookOrSlug : maybeSlug;
    const key = String(slug || "").trim();
    if (!key) return [];
    return Object.values(book.contacts || {})
      .filter((contact) => (contact.card.for_trade || []).includes(key))
      .sort((a, b) => a.card.display_name.localeCompare(b.card.display_name, "fr"));
  }

  function contactsWanting(bookOrSlug, maybeSlug) {
    const book = typeof bookOrSlug === "string" ? cachedBook : normalizeBook(bookOrSlug);
    const slug = typeof bookOrSlug === "string" ? bookOrSlug : maybeSlug;
    const key = String(slug || "").trim();
    if (!key) return [];
    return Object.values(book.contacts || {})
      .filter((contact) => (contact.card.wants || []).includes(key))
      .sort((a, b) => a.card.display_name.localeCompare(b.card.display_name, "fr"));
  }

  function tradeSummary(bookOrSlug, maybeSlug) {
    const book = typeof bookOrSlug === "string" ? cachedBook : normalizeBook(bookOrSlug);
    const slug = typeof bookOrSlug === "string" ? bookOrSlug : maybeSlug;
    const key = String(slug || "").trim();
    const availableFrom = contactsTrading(book, key).map((contact) => contact.card.display_name);
    const wantedBy = contactsWanting(book, key).map((contact) => contact.card.display_name);
    const ownWants = new Set(book.own_card?.wants || []);
    const ownTrades = new Set(book.own_card?.for_trade || []);
    return {
      availableFrom,
      wantedBy,
      matchCount: ownWants.has(key) ? availableFrom.length : 0,
      canHelpCount: ownTrades.has(key) ? wantedBy.length : 0,
    };
  }

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

  function notePatchRequest(trainerId, note) {
    return {
      url: `${API_TRAINERS}/${encodeURIComponent(trainerId)}/note`,
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notePatchPayload(note)),
      },
    };
  }

  function deleteContactRequest(trainerId) {
    return {
      url: `${API_TRAINERS}/${encodeURIComponent(trainerId)}`,
      init: { method: "DELETE" },
    };
  }

  async function ensureOk(res) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }

  function shouldDeleteContact(name, confirmFn = window.confirm) {
    return confirmFn(`Supprimer ${name} du carnet local ?`);
  }

  function render(message = "") {
    const root = document.getElementById("trainerContactsRoot");
    if (!root) return;
    root.replaceChildren();
    const own = document.createElement("section");
    own.className = "trainer-panel";
    const firstLink = cachedBook.own_card?.contact_links?.[0] || {};
    own.innerHTML = `
      <div class="trainer-panel-head">
        <div>
          <p class="stats-kpi-label">Ma carte dresseur</p>
          <p class="stats-kpi-sub">Choisis uniquement ce que tu veux partager.</p>
        </div>
        <div class="trainer-actions">
          <button type="button" class="settings-action-btn" data-trainer-export>
            <span class="material-symbols-outlined" aria-hidden="true">download</span>
            Exporter
          </button>
          <button type="button" class="settings-action-btn" data-trainer-import>
            <span class="material-symbols-outlined" aria-hidden="true">upload</span>
            Importer
          </button>
        </div>
      </div>
      <form class="trainer-card-form" data-trainer-form>
        <input name="trainer_id" class="search-input" placeholder="Identifiant stable" minlength="8" maxlength="80" required value="${escapeAttr(cachedBook.own_card?.trainer_id || generateTrainerId())}">
        <input name="display_name" class="search-input" placeholder="Pseudo dresseur" maxlength="64" required value="${escapeAttr(cachedBook.own_card?.display_name || "")}">
        <input name="favorite_region" class="search-input" placeholder="Région favorite" value="${escapeAttr(cachedBook.own_card?.favorite_region || "")}">
        <input name="favorite_pokemon_slug" class="search-input" placeholder="Pokémon favori (slug)" value="${escapeAttr(cachedBook.own_card?.favorite_pokemon_slug || "")}">
        <textarea name="public_note" class="search-input" placeholder="Note publique">${escapeText(cachedBook.own_card?.public_note || "")}</textarea>
        <select name="contact_kind" class="region-filter" aria-label="Type de contact">
          <option value="discord">Discord</option>
          <option value="email">Email</option>
          <option value="phone">Téléphone</option>
          <option value="website">Site</option>
          <option value="other">Autre</option>
        </select>
        <input name="contact_label" class="search-input" placeholder="Libellé contact" value="${escapeAttr(firstLink.label || "")}">
        <input name="contact_value" class="search-input" placeholder="Valeur contact" value="${escapeAttr(firstLink.value || "")}">
        <textarea name="wants" class="search-input" placeholder="Je cherche (un slug par ligne)">${escapeText((cachedBook.own_card?.wants || []).join("\n"))}</textarea>
        <textarea name="for_trade" class="search-input" placeholder="Je peux échanger (un slug par ligne)">${escapeText((cachedBook.own_card?.for_trade || []).join("\n"))}</textarea>
        <button type="submit" class="settings-action-btn settings-action-btn--confirm">
          <span class="material-symbols-outlined" aria-hidden="true">save</span>
          Enregistrer
        </button>
      </form>
      <p class="sync-hint" ${message ? "" : "hidden"}>${escapeText(message)}</p>
    `;
    const kindSelect = own.querySelector('select[name="contact_kind"]');
    if (kindSelect) kindSelect.value = isContactKind(firstLink.kind) ? firstLink.kind : "discord";
    root.append(own, renderContactList());
    wire(root);
  }

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

  async function savePrivateNote(trainerId, note) {
    const request = notePatchRequest(trainerId, note);
    await ensureOk(await fetch(request.url, request.init));
    await loadBook();
    render("Note privée enregistrée.");
  }

  async function deleteTrainerContact(trainerId) {
    const request = deleteContactRequest(trainerId);
    await ensureOk(await fetch(request.url, request.init));
    await loadBook();
    render("Contact supprimé.");
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
    root.querySelector("[data-trainer-search]")?.addEventListener("input", (event) => {
      activeSearch = event.target.value;
      render();
      requestAnimationFrame(() => {
        const input = document.querySelector?.("[data-trainer-search]");
        input?.focus?.();
        input?.setSelectionRange?.(activeSearch.length, activeSearch.length);
      });
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
  }

  function exportFile() {
    if (!cachedBook.own_card) {
      render("Crée ta carte avant de l'exporter.");
      return;
    }
    const blob = new Blob([JSON.stringify(cachedBook.own_card, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilePart(cachedBook.own_card.display_name)}-pokevault-trainer.json`;
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
          void importCard(card).catch((err) => render(`Erreur : ${err.message}`));
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
      await ensureLoaded({ force: true });
      render();
    } catch (err) {
      render(`Erreur API : ${err.message}`);
    }
  }

  function generateTrainerId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `trainer-${Date.now()}`;
  }

  function safeFilePart(value) {
    return String(value || "trainer")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      || "trainer";
  }

  function formatDate(value) {
    if (!value) return "inconnue";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("fr");
  }

  function escapeText(value) {
    return String(value || "").replace(/[&<>]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]
    ));
  }

  function escapeAttr(value) {
    return escapeText(value).replace(/"/g, "&quot;");
  }

  const api = {
    start,
    normalizeBook,
    cardFromForm,
    ensureLoaded,
    subscribe,
    getOwnCard,
    setOwnListMembership,
    contactsTrading,
    contactsWanting,
    tradeSummary,
  };
  if (window.__POKEVAULT_TRAINERS_TESTS__) {
    api._test = {
      normalizeCard,
      normalizeBook,
      cardFromForm,
      validateTrainerCard,
      defaultOwnCard,
      updateCardListMembership,
      contactsTrading,
      contactsWanting,
      tradeSummary,
      filterContacts,
      renderContact,
      notePatchRequest,
      deleteContactRequest,
      shouldDeleteContact,
      ensureOk,
    };
  }
  window.PokevaultTrainerContacts = api;
})();
