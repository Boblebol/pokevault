/**
 * Pokevault — optional local-first Trainer Cards client.
 */
(function initTrainerContacts() {
  "use strict";

  const API_TRAINERS = "/api/trainers";
  const CONTACT_KIND_OPTIONS = [
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["phone", "Téléphone"],
    ["discord", "Discord"],
    ["email", "Email"],
    ["website", "Site"],
    ["other", "Autre"],
  ];
  const DEFAULT_CONTACT_KINDS = ["instagram", "facebook", "phone"];
  let cachedBook = { version: 1, own_card: null, contacts: {} };
  let activeSearch = "";
  let started = false;
  let hasLoaded = false;
  let inflight = null;
  const listeners = new Set();
  const FALLBACK_I18N = {
    "trainers.mine.title": "Ma carte dresseur",
    "trainers.mine.help": "Choisis tes infos publiques. Les badges obtenus sont inclus automatiquement.",
    "trainers.export": "Exporter",
    "trainers.import": "Importer",
    "trainers.id": "Identifiant stable",
    "trainers.name": "Pseudo dresseur",
    "trainers.favorite_region": "Région favorite",
    "trainers.favorite_pokemon": "Pokémon favori (slug)",
    "trainers.public_note": "Note publique",
    "trainers.contact": "Contact partageable",
    "trainers.contact_type": "Type de contact {index}",
    "trainers.contact_value": "Lien, @pseudo, téléphone...",
    "trainers.wants_placeholder": "Je cherche (un slug par ligne)",
    "trainers.trade_placeholder": "Je peux échanger (un slug par ligne)",
    "trainers.save": "Enregistrer",
    "trainers.contacts.title": "Contacts dresseurs",
    "trainers.contacts.help": "Les fiches reçues restent dans ce profil local.",
    "trainers.search": "Rechercher",
    "trainers.search_placeholder": "Pseudo, région, note, Pokémon...",
    "trainers.empty_filtered": "Aucun contact ne correspond à cette recherche.",
    "trainers.empty": "Aucune carte reçue pour le moment.",
    "trainers.want": "Cherche",
    "trainers.trade": "Echange",
    "trainers.badges": "Badges",
    "trainers.delete": "Supprimer",
    "trainers.local_card": "Carte dresseur locale",
    "trainers.received_update": "MAJ reçue",
    "trainers.region": "Région",
    "trainers.favorite": "Favori",
    "trainers.private_note": "Note privée",
    "trainers.private_note_placeholder": "Visible seulement dans ce carnet local.",
    "trainers.save_note": "Enregistrer la note",
    "trainers.none": "Rien indiqué.",
    "trainers.confirm_delete": "Supprimer {name} du carnet local ?",
    "trainers.note_saved": "Note privée enregistrée.",
    "trainers.contact_deleted": "Contact supprimé.",
    "trainers.create_before_export": "Crée ta carte avant de l'exporter.",
    "trainers.invalid_card": "Carte dresseur invalide",
    "trainers.invalid_file": "Fichier invalide : {message}",
    "trainers.api_error": "Erreur API : {message}",
    "trainers.error": "Erreur : {message}",
    "trainers.unknown_date": "inconnue",
  };

  function tr(key, params = {}) {
    const raw = window.PokevaultI18n?.t?.(key, params) || FALLBACK_I18N[key] || key;
    return String(raw).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => (
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
    ));
  }

  function normalizeList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 40);
  }

  function normalizeBadges(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const badge of raw) {
      const id = String(badge?.id || "").trim();
      const title = String(badge?.title || "").trim();
      if (!id || !title || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, title });
      if (out.length >= 80) break;
    }
    return out;
  }

  function sharedBadgesFromState(state = window.PokevaultBadges?.state) {
    const catalog = Array.isArray(state?.catalog) ? state.catalog : [];
    return normalizeBadges(
      catalog
        .filter((badge) => badge?.unlocked)
        .map((badge) => ({ id: badge.id, title: badge.title })),
    );
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
        .map((link) => {
          const kind = isContactKind(link?.kind) ? link.kind : "other";
          return {
            kind,
            label: String(link?.label || contactLabelForKind(kind)).trim(),
            value: String(link?.value || "").trim(),
          };
        })
        .filter((link) => link.value)
        .slice(0, 6),
      wants: normalizeList(raw.wants),
      for_trade: normalizeList(raw.for_trade),
      badges: normalizeBadges(raw.badges),
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
    return {
      schema_version: 1,
      app: "pokevault",
      kind: "trainer_card",
      trainer_id: String(values.trainer_id || "").trim(),
      display_name: String(values.display_name || "").trim(),
      favorite_region: String(values.favorite_region || "").trim(),
      favorite_pokemon_slug: String(values.favorite_pokemon_slug || "").trim(),
      public_note: String(values.public_note || "").trim(),
      contact_links: contactLinksFromForm(values),
      wants: splitLines(values.wants),
      for_trade: splitLines(values.for_trade),
      badges: sharedBadgesFromState(),
      updated_at: new Date().toISOString(),
    };
  }

  function contactLinksFromForm(values) {
    const links = [];
    for (let i = 0; i < 3; i += 1) {
      const value = String(values[`contact_value_${i}`] || "").trim();
      if (!value) continue;
      const kind = isContactKind(values[`contact_kind_${i}`])
        ? values[`contact_kind_${i}`]
        : "other";
      links.push({ kind, label: contactLabelForKind(kind), value });
    }
    if (links.length) return links;

    const legacyValue = String(values.contact_value || "").trim();
    if (!legacyValue) return [];
    const legacyKind = isContactKind(values.contact_kind) ? values.contact_kind : "other";
    return [{
      kind: legacyKind,
      label: String(values.contact_label || contactLabelForKind(legacyKind)).trim(),
      value: legacyValue,
    }];
  }

  function isContactKind(value) {
    return CONTACT_KIND_OPTIONS.some(([kind]) => kind === value);
  }

  function contactLabelForKind(kind) {
    const found = CONTACT_KIND_OPTIONS.find(([value]) => value === kind);
    return found ? found[1] : "Contact";
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
      badges: [],
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
      ...(card.badges || []).flatMap((badge) => [badge.id, badge.title]),
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
    return confirmFn(tr("trainers.confirm_delete", { name }));
  }

  function render(message = "") {
    const root = document.getElementById("trainerContactsRoot");
    if (!root) return;
    root.replaceChildren();
    const own = document.createElement("section");
    own.className = "trainer-panel";
    const contactLinks = Array.isArray(cachedBook.own_card?.contact_links)
      ? cachedBook.own_card.contact_links.slice(0, 3)
      : [];
    own.innerHTML = `
      <div class="trainer-panel-head">
        <div>
          <p class="stats-kpi-label">${escapeText(tr("trainers.mine.title"))}</p>
          <p class="stats-kpi-sub">${escapeText(tr("trainers.mine.help"))}</p>
        </div>
        <div class="trainer-actions">
          <button type="button" class="settings-action-btn" data-trainer-export>
            <span class="app-icon" aria-hidden="true">↓</span>
            ${escapeText(tr("trainers.export"))}
          </button>
          <button type="button" class="settings-action-btn" data-trainer-import>
            <span class="app-icon" aria-hidden="true">↑</span>
            ${escapeText(tr("trainers.import"))}
          </button>
        </div>
      </div>
      <form class="trainer-card-form" data-trainer-form>
        <input name="trainer_id" class="search-input" placeholder="${escapeAttr(tr("trainers.id"))}" minlength="8" maxlength="80" required value="${escapeAttr(cachedBook.own_card?.trainer_id || generateTrainerId())}">
        <input name="display_name" class="search-input" placeholder="${escapeAttr(tr("trainers.name"))}" maxlength="64" required value="${escapeAttr(cachedBook.own_card?.display_name || "")}">
        <input name="favorite_region" class="search-input" placeholder="${escapeAttr(tr("trainers.favorite_region"))}" value="${escapeAttr(cachedBook.own_card?.favorite_region || "")}">
        <input name="favorite_pokemon_slug" class="search-input" placeholder="${escapeAttr(tr("trainers.favorite_pokemon"))}" value="${escapeAttr(cachedBook.own_card?.favorite_pokemon_slug || "")}">
        <textarea name="public_note" class="search-input" placeholder="${escapeAttr(tr("trainers.public_note"))}">${escapeText(cachedBook.own_card?.public_note || "")}</textarea>
        ${renderOwnContactFields(contactLinks)}
        <textarea name="wants" class="search-input" placeholder="${escapeAttr(tr("trainers.wants_placeholder"))}">${escapeText((cachedBook.own_card?.wants || []).join("\n"))}</textarea>
        <textarea name="for_trade" class="search-input" placeholder="${escapeAttr(tr("trainers.trade_placeholder"))}">${escapeText((cachedBook.own_card?.for_trade || []).join("\n"))}</textarea>
        <button type="submit" class="settings-action-btn settings-action-btn--confirm">
          <span class="app-icon" aria-hidden="true">✓</span>
          ${escapeText(tr("trainers.save"))}
        </button>
      </form>
      <p class="sync-hint" ${message ? "" : "hidden"}>${escapeText(message)}</p>
    `;
    root.append(own, renderContactList());
    wire(root);
  }

  function renderOwnContactFields(contactLinks) {
    const rows = Array.from({ length: 3 }, (_, index) => {
      const link = contactLinks[index] || {};
      const kind = isContactKind(link.kind) ? link.kind : DEFAULT_CONTACT_KINDS[index];
      return `
        <div class="trainer-contact-edit-row">
          <select name="contact_kind_${index}" class="region-filter" aria-label="${escapeAttr(tr("trainers.contact_type", { index: index + 1 }))}">
            ${renderContactKindOptions(kind)}
          </select>
          <input name="contact_value_${index}" class="search-input" placeholder="${escapeAttr(tr("trainers.contact_value"))}" value="${escapeAttr(link.value || "")}">
        </div>
      `;
    }).join("");
    return `
      <fieldset class="trainer-contact-editor">
        <legend>${escapeText(tr("trainers.contact"))}</legend>
        ${rows}
      </fieldset>
    `;
  }

  function renderContactKindOptions(selected) {
    return CONTACT_KIND_OPTIONS
      .map(([value, label]) => (
        `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeText(label)}</option>`
      ))
      .join("");
  }

  function renderContactList() {
    const section = document.createElement("section");
    section.className = "trainer-panel";
    const contacts = filterContacts(cachedBook.contacts, activeSearch);
    const hasContacts = Object.keys(cachedBook.contacts || {}).length > 0;
    section.innerHTML = `
      <div class="trainer-panel-head">
        <div>
          <p class="stats-kpi-label">${escapeText(tr("trainers.contacts.title"))}</p>
          <p class="stats-kpi-sub">${escapeText(tr("trainers.contacts.help"))}</p>
        </div>
      </div>
      <label class="trainer-search">
        <span>${escapeText(tr("trainers.search"))}</span>
        <input name="trainer_search" class="search-input" placeholder="${escapeAttr(tr("trainers.search_placeholder"))}" value="${escapeAttr(activeSearch)}" data-trainer-search>
      </label>
    `;
    const list = document.createElement("div");
    list.className = "trainer-contact-list";
    if (!contacts.length) {
      const empty = document.createElement("p");
      empty.className = "trainer-empty";
      empty.textContent = hasContacts
        ? tr("trainers.empty_filtered")
        : tr("trainers.empty");
      list.append(empty);
    }
    for (const contact of contacts) list.append(renderContact(contact));
    section.append(list);
    return section;
  }

  function renderContact(contact) {
    const article = document.createElement("article");
    article.className = "trainer-contact-card";
    const wants = renderTagGroup(tr("trainers.want"), contact.card.wants);
    const trades = renderTagGroup(tr("trainers.trade"), contact.card.for_trade);
    const badges = renderBadgeGroup(contact.card.badges);
    const links = renderContactLinks(contact.card.contact_links);
    article.innerHTML = `
      <div class="trainer-contact-card-head">
        <div>
          <h2>${escapeText(contact.card.display_name)}</h2>
          <p>${escapeText(contact.card.public_note || tr("trainers.local_card"))}</p>
        </div>
        <button type="button" class="trainer-danger-btn" data-trainer-delete data-trainer-id="${escapeAttr(contact.card.trainer_id)}" data-trainer-name="${escapeAttr(contact.card.display_name)}">
          <span class="app-icon" aria-hidden="true">×</span>
          ${escapeText(tr("trainers.delete"))}
        </button>
      </div>
      <p class="stats-kpi-sub">${escapeText(tr("trainers.received_update"))} : ${escapeText(formatDate(contact.last_received_at))}</p>
      <dl class="trainer-contact-meta">
        <div><dt>${escapeText(tr("trainers.region"))}</dt><dd>${escapeText(contact.card.favorite_region || "-")}</dd></div>
        <div><dt>${escapeText(tr("trainers.favorite"))}</dt><dd>${escapeText(contact.card.favorite_pokemon_slug || "-")}</dd></div>
      </dl>
      ${links}
      <div class="trainer-list-groups">
        ${badges}
        ${wants}
        ${trades}
      </div>
      <form class="trainer-note-form" data-trainer-note-form data-trainer-id="${escapeAttr(contact.card.trainer_id)}">
        <label>
          <span>${escapeText(tr("trainers.private_note"))}</span>
          <textarea class="search-input" name="private_note" placeholder="${escapeAttr(tr("trainers.private_note_placeholder"))}">${escapeText(contact.private_note || "")}</textarea>
        </label>
        <button type="submit" class="settings-action-btn">
          <span class="app-icon" aria-hidden="true">✓</span>
          ${escapeText(tr("trainers.save_note"))}
        </button>
      </form>
    `;
    return article;
  }

  function renderTagGroup(title, items) {
    const clean = normalizeList(items);
    if (!clean.length) {
      return `<div class="trainer-tag-group"><h3>${escapeText(title)}</h3><p class="stats-kpi-sub">${escapeText(tr("trainers.none"))}</p></div>`;
    }
    return `
      <div class="trainer-tag-group">
        <h3>${escapeText(title)}</h3>
        <ul>${clean.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul>
      </div>
    `;
  }

  function renderBadgeGroup(items) {
    const badges = normalizeBadges(items);
    if (!badges.length) return "";
    return `
      <div class="trainer-tag-group trainer-tag-group--badges">
        <h3>${escapeText(tr("trainers.badges"))}</h3>
        <ul>${badges.map((badge) => `<li>${escapeText(badge.title)}</li>`).join("")}</ul>
      </div>
    `;
  }

  function renderContactLinks(links) {
    const clean = Array.isArray(links) ? links.filter((link) => link.value) : [];
    if (!clean.length) return "";
    return `
      <ul class="trainer-contact-links">
        ${clean.map(renderContactLink).join("")}
      </ul>
    `;
  }

  function renderContactLink(link) {
    const kind = isContactKind(link.kind) ? link.kind : "other";
    const label = String(link.label || contactLabelForKind(kind));
    const value = String(link.value || "").trim();
    const href = contactHref({ kind, value });
    const renderedValue = href
      ? `<a href="${escapeAttr(href)}" ${href.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : ""}>${escapeText(value)}</a>`
      : escapeText(value);
    return `<li><span>${escapeText(label)}</span>${renderedValue}</li>`;
  }

  function contactHref(link) {
    const value = String(link?.value || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (link.kind === "email" && value.includes("@")) return `mailto:${value}`;
    if (link.kind === "phone") {
      const phone = value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
      return phone ? `tel:${phone}` : "";
    }
    if (link.kind === "instagram") {
      const handle = socialHandle(value);
      return handle ? `https://instagram.com/${handle}` : "";
    }
    if (link.kind === "facebook") {
      const handle = socialHandle(value);
      return handle ? `https://facebook.com/${handle}` : "";
    }
    if (link.kind === "website" || looksLikeWebUrl(value)) return `https://${value}`;
    return "";
  }

  function socialHandle(value) {
    return String(value || "")
      .trim()
      .replace(/^@/, "")
      .replace(/^(?:https?:\/\/)?(?:www\.)?(?:instagram|facebook)\.com\//i, "")
      .split(/[/?#]/)[0]
      .trim();
  }

  function looksLikeWebUrl(value) {
    return /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(value);
  }

  async function savePrivateNote(trainerId, note) {
    const request = notePatchRequest(trainerId, note);
    await ensureOk(await fetch(request.url, request.init));
    await loadBook();
    render(tr("trainers.note_saved"));
  }

  async function deleteTrainerContact(trainerId) {
    const request = deleteContactRequest(trainerId);
    await ensureOk(await fetch(request.url, request.init));
    await loadBook();
    render(tr("trainers.contact_deleted"));
  }

  function wire(root) {
    const form = root.querySelector("[data-trainer-form]");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      void saveOwnCard(cardFromForm(data)).catch((err) => render(tr("trainers.error", { message: err.message })));
    });
    root.querySelector("[data-trainer-export]")?.addEventListener("click", () => {
      void exportFile().catch((err) => render(tr("trainers.error", { message: err.message })));
    });
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
        void savePrivateNote(trainerId, note).catch((err) => render(tr("trainers.error", { message: err.message })));
      });
    }
    for (const button of root.querySelectorAll("[data-trainer-delete]")) {
      button.addEventListener("click", () => {
        const trainerId = button.dataset.trainerId || "";
        const name = button.dataset.trainerName || "ce contact";
        if (!shouldDeleteContact(name)) return;
        void deleteTrainerContact(trainerId).catch((err) => render(tr("trainers.error", { message: err.message })));
      });
    }
  }

  async function exportFile() {
    if (!cachedBook.own_card) {
      render(tr("trainers.create_before_export"));
      return;
    }
    if (!window.PokevaultBadges?.state && typeof window.PokevaultBadges?.poll === "function") {
      await window.PokevaultBadges.poll({ silent: true });
    }
    const card = {
      ...cachedBook.own_card,
      badges: sharedBadgesFromState(),
      updated_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(card, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilePart(card.display_name)}-pokevault-trainer.json`;
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
          if (!card) throw new Error(tr("trainers.invalid_card"));
          void importCard(card).catch((err) => render(tr("trainers.error", { message: err.message })));
        } catch (err) {
          render(tr("trainers.invalid_file", { message: err.message }));
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
      render(tr("trainers.api_error", { message: err.message }));
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
    if (!value) return tr("trainers.unknown_date");
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
      normalizeBadges,
      sharedBadgesFromState,
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
  window.PokevaultI18n?.subscribeLocale?.(() => {
    if (started) render();
  });
})();
