/**
 * Pokevault — Pokémon drawer (roadmap F02).
 *
 * Right-side drawer that slides in when the user opens a Pokémon fiche:
 * - quick Pokédex identity (sprite, number, name, types, region, form);
 * - Pokédex status shortcuts (cycle state, toggle shiny);
 * - « Mes cartes (N) » list (inline delete + CRUD-friendly rows);
 * - « + Ajouter une carte » mini-form (POST /api/cards).
 *
 * Accessibility: role=dialog, aria-modal, aria-labelledby, focus trap on
 * Tab cycling, Esc closes, click on scrim closes, focus returns to the
 * originating tile. Deep link: ``#/liste?slug=0025-pikachu``.
 */
(function initDrawer() {
  "use strict";

  const API_BASE = "/api/cards";
  const TCG_SEARCH_API = "/api/tcg/cards/search";
  const CONDITIONS = [
    { id: "mint", label: "Mint" },
    { id: "near_mint", label: "Near mint" },
    { id: "excellent", label: "Excellent" },
    { id: "good", label: "Good" },
    { id: "played", label: "Played" },
    { id: "poor", label: "Poor" },
  ];
  const CONDITION_LABELS = Object.fromEntries(
    CONDITIONS.map((c) => [c.id, c.label]),
  );

  /** @type {HTMLElement | null} */ let rootEl = null;
  /** @type {HTMLElement | null} */ let panelEl = null;
  /** @type {HTMLElement | null} */ let contentEl = null;
  /** @type {HTMLElement | null} */ let statusMsgEl = null;
  /** @type {HTMLButtonElement | null} */ let closeBtn = null;
  /** @type {Element | null} */ let lastTrigger = null;
  /** @type {string | null} */ let currentSlug = null;
  /** @type {Map<string, Array<object>>} */ const cardsCache = new Map();
  /** @type {{cards: number, sets: number} | null} */ let summaryCache = null;
  /** @type {Promise<object> | null} */ let summaryPromise = null;
  let huntsSubscribed = false;
  let trainerContactsSubscribed = false;

  function ensureMarkup() {
    if (rootEl) return;
    rootEl = document.getElementById("pokemonDrawer");
    if (!rootEl) return;
    panelEl = rootEl.querySelector(".drawer__panel");
    contentEl = rootEl.querySelector("#pokemonDrawerContent");
    statusMsgEl = rootEl.querySelector("#pokemonDrawerStatus");
    closeBtn = rootEl.querySelector("#pokemonDrawerClose");
    const scrim = rootEl.querySelector(".drawer__scrim");
    if (closeBtn) closeBtn.addEventListener("click", () => close());
    if (scrim) scrim.addEventListener("click", () => close());
    rootEl.addEventListener("keydown", onKeydown);
    if (!huntsSubscribed) {
      huntsSubscribed = true;
      window.PokevaultHunts?.subscribe?.(() => {
        if (currentSlug) renderAll();
      });
    }
    if (!trainerContactsSubscribed) {
      trainerContactsSubscribed = true;
      window.PokevaultTrainerContacts?.subscribe?.(() => {
        if (currentSlug) renderAll();
      });
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !panelEl) return;
    const focusables = Array.from(
      panelEl.querySelectorAll(
        "a[href], button:not([disabled]), input:not([disabled])," +
          "select:not([disabled]), textarea:not([disabled])," +
          "[tabindex]:not([tabindex='-1'])",
      ),
    ).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function findPokemon(slug) {
    const all = window.PokedexCollection?.allPokemon || [];
    for (const p of all) {
      const key = String(p.slug || p.name_fr || p.number || "");
      if (key === slug) return p;
    }
    return null;
  }

  function ficheHelpers() {
    return window.PokevaultPokemonFiche || {};
  }

  function createDrawerSection(id, title) {
    const helper = ficheHelpers();
    if (typeof helper.createFicheSection === "function") {
      return helper.createFicheSection({
        id,
        title,
        headingLevel: 3,
        className: "drawer-section",
        headingClassName: "drawer-section__title",
      });
    }
    const section = document.createElement("section");
    section.className = "drawer-section";
    section.dataset.section = id;
    const h = document.createElement("h3");
    h.className = "drawer-section__title";
    h.textContent = title;
    section.append(h);
    return section;
  }

  function decorateFicheSection(element, id, options = {}) {
    const helper = ficheHelpers();
    if (typeof helper.decorateFicheSection === "function") {
      return helper.decorateFicheSection(element, id, options);
    }
    element.dataset.section = id;
    return element;
  }

  function displayName(p) {
    const helper = ficheHelpers();
    if (typeof helper.displayName === "function") return helper.displayName(p);
    const n = p?.names || {};
    return n.fr || n.en || p?.name_fr || p?.slug || "Inconnu";
  }

  function subtitleName(p) {
    const helper = ficheHelpers();
    if (typeof helper.subtitleName === "function") return helper.subtitleName(p);
    const n = p?.names || {};
    return n.en || p?.name_en || "";
  }

  function normalizeImgPath(img) {
    const helper = ficheHelpers();
    if (typeof helper.normalizeImgPath === "function") return helper.normalizeImgPath(img);
    if (!img) return null;
    const s = String(img).replace(/^\.\//, "");
    if (s.startsWith("http")) return s;
    return s.startsWith("/") ? s : `/${s}`;
  }

  function displayNumber(num) {
    const helper = ficheHelpers();
    if (typeof helper.displayNumber === "function") return helper.displayNumber(num);
    if (!num) return "—";
    const s = String(num);
    return s.startsWith("#") ? s : `#${s}`;
  }

  function statusLabel(status) {
    const helper = ficheHelpers();
    if (typeof helper.statusLabel === "function") return helper.statusLabel(status);
    return status.state === "caught"
      ? status.shiny ? "Attrapé shiny" : "Attrapé"
      : status.state === "seen" ? "Aperçu" : "Non rencontré";
  }

  function ownershipState(slug) {
    const collection = window.PokedexCollection;
    if (typeof collection?.ownershipStateForSlug === "function") {
      return collection.ownershipStateForSlug(slug);
    }
    const helper = ficheHelpers();
    if (typeof helper.ownershipStateFromSources === "function") {
      return helper.ownershipStateFromSources(slug, {
        status: collection?.getStatus?.(slug),
        wanted: Boolean(window.PokevaultHunts?.isWanted?.(slug)),
        ownCard: window.PokevaultTrainerContacts?.getOwnCard?.() || null,
      });
    }
    const status = collection?.getStatus?.(slug) || { state: "not_met" };
    return { wanted: false, caught: status.state === "caught", duplicate: false };
  }

  function tradeSummary(slug) {
    try {
      return window.PokedexCollection?.tradeSummaryForSlug?.(slug)
        || window.PokevaultTrainerContacts?.tradeSummary?.(slug)
        || { availableFrom: [], wantedBy: [], matchCount: 0, canHelpCount: 0 };
    } catch {
      return { availableFrom: [], wantedBy: [], matchCount: 0, canHelpCount: 0 };
    }
  }

  function formatNameList(names) {
    const clean = (Array.isArray(names) ? names : []).filter(Boolean);
    if (!clean.length) return "";
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} et ${clean[1]}`;
    return `${clean.slice(0, 2).join(", ")} +${clean.length - 2}`;
  }

  function buildExchangeContext(slug) {
    const summary = tradeSummary(slug);
    if (!summary.availableFrom.length && !summary.wantedBy.length) return null;
    const box = document.createElement("div");
    box.className = "pokemon-exchange-context";
    if (summary.matchCount > 0) {
      const line = document.createElement("p");
      line.textContent = `Match possible avec ${formatNameList(summary.availableFrom)}.`;
      box.append(line);
    } else if (summary.availableFrom.length > 0) {
      const line = document.createElement("p");
      line.textContent = `Vu chez ${formatNameList(summary.availableFrom)}.`;
      box.append(line);
    }
    if (summary.canHelpCount > 0) {
      const line = document.createElement("p");
      line.textContent = `${formatNameList(summary.wantedBy)} cherche ce Pokémon.`;
      box.append(line);
    }
    return box;
  }

  function findForms(pokemon) {
    const helper = ficheHelpers();
    const all = window.PokedexCollection?.allPokemon || [];
    if (typeof helper.findForms === "function") return helper.findForms(pokemon, all);
    const number = String(pokemon?.number || "");
    if (!number) return [];
    return all.filter(
      (p) => String(p?.number || "") === number && (p?.slug || "") !== pokemon.slug,
    );
  }

  function listReturnHash() {
    const helper = ficheHelpers();
    if (typeof helper.listReturnHash === "function") {
      return helper.listReturnHash(location.hash || "");
    }
    return "#/liste";
  }

  function pokemonRouteHref(slug) {
    const helper = ficheHelpers();
    if (typeof helper.pokemonRouteHref === "function") {
      return helper.pokemonRouteHref(slug, listReturnHash());
    }
    return `#/pokemon/${encodeURIComponent(slug)}`;
  }

  async function fetchCards(slug) {
    if (cardsCache.has(slug)) return cardsCache.get(slug) || [];
    try {
      const r = await fetch(
        `${API_BASE}/by-pokemon/${encodeURIComponent(slug)}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json();
      const cards = Array.isArray(body?.cards) ? body.cards : [];
      cardsCache.set(slug, cards);
      return cards;
    } catch (err) {
      console.error("drawer: fetchCards failed", err);
      return [];
    }
  }

  function clearCache(slug) {
    if (slug) cardsCache.delete(slug);
    else cardsCache.clear();
    summaryCache = null;
  }

  function notify(message, kind = "info") {
    if (!statusMsgEl) return;
    statusMsgEl.textContent = message || "";
    statusMsgEl.dataset.kind = kind;
    if (!message) return;
    window.setTimeout(() => {
      if (statusMsgEl && statusMsgEl.textContent === message) {
        statusMsgEl.textContent = "";
        delete statusMsgEl.dataset.kind;
      }
    }, 2500);
  }

  function buildCardRow(card) {
    const row = document.createElement("li");
    row.className = "drawer-card-row";
    row.dataset.cardId = card.id;

    const main = document.createElement("div");
    main.className = "drawer-card-row__main";
    const line1 = document.createElement("div");
    line1.className = "drawer-card-row__line1";
    const setPart = card.set_id || "—";
    const numPart = card.num ? ` · ${card.num}` : "";
    line1.textContent = `${setPart}${numPart}`;
    main.append(line1);
    const line2 = document.createElement("div");
    line2.className = "drawer-card-row__line2";
    const parts = [];
    if (card.variant) parts.push(card.variant);
    if (card.lang) parts.push(card.lang.toUpperCase());
    parts.push(CONDITION_LABELS[card.condition] || card.condition || "—");
    parts.push(`×${card.qty}`);
    line2.textContent = parts.join(" · ");
    main.append(line2);
    if (card.note) {
      const note = document.createElement("div");
      note.className = "drawer-card-row__note";
      note.textContent = card.note;
      main.append(note);
    }
    row.append(main);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "drawer-card-row__delete";
    del.textContent = "Supprimer";
    del.setAttribute("aria-label", `Supprimer la carte ${setPart}${numPart}`);
    del.addEventListener("click", () => onDeleteCard(card.id, row));
    row.append(del);

    return row;
  }

  async function onDeleteCard(cardId, rowEl) {
    if (!cardId || !currentSlug) return;
    try {
      const r = await fetch(`${API_BASE}/${encodeURIComponent(cardId)}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      clearCache(currentSlug);
      if (rowEl && rowEl.parentElement) rowEl.parentElement.removeChild(rowEl);
      notify("Carte retirée.", "info");
      await renderCardList();
      emitCardsChanged();
    } catch (err) {
      console.error("drawer: delete failed", err);
      notify("Suppression impossible.", "error");
    }
  }

  function emitCardsChanged() {
    try {
      document.dispatchEvent(
        new CustomEvent("pokevault:cards-changed", {
          detail: { slug: currentSlug || null },
        }),
      );
    } catch {
      /* CustomEvent unsupported — best effort only */
    }
  }

  async function renderCardList() {
    if (!currentSlug || !contentEl) return;
    const cards = await fetchCards(currentSlug);
    const listEl = contentEl.querySelector("#drawerCardList");
    const counterEl = contentEl.querySelector("#drawerCardCount");
    const emptyEl = contentEl.querySelector("#drawerCardEmpty");
    if (!listEl || !counterEl) return;
    listEl.replaceChildren();
    counterEl.textContent = String(cards.length);
    if (!cards.length) {
      if (emptyEl) emptyEl.hidden = false;
      listEl.hidden = true;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    listEl.hidden = false;
    for (const card of cards) listEl.append(buildCardRow(card));
  }

  function makeField(labelText, input) {
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(span, input);
    return label;
  }

  function buildAddForm() {
    const form = document.createElement("form");
    form.className = "drawer-add-form";
    form.id = "drawerAddCardForm";

    const tcgIdInput = document.createElement("input");
    tcgIdInput.type = "hidden";
    tcgIdInput.name = "tcg_api_id";
    form.append(tcgIdInput);

    const imageInput = document.createElement("input");
    imageInput.type = "hidden";
    imageInput.name = "image_url";
    form.append(imageInput);

    form.append(buildTcgSearchBlock(form));

    const grid = document.createElement("div");
    grid.className = "drawer-add-form__grid";

    const setInput = document.createElement("input");
    setInput.type = "text";
    setInput.name = "set_id";
    setInput.autocomplete = "off";
    grid.append(makeField("Set", setInput));

    const numInput = document.createElement("input");
    numInput.type = "text";
    numInput.name = "num";
    numInput.autocomplete = "off";
    grid.append(makeField("Numéro", numInput));

    const variantInput = document.createElement("input");
    variantInput.type = "text";
    variantInput.name = "variant";
    variantInput.autocomplete = "off";
    variantInput.placeholder = "holo, reverse, alt…";
    grid.append(makeField("Variante", variantInput));

    const langInput = document.createElement("input");
    langInput.type = "text";
    langInput.name = "lang";
    langInput.autocomplete = "off";
    langInput.maxLength = 5;
    langInput.placeholder = "fr";
    grid.append(makeField("Langue", langInput));

    const condSel = document.createElement("select");
    condSel.name = "condition";
    for (const c of CONDITIONS) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      if (c.id === "near_mint") opt.selected = true;
      condSel.append(opt);
    }
    grid.append(makeField("Condition", condSel));

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.name = "qty";
    qtyInput.min = "1";
    qtyInput.value = "1";
    grid.append(makeField("Quantité", qtyInput));

    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.name = "note";
    noteInput.autocomplete = "off";
    const noteLabel = makeField("Note", noteInput);
    noteLabel.classList.add("drawer-add-form__note");
    grid.append(noteLabel);

    form.append(grid);

    const actions = document.createElement("div");
    actions.className = "drawer-add-form__actions";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "drawer-add-form__submit";
    submit.textContent = "Ajouter la carte";
    actions.append(submit);
    form.append(actions);

    form.addEventListener("submit", onSubmitAddCard);
    return form;
  }

  function buildTcgSearchBlock(form) {
    const wrap = document.createElement("div");
    wrap.className = "drawer-tcg-search";

    const label = document.createElement("label");
    label.className = "drawer-tcg-search__label";
    const labelText = document.createElement("span");
    labelText.textContent = "Catalogue TCG";
    const row = document.createElement("div");
    row.className = "drawer-tcg-search__row";

    const input = document.createElement("input");
    input.type = "search";
    input.autocomplete = "off";
    input.placeholder = "Nom anglais";
    input.value = defaultTcgSearchQuery();
    row.append(input);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Chercher";
    row.append(button);

    label.append(labelText, row);
    wrap.append(label);

    const status = document.createElement("div");
    status.className = "drawer-tcg-search__status";
    wrap.append(status);

    const results = document.createElement("div");
    results.className = "drawer-tcg-results";
    wrap.append(results);

    async function runSearch() {
      const query = input.value.trim();
      if (!query) {
        results.replaceChildren();
        status.textContent = "Entre un nom de carte.";
        return;
      }
      button.disabled = true;
      status.textContent = "Recherche...";
      try {
        const params = new URLSearchParams({ q: query, page_size: "8" });
        const response = await fetch(`${TCG_SEARCH_API}?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        const cards = Array.isArray(body?.cards) ? body.cards : [];
        renderTcgResults(cards, form, results, status);
      } catch (err) {
        console.error("drawer: tcg search failed", err);
        results.replaceChildren();
        status.textContent = "Recherche catalogue indisponible.";
      } finally {
        button.disabled = false;
      }
    }

    button.addEventListener("click", () => {
      void runSearch();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void runSearch();
    });

    return wrap;
  }

  function defaultTcgSearchQuery() {
    if (!currentSlug) return "";
    const pokemon = findPokemon(currentSlug);
    return subtitleName(pokemon) || pokemon?.name_en || displayName(pokemon);
  }

  function renderTcgResults(cards, form, resultsEl, statusEl) {
    resultsEl.replaceChildren();
    if (!cards.length) {
      statusEl.textContent = "Aucun resultat.";
      return;
    }
    statusEl.textContent = `${cards.length} resultat${cards.length > 1 ? "s" : ""}.`;
    for (const card of cards) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "drawer-tcg-result";
      const imageUrl = card.small_image_url || card.large_image_url || "";
      if (imageUrl) {
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = "";
        img.loading = "lazy";
        item.append(img);
      }
      const meta = document.createElement("span");
      meta.className = "drawer-tcg-result__meta";
      const title = document.createElement("strong");
      title.textContent = card.name || "Carte sans nom";
      const details = document.createElement("span");
      const detailParts = [];
      if (card.set_name) detailParts.push(card.set_name);
      if (card.number) detailParts.push(`#${card.number}`);
      if (card.rarity) detailParts.push(card.rarity);
      details.textContent = detailParts.join(" · ");
      meta.append(title, details);
      item.append(meta);
      item.addEventListener("click", () => {
        applyTcgCardToForm(form, card);
        notify("Carte TCG selectionnee.", "ok");
      });
      resultsEl.append(item);
    }
  }

  function applyTcgCardToForm(form, card) {
    const elements = form?.elements || {};
    setFormElementValue(elements.tcg_api_id, card?.id || "");
    setFormElementValue(elements.set_id, card?.set_id || "");
    setFormElementValue(elements.num, card?.number || "");
    setFormElementValue(elements.variant, card?.rarity || "");
    setFormElementValue(
      elements.image_url,
      card?.large_image_url || card?.small_image_url || "",
    );
  }

  function setFormElementValue(element, value) {
    if (!element) return;
    element.value = String(value || "");
  }

  function payloadFromFormData(fd, slug) {
    return {
      pokemon_slug: slug,
      set_id: String(fd.get("set_id") || "").trim(),
      num: String(fd.get("num") || "").trim(),
      variant: String(fd.get("variant") || "").trim(),
      lang: String(fd.get("lang") || "").trim(),
      condition: String(fd.get("condition") || "near_mint"),
      qty: Math.max(1, Number(fd.get("qty") || 1) | 0),
      acquired_at: null,
      note: String(fd.get("note") || "").trim(),
      image_url: String(fd.get("image_url") || "").trim(),
      tcg_api_id: String(fd.get("tcg_api_id") || "").trim(),
    };
  }

  async function onSubmitAddCard(event) {
    event.preventDefault();
    if (!currentSlug) return;
    const form = event.currentTarget;
    const fd = new FormData(form);
    const payload = payloadFromFormData(fd, currentSlug);
    try {
      const r = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      clearCache(currentSlug);
      form.reset();
      notify("Carte ajoutée — Pokédex marqué capturé.", "ok");
      await renderCardList();
      if (typeof window.PokedexCollection?.setStatus === "function") {
        window.PokedexCollection.setStatus(currentSlug, "caught");
      }
      emitCardsChanged();
    } catch (err) {
      console.error("drawer: create failed", err);
      notify("Ajout impossible.", "error");
    }
  }

  function buildHeader(p) {
    const header = document.createElement("section");
    header.className = "drawer-header";
    decorateFicheSection(header, "identity");
    const imgWrap = document.createElement("div");
    imgWrap.className = "drawer-header__img";
    const src = normalizeImgPath(p?.image);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      imgWrap.append(img);
    }
    header.append(imgWrap);

    const meta = document.createElement("div");
    meta.className = "drawer-header__meta";
    const num = document.createElement("div");
    num.className = "drawer-header__num";
    num.textContent = displayNumber(p?.number);
    const name = document.createElement("h2");
    name.className = "drawer-header__name";
    name.id = "pokemonDrawerTitle";
    name.textContent = displayName(p);
    const subtitle = document.createElement("div");
    subtitle.className = "drawer-header__subtitle";
    const subParts = [];
    const en = subtitleName(p);
    if (en) subParts.push(en);
    if (p?.form) subParts.push(p.form);
    subtitle.textContent = subParts.join(" · ");
    const types = document.createElement("div");
    types.className = "drawer-header__types";
    const tList = Array.isArray(p?.types) ? p.types.filter(Boolean) : [];
    for (const t of tList) {
      const b = document.createElement("span");
      b.className = "drawer-type-badge";
      b.textContent = String(t);
      types.append(b);
    }
    const region = document.createElement("div");
    region.className = "drawer-header__region";
    region.textContent = p?.region_label_fr || p?.region || "—";

    meta.append(num, name);
    if (subtitle.textContent) meta.append(subtitle);
    if (tList.length) meta.append(types);
    meta.append(region);
    const link = document.createElement("a");
    link.className = "drawer-header__full-link";
    link.href = pokemonRouteHref(p?.slug || currentSlug || "");
    link.textContent = "Voir fiche complète →";
    link.addEventListener("click", () => close());
    meta.append(link);
    header.append(meta);
    return header;
  }

  function buildStatusSection(slug) {
    const section = createDrawerSection("pokedex_status", "Statut Pokédex");
    const status =
      window.PokedexCollection?.getStatus?.(slug) || { state: "not_met", shiny: false };
    const ownership = ownershipState(slug);
    const label = document.createElement("span");
    label.className = "drawer-status-row__label";
    label.textContent = ficheHelpers().ownershipLabel?.(ownership) || statusLabel(status);
    label.dataset.state = ownership.duplicate
      ? "duplicate"
      : ownership.wanted
        ? "wanted"
        : ownership.caught
          ? "owned"
          : "none";
    section.append(label);

    const helper = ficheHelpers();
    if (typeof helper.createOwnershipActions === "function") {
      section.append(helper.createOwnershipActions(ownership, async (next) => {
        await window.PokedexCollection?.setPokemonOwnershipState?.(slug, next);
        renderAll();
      }));
    }
    if (status.state === "seen") {
      const legacy = document.createElement("p");
      legacy.className = "pokemon-status-legacy";
      legacy.textContent = "Vu manuel existant; les prochains statuts passent par Cherche, J'ai ou Double.";
      section.append(legacy);
    }
    const exchange = buildExchangeContext(slug);
    if (exchange) section.append(exchange);

    return section;
  }

  function refreshStatus(slug) {
    if (!contentEl || !currentSlug || currentSlug !== slug) return;
    const section = contentEl.querySelector("[data-section='pokedex_status']");
    if (!section) return;
    const newSection = buildStatusSection(slug);
    section.replaceWith(newSection);
  }

  function buildFormsSection(pokemon) {
    const section = createDrawerSection("forms", "Formes");
    const helper = ficheHelpers();
    const all = window.PokedexCollection?.allPokemon || [];
    const entries = typeof helper.buildFormEntries === "function"
      ? helper.buildFormEntries(pokemon, all, (slug) => window.PokedexCollection?.getStatus?.(slug))
      : [pokemon, ...findForms(pokemon)].filter(Boolean).map((form) => {
          const status = window.PokedexCollection?.getStatus?.(form.slug) || {
            state: "not_met",
            shiny: false,
          };
          return {
            pokemon: form,
            slug: form.slug,
            label: form.form || displayName(form),
            current: form.slug === pokemon?.slug,
            status,
            statusLabel: statusLabel(status),
          };
        });
    if (entries.length <= 1) {
      const empty = document.createElement("p");
      empty.className = "drawer-empty";
      empty.textContent = "Aucune autre forme dans le Pokédex local.";
      section.append(empty);
      return section;
    }
    const list = document.createElement("div");
    list.className = "drawer-forms-list";
    for (const entry of entries) {
      const link = document.createElement("a");
      link.className = "drawer-form-link";
      link.href = pokemonRouteHref(entry.slug);
      link.dataset.current = entry.current ? "true" : "false";
      if (entry.current) link.setAttribute("aria-current", "page");
      const label = document.createElement("span");
      label.className = "drawer-form-link__label";
      label.textContent = entry.label;
      const status = document.createElement("span");
      status.className = "drawer-form-link__status";
      status.dataset.state = entry.status.state;
      if (entry.status.shiny) status.dataset.shiny = "true";
      status.textContent = entry.statusLabel;
      link.append(label, status);
      link.addEventListener("click", () => close());
      list.append(link);
    }
    section.append(list);
    return section;
  }

  function buildProgressSection(slug) {
    const section = createDrawerSection("personal_progress", "Progression personnelle");
    const entry = window.PokevaultHunts?.entry?.(slug);
    const row = document.createElement("div");
    row.className = "drawer-status-row";

    const label = document.createElement("span");
    label.className = "drawer-status-row__label";
    label.textContent = entry
      ? entry.priority === "high" ? "Priorite haute" : "Recherche active"
      : "Active Cherche pour l'ajouter au focus.";
    row.append(label);

    const priority = document.createElement("button");
    priority.type = "button";
    priority.className = "drawer-status-row__btn";
    priority.textContent = entry?.priority === "high" ? "Priorite normale" : "Priorite haute";
    priority.disabled = !entry;
    priority.addEventListener("click", async () => {
      await patchHunt(slug, {
        wanted: true,
        priority: entry?.priority === "high" ? "normal" : "high",
        note: entry?.note || "",
      });
    });
    row.append(priority);
    section.append(row);
    return section;
  }

  function buildNotesSection(slug) {
    const section = createDrawerSection("notes", "Notes");
    const note = window.PokedexCollection?.getNote?.(slug) || "";
    const helper = ficheHelpers();
    if (typeof helper.createNoteEditor === "function") {
      section.append(helper.createNoteEditor(note, async (text) => {
        await window.PokedexCollection?.setNote?.(slug, text);
        notify(text ? "Note sauvegardée." : "Note supprimée.", "ok");
      }));
    }
    return section;
  }

  async function patchHunt(slug, body) {
    try {
      await window.PokevaultHunts?.patch?.(slug, body);
      notify("Recherche mise a jour.", "ok");
    } catch (err) {
      console.error("drawer: hunt patch failed", err);
      notify("Recherche impossible a modifier.", "error");
    }
  }

  function buildCardsSection() {
    const section = createDrawerSection("cards", "Mes cartes");
    section.classList?.add?.("is-secondary");
    let title = section.querySelector?.(".drawer-section__title")
      || section.querySelector?.(".pokemon-fiche-section__title");
    if (!title) {
      title = document.createElement("h3");
      title.className = "drawer-section__title";
      section.append(title);
    }
    title.textContent = "Mes cartes (";
    const counter = document.createElement("span");
    counter.id = "drawerCardCount";
    counter.textContent = "0";
    title.append(counter, document.createTextNode(")"));
    const helper = ficheHelpers();
    const body = typeof helper.createCollapsibleBody === "function"
      ? helper.createCollapsibleBody(section, {
          collapsed: true,
          bodyClassName: "drawer-cards-body",
        })
      : section;

    const empty = document.createElement("p");
    empty.id = "drawerCardEmpty";
    empty.className = "drawer-empty";
    empty.textContent = "Aucune carte pour l'instant. Ajoute la première ci-dessous.";
    body.append(empty);

    const list = document.createElement("ul");
    list.id = "drawerCardList";
    list.className = "drawer-card-list";
    list.hidden = true;
    body.append(list);

    body.append(buildAddForm());
    return section;
  }

  function renderAll() {
    if (!contentEl || !currentSlug) return;
    const p = findPokemon(currentSlug);
    contentEl.replaceChildren();
    if (!p) {
      const miss = document.createElement("p");
      miss.className = "drawer-empty";
      miss.textContent = "Pokémon inconnu dans le Pokédex local.";
      contentEl.append(miss);
      return;
    }
    contentEl.append(
      buildHeader(p),
      buildStatusSection(currentSlug),
      buildFormsSection(p),
      buildProgressSection(currentSlug),
      buildNotesSection(currentSlug),
      buildCardsSection(),
    );
    void renderCardList();
  }

  function writeSlugToHash(slug) {
    const hash = location.hash || "#/liste";
    const [viewPart, queryPart = ""] = hash.slice(1).split("?");
    const params = new URLSearchParams(queryPart);
    if (slug) params.set("slug", slug);
    else params.delete("slug");
    const qs = params.toString();
    const next = `#${viewPart}${qs ? `?${qs}` : ""}`;
    if (location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }

  function open(slug, trigger) {
    ensureMarkup();
    if (!rootEl || !panelEl) return;
    currentSlug = slug;
    lastTrigger = trigger || document.activeElement;
    rootEl.hidden = false;
    rootEl.classList.add("is-open");
    document.body.classList.add("drawer-open");
    renderAll();
    writeSlugToHash(slug);
    window.setTimeout(() => {
      if (closeBtn) closeBtn.focus();
    }, 10);
  }

  function close() {
    if (!rootEl) return;
    rootEl.classList.remove("is-open");
    rootEl.hidden = true;
    document.body.classList.remove("drawer-open");
    currentSlug = null;
    writeSlugToHash(null);
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  function syncFromHash() {
    const hash = location.hash || "";
    const q = hash.indexOf("?");
    if (q < 0) {
      if (rootEl && !rootEl.hidden) close();
      return;
    }
    const params = new URLSearchParams(hash.slice(q + 1));
    const slug = params.get("slug");
    if (!slug) {
      if (rootEl && !rootEl.hidden) close();
      return;
    }
    if (slug !== currentSlug) open(slug, null);
  }

  window.addEventListener("hashchange", syncFromHash);
  document.addEventListener("DOMContentLoaded", () => {
    ensureMarkup();
    syncFromHash();
  });

  async function refreshSummary() {
    try {
      const r = await fetch(API_BASE);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json();
      const list = Array.isArray(body?.cards) ? body.cards : [];
      let total = 0;
      const sets = new Set();
      for (const c of list) {
        const qty = Number(c?.qty);
        total += Number.isFinite(qty) && qty > 0 ? qty : 0;
        if (c?.set_id) sets.add(String(c.set_id));
      }
      summaryCache = { cards: total, sets: sets.size };
    } catch (err) {
      console.error("drawer: summary failed", err);
      summaryCache = { cards: 0, sets: 0 };
    }
    return summaryCache;
  }

  function summary() {
    if (summaryCache) return summaryCache;
    if (!summaryPromise) {
      summaryPromise = refreshSummary().finally(() => {
        summaryPromise = null;
      });
    }
    return { cards: 0, sets: 0 };
  }

  window.PokevaultCards = {
    summary,
    refresh: refreshSummary,
  };

  const drawerApi = { open, close, clearCache };
  if (window.__POKEVAULT_DRAWER_TESTS__) {
    drawerApi._test = {
      applyTcgCardToForm,
      buildCardsSection,
      payloadFromFormData,
    };
  }
  window.PokevaultDrawer = drawerApi;
})();
