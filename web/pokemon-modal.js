/**
 * Pokevault — single Pokemon modal.
 *
 * One fiche surface is used from the grid, keyboard shortcuts and legacy
 * ``#/pokemon/:slug`` hashes. ``PokevaultDrawer`` remains an alias so older
 * call sites keep opening the same modal.
 */
(function initPokemonModal() {
  "use strict";

  const FALLBACK_I18N = {
    "pokemon_modal.name_and": "et",
    "pokemon_modal.close": "Fermer la fiche",
    "pokemon_modal.forms_empty": "Aucune autre forme dans le Pokédex local.",
    "pokemon_modal.note.empty": "Aucune note personnelle pour l'instant.",
    "pokemon_modal.defense": "Efficacité défensive",
    "pokemon_modal.weaknesses": "Faiblesses",
    "pokemon_modal.resistances": "Résistances",
    "pokemon_modal.immunities": "Immunités",
    "pokemon_modal.game_pokedexes": "Pokédex des jeux",
    "pokemon_modal.game_pokedexes_empty": "Aucune apparition de jeu référencée pour l'instant.",
    "pokemon_modal.unknown": "Pokémon inconnu dans le Pokédex local.",
  };

  /** @type {HTMLElement | null} */ let rootEl = null;
  /** @type {HTMLElement | null} */ let panelEl = null;
  /** @type {HTMLElement | null} */ let contentEl = null;
  /** @type {HTMLElement | null} */ let statusMsgEl = null;
  /** @type {Element | null} */ let lastTrigger = null;
  /** @type {string | null} */ let currentSlug = null;
  /** @type {object | null} */ let gamePokedexes = window.PokevaultGamePokedexes || null;
  /** @type {Promise<object | null> | null} */ let gamePokedexesPromise = null;

  function t(key, params = {}) {
    const runtime = window.PokevaultI18n;
    if (runtime?.t) return runtime.t(key, params);
    const template = FALLBACK_I18N[key] || key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
    );
  }

  function ficheHelpers() {
    return window.PokevaultPokemonFiche || {};
  }

  function ensureMarkup() {
    if (rootEl) return true;
    rootEl = document.getElementById("pokemonModal") || document.getElementById("pokemonDrawer");
    if (!rootEl) return false;
    panelEl = rootEl.querySelector(".pokemon-modal__panel");
    contentEl = document.getElementById("pokemonModalContent")
      || rootEl.querySelector("#pokemonDrawerContent")
      || rootEl.querySelector(".pokemon-modal__content");
    statusMsgEl = document.getElementById("pokemonModalStatus")
      || rootEl.querySelector("#pokemonDrawerStatus")
      || rootEl.querySelector(".pokemon-modal__status-message");
    const closeBtn = document.getElementById("pokemonModalClose")
      || rootEl.querySelector("#pokemonDrawerClose")
      || rootEl.querySelector(".pokemon-modal__close");
    const scrim = rootEl.querySelector(".pokemon-modal__scrim");
    closeBtn?.addEventListener?.("click", () => close());
    scrim?.addEventListener?.("click", () => close());
    rootEl.addEventListener?.("keydown", onKeydown);
    window.PokevaultArtwork?.subscribe?.(() => {
      if (currentSlug) render(currentSlug);
    });
    window.PokevaultI18n?.subscribeLocale?.(() => {
      if (currentSlug) render(currentSlug);
    });
    window.PokevaultTrainerContacts?.subscribe?.(() => {
      if (currentSlug) render(currentSlug);
    });
    return true;
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  }

  function findPokemon(slug) {
    const all = window.PokedexCollection?.allPokemon || [];
    return all.find((p) => String(p?.slug || "") === String(slug || "")) || null;
  }

  function displayName(pokemon) {
    const helper = ficheHelpers();
    if (typeof helper.displayName === "function") return helper.displayName(pokemon);
    const names = pokemon?.names || {};
    return names.fr || names.en || pokemon?.name_fr || pokemon?.slug || "Inconnu";
  }

  function subtitleName(pokemon) {
    const helper = ficheHelpers();
    if (typeof helper.subtitleName === "function") return helper.subtitleName(pokemon);
    const names = pokemon?.names || {};
    return names.en || pokemon?.name_en || "";
  }

  function displayNumber(number) {
    const helper = ficheHelpers();
    if (typeof helper.displayNumber === "function") return helper.displayNumber(number, { compact: true, blank: "#—" });
    if (!number) return "#—";
    return `#${String(number).replace(/^#/, "").replace(/^0+/, "") || "0"}`;
  }

  function normalizeImgPath(img) {
    const helper = ficheHelpers();
    if (typeof helper.normalizeImgPath === "function") return helper.normalizeImgPath(img);
    if (!img) return null;
    const path = String(img).replace(/^\.\//, "");
    if (path.startsWith("http")) return path;
    return path.startsWith("/") ? path : `/${path}`;
  }

  function attachPokemonArtwork(img, pokemon) {
    const artwork = window.PokevaultArtwork;
    if (typeof artwork?.resolve === "function") {
      const resolved = artwork.resolve(pokemon);
      if (resolved?.src) {
        if (typeof artwork.attach === "function") artwork.attach(img, resolved);
        else img.src = resolved.src;
        return true;
      }
    }
    const src = normalizeImgPath(pokemon?.image);
    if (!src) return false;
    img.src = src;
    return true;
  }

  function createSection(id, title, options = {}) {
    const helper = ficheHelpers();
    if (typeof helper.createFicheSection === "function") {
      return helper.createFicheSection({
        id,
        title,
        headingLevel: options.headingLevel || 2,
        className: "pokemon-modal-section",
        headingClassName: "pokemon-modal-section__title",
      });
    }
    const section = document.createElement("section");
    section.className = "pokemon-modal-section";
    section.dataset.section = id;
    if (title) {
      const h = document.createElement(`h${options.headingLevel || 2}`);
      h.className = "pokemon-modal-section__title";
      h.textContent = title;
      section.append(h);
    }
    return section;
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
        ownCard: window.PokevaultTrainerContacts?.getOwnCard?.() || null,
      });
    }
    const status = collection?.getStatus?.(slug) || { state: "not_met" };
    return { caught: status.state === "caught", duplicate: false };
  }

  function buildIdentity(root, pokemon) {
    const section = createSection("identity", "");
    section.className += " pokemon-modal-hero";

    const imgWrap = document.createElement("div");
    imgWrap.className = "pokemon-modal-hero__img";
    const img = document.createElement("img");
    if (attachPokemonArtwork(img, pokemon)) {
      img.alt = displayName(pokemon);
      imgWrap.append(img);
    }
    section.append(imgWrap);

    const meta = document.createElement("div");
    meta.className = "pokemon-modal-hero__meta";
    const number = document.createElement("p");
    number.className = "pokemon-modal-hero__num";
    number.textContent = displayNumber(pokemon.number);
    const title = document.createElement("h2");
    title.className = "pokemon-modal-hero__title";
    title.textContent = displayName(pokemon);
    const subtitle = document.createElement("p");
    subtitle.className = "pokemon-modal-hero__subtitle";
    subtitle.textContent = [subtitleName(pokemon), pokemon.form].filter(Boolean).join(" · ");
    meta.append(number, title);
    if (subtitle.textContent) meta.append(subtitle);

    const types = document.createElement("div");
    types.className = "pokemon-modal-hero__types";
    for (const type of Array.isArray(pokemon.types) ? pokemon.types.filter(Boolean) : []) {
      const badge = document.createElement("span");
      badge.className = "pokemon-modal-type-badge";
      badge.textContent = String(type);
      types.append(badge);
    }
    if (types.children.length) meta.append(types);
    section.append(meta);
    root.append(section);
  }

  function buildStatus(root, pokemon) {
    const section = createSection("pokedex_status");
    const ownership = ownershipState(pokemon.slug);
    const label = document.createElement("span");
    label.className = "pokemon-modal-status-label";
    label.dataset.state = ownership.duplicate ? "duplicate" : ownership.caught ? "owned" : "none";
    label.textContent = ficheHelpers().ownershipLabel?.(ownership)
      || (ownership.duplicate ? "Double" : ownership.caught ? "Capturé" : "Je n'ai pas");
    section.append(label);
    const actions = ficheHelpers().createOwnershipActions?.(ownership, async (next) => {
      await window.PokedexCollection?.setPokemonOwnershipState?.(pokemon.slug, next);
      render(pokemon.slug);
    });
    if (actions) section.append(actions);
    root.append(section);
  }

  function buildForms(root, pokemon) {
    const all = window.PokedexCollection?.allPokemon || [];
    const helper = ficheHelpers();
    const entries = typeof helper.buildFormEntries === "function"
      ? helper.buildFormEntries(pokemon, all, (slug) => window.PokedexCollection?.getStatus?.(slug))
      : [pokemon];
    const section = createSection("forms");
    if (entries.length <= 1) {
      const empty = document.createElement("p");
      empty.className = "pokemon-modal-empty";
      empty.textContent = t("pokemon_modal.forms_empty");
      section.append(empty);
      root.append(section);
      return;
    }
    const list = document.createElement("div");
    list.className = "pokemon-modal-forms";
    for (const entry of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pokemon-modal-form";
      button.dataset.current = entry.current ? "true" : "false";
      button.textContent = entry.label || displayName(entry.pokemon);
      button.addEventListener("click", () => open(entry.slug, button));
      list.append(button);
    }
    section.append(list);
    root.append(section);
  }

  function formatMult(mult) {
    if (mult === 0) return "0×";
    if (mult === 0.25) return "¼×";
    if (mult === 0.5) return "½×";
    if (Number.isInteger(mult)) return `${mult}×`;
    return `${mult}×`;
  }

  function buildTypeMatchups(root, pokemon) {
    const section = createSection("type_matchups", t("pokemon_modal.defense"));
    const chart = window.PokevaultTypeChart;
    const types = Array.isArray(pokemon.types) ? pokemon.types.filter(Boolean) : [];
    if (!chart?.computeWeaknesses || !types.length) {
      const row = document.createElement("div");
      row.className = "pokemon-modal-types";
      for (const type of types) {
        const badge = document.createElement("span");
        badge.className = "pokemon-modal-type-badge";
        badge.textContent = String(type);
        row.append(badge);
      }
      if (!row.children.length) row.textContent = "—";
      section.append(row);
      root.append(section);
      return;
    }
    const groups = [
      { label: t("pokemon_modal.weaknesses"), test: (m) => m > 1 },
      { label: t("pokemon_modal.resistances"), test: (m) => m < 1 && m > 0 },
      { label: t("pokemon_modal.immunities"), test: (m) => m === 0 },
    ];
    const rows = chart.computeWeaknesses(types);
    const wrap = document.createElement("div");
    wrap.className = "pokemon-modal-matchups";
    for (const group of groups) {
      const block = document.createElement("div");
      block.className = "pokemon-modal-matchups__block";
      const title = document.createElement("h3");
      title.textContent = group.label;
      block.append(title);
      const bucket = rows.filter((row) => group.test(row.mult));
      if (!bucket.length) {
        const empty = document.createElement("p");
        empty.textContent = "—";
        block.append(empty);
      } else {
        const list = document.createElement("ul");
        for (const row of bucket) {
          const item = document.createElement("li");
          item.textContent = `${row.type} ${formatMult(row.mult)}`;
          list.append(item);
        }
        block.append(list);
      }
      wrap.append(block);
    }
    section.append(wrap);
    root.append(section);
  }

  function pokedexMap() {
    const payload = gamePokedexes || window.PokevaultGamePokedexes || {};
    const map = new Map();
    for (const entry of Array.isArray(payload.pokedexes) ? payload.pokedexes : []) {
      if (entry?.id) map.set(String(entry.id), entry);
    }
    return map;
  }

  function gamePokedexAppearances(slug) {
    const payload = gamePokedexes || window.PokevaultGamePokedexes || {};
    const ids = Array.isArray(payload.appearances_by_slug?.[slug])
      ? payload.appearances_by_slug[slug]
      : [];
    const map = pokedexMap();
    return ids.map((id) => map.get(String(id))).filter(Boolean);
  }

  function buildGamePokedexes(root, pokemon) {
    const section = createSection("game_pokedexes", t("pokemon_modal.game_pokedexes"));
    const entries = gamePokedexAppearances(pokemon.slug);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "pokemon-modal-empty";
      empty.textContent = t("pokemon_modal.game_pokedexes_empty");
      section.append(empty);
      root.append(section);
      return;
    }
    const list = document.createElement("ul");
    list.className = "pokemon-modal-pokedexes";
    for (const entry of entries) {
      const item = document.createElement("li");
      item.textContent = entry.label_fr || entry.label_en || entry.id;
      list.append(item);
    }
    section.append(list);
    root.append(section);
  }

  function buildNotes(root, pokemon) {
    const section = createSection("notes");
    const note = window.PokedexCollection?.getNote?.(pokemon.slug) || "";
    const editor = ficheHelpers().createNoteEditor?.(note, async (text) => {
      await window.PokedexCollection?.setNote?.(pokemon.slug, text);
    });
    if (editor) section.append(editor);
    else {
      const empty = document.createElement("p");
      empty.className = "pokemon-modal-empty";
      empty.textContent = note || t("pokemon_modal.note.empty");
      section.append(empty);
    }
    root.append(section);
  }

  function renderMissing(root, slug) {
    root.replaceChildren();
    const section = createSection("identity", "");
    const empty = document.createElement("p");
    empty.className = "pokemon-modal-empty";
    empty.textContent = slug ? t("pokemon_modal.unknown") : t("pokemon_modal.unknown");
    section.append(empty);
    root.append(section);
  }

  function renderContent(root, slug) {
    if (!root) return;
    const pokemon = slug ? findPokemon(slug) : null;
    if (!pokemon) {
      renderMissing(root, slug);
      return;
    }
    root.replaceChildren();
    buildIdentity(root, pokemon);
    buildStatus(root, pokemon);
    buildForms(root, pokemon);
    buildTypeMatchups(root, pokemon);
    buildGamePokedexes(root, pokemon);
    buildNotes(root, pokemon);
  }

  async function ensureGamePokedexes() {
    if (gamePokedexes) return gamePokedexes;
    if (gamePokedexesPromise) return gamePokedexesPromise;
    gamePokedexesPromise = fetch("/data/game-pokedexes.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload && typeof payload === "object") {
          gamePokedexes = payload;
          window.PokevaultGamePokedexes = payload;
          if (currentSlug) render(currentSlug);
        }
        return gamePokedexes;
      })
      .catch(() => null);
    return gamePokedexesPromise;
  }

  async function render(slug = currentSlug) {
    if (!ensureMarkup()) return;
    currentSlug = slug || currentSlug;
    if (!currentSlug) return;
    if (typeof window.PokedexCollection?.ensureLoaded === "function") {
      await window.PokedexCollection.ensureLoaded();
    }
    await window.PokevaultTrainerContacts?.ensureLoaded?.();
    renderContent(contentEl, currentSlug);
    void ensureGamePokedexes();
  }

  function open(slug, trigger = null) {
    if (!ensureMarkup()) return;
    currentSlug = slug || currentSlug;
    lastTrigger = trigger || lastTrigger;
    rootEl.hidden = false;
    rootEl.classList?.add?.("is-open");
    document.body?.classList?.add?.("pokemon-modal-open");
    if (statusMsgEl) statusMsgEl.textContent = "";
    if (contentEl && currentSlug) renderContent(contentEl, currentSlug);
    void render(currentSlug);
    panelEl?.focus?.();
  }

  function close() {
    if (!ensureMarkup()) return;
    rootEl.classList?.remove?.("is-open");
    rootEl.hidden = true;
    document.body?.classList?.remove?.("pokemon-modal-open");
    currentSlug = null;
    lastTrigger?.focus?.();
  }

  function openFromCurrentHash() {
    const helper = ficheHelpers();
    const slug = helper.parsePokemonRouteSlug?.(location.hash || "");
    if (!slug) return false;
    open(slug, null);
    const back = helper.listReturnHash?.(location.hash || "") || "#/liste";
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", back);
    }
    location.hash = back;
    return true;
  }

  function resetForTests() {
    rootEl = null;
    panelEl = null;
    contentEl = null;
    statusMsgEl = null;
    lastTrigger = null;
    currentSlug = null;
    gamePokedexes = window.PokevaultGamePokedexes || null;
    gamePokedexesPromise = null;
  }

  const modalApi = {
    close,
    open,
    openFromCurrentHash,
    render,
  };
  if (window.__POKEVAULT_MODAL_TESTS__) {
    modalApi._test = {
      buildGamePokedexes,
      gamePokedexAppearances,
      openFromCurrentHash,
      renderContent,
      resetForTests,
    };
  }
  window.PokevaultPokemonModal = modalApi;
  window.PokevaultDrawer = modalApi;
})();
