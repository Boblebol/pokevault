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
    render("Carte dresseur enregistrée.");
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
    render(`Import ${labelForImportAction(body.action)}.`);
  }

  function labelForImportAction(action) {
    if (action === "created") return "créé";
    if (action === "updated") return "mis à jour";
    return "inchangé";
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
        <input name="trainer_id" class="search-input" placeholder="Identifiant stable" value="${escapeAttr(cachedBook.own_card?.trainer_id || generateTrainerId())}">
        <input name="display_name" class="search-input" placeholder="Pseudo dresseur" value="${escapeAttr(cachedBook.own_card?.display_name || "")}">
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
    section.innerHTML = `
      <div class="trainer-panel-head">
        <div>
          <p class="stats-kpi-label">Contacts dresseurs</p>
          <p class="stats-kpi-sub">Les fiches reçues restent dans ce profil local.</p>
        </div>
      </div>
    `;
    const list = document.createElement("div");
    list.className = "trainer-contact-list";
    const contacts = Object.values(cachedBook.contacts).sort((a, b) =>
      a.card.display_name.localeCompare(b.card.display_name, "fr"),
    );
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
      <p class="stats-kpi-sub">MAJ reçue : ${escapeText(formatDate(contact.last_received_at))}</p>
      <dl class="trainer-contact-meta">
        <div><dt>Région</dt><dd>${escapeText(contact.card.favorite_region || "—")}</dd></div>
        <div><dt>Favori</dt><dd>${escapeText(contact.card.favorite_pokemon_slug || "—")}</dd></div>
      </dl>
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

  const api = { start, normalizeBook, cardFromForm };
  if (window.__POKEVAULT_TRAINERS_TESTS__) api._test = { normalizeBook, cardFromForm };
  window.PokevaultTrainerContacts = api;
})();
