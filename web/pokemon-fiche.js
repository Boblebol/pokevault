/**
 * Shared helpers for Pokémon fiche surfaces.
 *
 * B1 keeps the drawer and full route on the same information architecture:
 * identity, Pokédex status, forms, personal progression, then notes.
 */
(function initPokemonFiche() {
  "use strict";

  const SECTION_DEFINITIONS = [
    { id: "identity", titleKey: "pokemon_fiche.section.identity" },
    { id: "pokedex_status", titleKey: "pokemon_fiche.section.pokedex_status" },
    { id: "pokedex_entries", titleKey: "pokemon_fiche.section.pokedex_entries" },
    { id: "forms", titleKey: "pokemon_fiche.section.forms" },
  ];
  const STATUS_ACTIONS = [
    { id: "not_met", labelKey: "pokemon_fiche.action.not_met", state: "not_met" },
    { id: "seen", labelKey: "pokemon_fiche.action.seen", state: "seen" },
    { id: "caught", labelKey: "pokemon_fiche.action.caught", state: "caught" },
  ];
  const OWNERSHIP_ACTIONS = [
    { id: "capture", labelKey: "pokemon_fiche.ownership.capture" },
    { id: "release", labelKey: "pokemon_fiche.ownership.release" },
  ];
  const TYPE_ALIASES = {
    acier: "steel",
    bug: "bug",
    combat: "fighting",
    dark: "dark",
    dragon: "dragon",
    eau: "water",
    electric: "electric",
    electrik: "electric",
    fairy: "fairy",
    fee: "fairy",
    feu: "fire",
    fighting: "fighting",
    fire: "fire",
    flying: "flying",
    ghost: "ghost",
    glace: "ice",
    grass: "grass",
    ground: "ground",
    ice: "ice",
    insecte: "bug",
    normal: "normal",
    plante: "grass",
    poison: "poison",
    psychic: "psychic",
    psy: "psychic",
    roche: "rock",
    rock: "rock",
    sol: "ground",
    spectre: "ghost",
    steel: "steel",
    tenebres: "dark",
    vol: "flying",
    water: "water",
  };
  const FALLBACK_I18N = {
    "pokemon_fiche.section.identity": "Identité",
    "pokemon_fiche.section.pokedex_status": "Statut Pokédex",
    "pokemon_fiche.section.forms": "Formes",
    "pokemon_fiche.section.personal_progress": "Progression personnelle",
    "pokemon_fiche.section.notes": "Notes",
    "pokemon_fiche.section.generic": "Section",
    "pokemon_fiche.action.not_met": "Non rencontré",
    "pokemon_fiche.action.seen": "Vu",
    "pokemon_fiche.action.caught": "Capturé",
    "pokemon_fiche.status.not_met": "Non rencontré",
    "pokemon_fiche.status.seen": "Aperçu",
    "pokemon_fiche.status.caught": "Attrapé",
    "pokemon_fiche.ownership.capture": "Capturer",
    "pokemon_fiche.ownership.owned": "Capturé",
    "pokemon_fiche.ownership.count": "{count} exemplaires",
    "pokemon_fiche.ownership.release": "Relâcher",
    "pokemon_fiche.ownership.none": "À attraper",
    "pokemon_fiche.unknown": "Inconnu",
    "pokemon_fiche.note.placeholder": "Lieu, version, échange, objectif...",
    "pokemon_fiche.note.save": "Sauver la note",
    "pokemon_fiche.note.saved": "Note sauvegardée.",
    "pokemon_fiche.note.deleted": "Note supprimée.",
    "pokemon_fiche.note.failed": "Sauvegarde impossible.",
  };

  function t(key, params = {}) {
    const runtime = window.PokevaultI18n;
    if (runtime?.t) return runtime.t(key, params);
    const template = FALLBACK_I18N[key] || key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
    );
  }

  function sectionTitle(definition) {
    return definition?.title || (definition?.titleKey ? t(definition.titleKey) : "");
  }

  function buildFicheSectionPlan() {
    return SECTION_DEFINITIONS.map((section) => ({ ...section, title: sectionTitle(section) }));
  }

  function sectionDefinition(id) {
    return SECTION_DEFINITIONS.find((section) => section.id === id) || null;
  }

  function joinClasses(...classes) {
    return classes
      .flatMap((value) => String(value || "").split(/\s+/))
      .filter(Boolean)
      .join(" ");
  }

  function decorateFicheSection(element, id, options = {}) {
    if (!element) return element;
    const definition = sectionDefinition(id) || { id, title: id };
    const secondary = Boolean(options.secondary ?? definition.secondary);
    element.dataset.section = id;
    element.className = joinClasses(
      element.className,
      "pokemon-fiche-section",
      secondary ? "is-secondary" : "",
      options.className,
    );
    return element;
  }

  function createFicheSection(options) {
    const definition = sectionDefinition(options?.id) || {};
    const id = options?.id || definition.id || "section";
    const title = options?.title || sectionTitle(definition) || id;
    const headingLevel = Math.min(6, Math.max(2, Number(options?.headingLevel || 2)));
    const section = decorateFicheSection(
      document.createElement("section"),
      id,
      { secondary: options?.secondary, className: options?.className },
    );
    const heading = document.createElement(`h${headingLevel}`);
    heading.className = joinClasses(
      "pokemon-fiche-section__title",
      options?.headingClassName,
    );
    heading.textContent = title;
    section.append(heading);
    return section;
  }

  function createCollapsibleBody(section, options = {}) {
    if (!section) return null;
    const collapsed = options.collapsed !== false;
    const heading = section.children?.[0] || null;
    const body = document.createElement("div");
    body.className = joinClasses(
      "pokemon-fiche-section__body",
      options.bodyClassName,
    );
    body.hidden = collapsed;
    section.dataset.collapsible = "true";
    section.dataset.collapsed = collapsed ? "true" : "false";

    if (heading) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pokemon-fiche-section__toggle";
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");

      const label = document.createElement("span");
      label.className = "pokemon-fiche-section__toggle-label";
      const movable = Array.from(heading.childNodes || heading.children || []);
      if (movable.length) {
        label.append(...movable);
      } else {
        label.textContent = options.label || heading.textContent || t("pokemon_fiche.section.generic");
      }

      const indicator = document.createElement("span");
      indicator.className = "pokemon-fiche-section__toggle-icon";
      indicator.setAttribute("aria-hidden", "true");
      indicator.textContent = "▾";
      button.append(label, indicator);
      heading.replaceChildren(button);

      button.addEventListener("click", () => {
        const nextCollapsed = !body.hidden;
        body.hidden = nextCollapsed;
        section.dataset.collapsed = nextCollapsed ? "true" : "false";
        button.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
      });
    }

    section.append(body);
    return body;
  }

  function parsePokemonRouteSlug(hash) {
    const raw = String(hash || "").replace(/^#/, "").replace(/^\//, "");
    const [path = ""] = raw.split("?");
    if (!path.startsWith("pokemon/")) return null;
    const slug = path.slice("pokemon/".length);
    if (!slug) return null;
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  }

  function displayName(pokemon) {
    const names = pokemon?.names || {};
    return names.fr || names.en || pokemon?.name_fr || pokemon?.slug || t("pokemon_fiche.unknown");
  }

  function subtitleName(pokemon) {
    const names = pokemon?.names || {};
    return names.en || pokemon?.name_en || "";
  }

  function displayNumber(number, options = {}) {
    if (!number) return options.blank || "—";
    const raw = String(number);
    if (raw.startsWith("#")) return raw;
    if (options.compact) {
      const compact = raw.replace(/^0+/, "") || "0";
      return `#${compact}`;
    }
    return `#${raw}`;
  }

  function normalizeImgPath(img) {
    if (!img) return null;
    const path = String(img).replace(/^\.\//, "");
    if (path.startsWith("http")) return path;
    return path.startsWith("/") ? path : `/${path}`;
  }

  function statusLabel(status) {
    const clean = normalizeStatus(status);
    const state = clean.state;
    if (state === "caught") return t("pokemon_fiche.status.caught");
    if (state === "seen") return t("pokemon_fiche.status.seen");
    return t("pokemon_fiche.status.not_met");
  }

  function normalizeStatus(status) {
    const state = status?.state === "seen" || status?.state === "caught"
      ? status.state
      : "not_met";
    return { state };
  }

  function normalizeStatusPatch(state) {
    const cleanState = state === "seen" || state === "caught" ? state : "not_met";
    return { state: cleanState };
  }

  function buildStatusActionModel(status) {
    const clean = normalizeStatus(status);
    return STATUS_ACTIONS.map((action) => {
      const base = { ...action, label: t(action.labelKey) };
      return {
        ...base,
        active: clean.state === action.state,
        disabled: false,
      };
    });
  }

  function statusPatchForAction(status, actionId) {
    const clean = normalizeStatus(status);
    if (actionId === "not_met" || actionId === "seen") {
      return normalizeStatusPatch(actionId);
    }
    if (actionId === "caught") {
      return normalizeStatusPatch("caught");
    }
    return null;
  }

  function normalizeOwnershipState(state) {
    const count = typeof state?.count === "number" ? state.count : 0;
    const caught = count > 0 || Boolean(state?.caught);
    const duplicate = count > 1 || Boolean(state?.duplicate);
    return { caught, duplicate, count: Math.max(count, caught ? (duplicate ? 2 : 1) : 0) };
  }

  function ownershipLabel(state) {
    const clean = normalizeOwnershipState(state);
    if (clean.count > 1) return t("pokemon_fiche.ownership.count", { count: clean.count });
    if (clean.caught) return t("pokemon_fiche.ownership.owned");
    return t("pokemon_fiche.ownership.none");
  }

  function buildOwnershipActionModel(state) {
    const clean = normalizeOwnershipState(state);
    const capture = OWNERSHIP_ACTIONS[0];
    const release = OWNERSHIP_ACTIONS[1];
    const actions = [
      {
        ...capture,
        label: t(capture.labelKey),
        active: false,
        disabled: false,
        patch: "add",
      },
    ];
    if (clean.caught) {
      actions.push({
        ...release,
        label: t(release.labelKey),
        active: false,
        disabled: false,
        patch: clean.count > 1 ? "remove" : "release_all",
      });
    }
    return actions;
  }

  function ownershipPatchForAction(state, actionId) {
    const action = buildOwnershipActionModel(state).find((item) => item.id === actionId);
    return action && !action.disabled ? action.patch : null;
  }

  function normalizeTypeId(type) {
    const raw = String(type || "").trim();
    if (!raw) return "unknown";
    const key = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return TYPE_ALIASES[key] || key || "unknown";
  }

  function decorateTypeChip(element, type, className = "") {
    if (!element) return element;
    element.className = joinClasses(element.className, "pokemon-type-chip", className);
    element.dataset.type = normalizeTypeId(type);
    if (!element.textContent) element.textContent = String(type || t("pokemon_fiche.unknown"));
    return element;
  }

  function createTypeChip(type, className = "") {
    const chip = document.createElement("span");
    chip.textContent = String(type || t("pokemon_fiche.unknown"));
    return decorateTypeChip(chip, type, className);
  }

  function listIncludesSlug(list, slug) {
    const key = String(slug || "").trim();
    if (!key || !Array.isArray(list)) return false;
    return list.some((item) => String(item || "").trim() === key);
  }

  function listCountSlug(list, slug) {
    const key = String(slug || "").trim();
    if (!key || !Array.isArray(list)) return 0;
    return list.filter((item) => String(item || "").trim() === key).length;
  }

  function ownershipStateFromSources(slug, options = {}) {
    const key = String(slug || "").trim();
    const status = normalizeStatus(options.status);
    const ownCard = options.ownCard && typeof options.ownCard === "object" ? options.ownCard : {};
    const dupCount = listCountSlug(ownCard.for_trade, key);
    const caught = dupCount > 0 || status.state === "caught";
    return {
      caught,
      count: caught ? 1 + dupCount : 0,
      duplicate: dupCount > 0, // Keep for backward compatibility
    };
  }

  function createOwnershipActions(state, onAction, options = {}) {
    const row = document.createElement("div");
    row.className = joinClasses("pokemon-ownership-actions", options.compact ? "is-compact" : "");
    for (const action of buildOwnershipActionModel(state)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pokemon-trade-chip";
      button.dataset.action = action.id;
      button.dataset.patch = action.patch || "";
      button.dataset.active = action.active ? "true" : "false";
      button.disabled = Boolean(action.disabled);
      button.setAttribute("aria-pressed", action.active ? "true" : "false");
      button.textContent = action.label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = ownershipPatchForAction(state, action.id);
        if (!next || action.disabled) return;
        if (typeof onAction === "function") onAction(next, action);
      });
      row.append(button);
    }
    return row;
  }

  function createStatusActions(status, onAction) {
    const row = document.createElement("div");
    row.className = "pokemon-status-actions";
    for (const action of buildStatusActionModel(status)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pokemon-status-action";
      button.dataset.action = action.id;
      button.dataset.active = action.active ? "true" : "false";
      button.disabled = Boolean(action.disabled);
      button.setAttribute("aria-pressed", action.active ? "true" : "false");
      button.textContent = action.label;
      button.addEventListener("click", () => {
        const patch = statusPatchForAction(status, action.id);
        if (!patch || action.disabled) return;
        if (typeof onAction === "function") onAction(patch, action);
      });
      row.append(button);
    }
    return row;
  }

  function isMegaFormPokemon(pokemon) {
    const slug = pokemon?.slug || "";
    if (slug.includes("-mega-")) return true;
    if (/-mega-x$/.test(slug) || /-mega-y$/.test(slug) || /-mega$/.test(slug)) return true;
    if (slug.includes("-primal")) return true;
    return false;
  }

  function isGigamaxPokemon(pokemon) {
    const slug = pokemon?.slug || "";
    return slug.includes("-gmax") || slug.includes("gigantamax");
  }

  function findForms(pokemon, allPokemon) {
    if (!pokemon) return [];
    const number = String(pokemon.number || "");
    if (!number) return [];
    const all = Array.isArray(allPokemon) ? allPokemon : [];
    return all.filter(
      (row) =>
        String(row?.number || "") === number &&
        (row?.slug || "") !== pokemon.slug &&
        !isMegaFormPokemon(row) &&
        !isGigamaxPokemon(row),
    );
  }

  function buildFormEntries(pokemon, allPokemon, getStatus) {
    if (!pokemon) return [];
    const number = String(pokemon.number || "");
    if (!number) return [];
    const all = Array.isArray(allPokemon) ? allPokemon : [];
    const seen = new Set();
    const related = [];
    for (const candidate of [pokemon, ...all]) {
      const slug = String(candidate?.slug || "");
      if (!slug || seen.has(slug)) continue;
      if (String(candidate?.number || "") !== number) continue;

      if (
        candidate.slug !== pokemon.slug &&
        (isMegaFormPokemon(candidate) || isGigamaxPokemon(candidate))
      ) {
        continue;
      }

      seen.add(slug);
      related.push(candidate);
    }
    return related.map((form) => {
      const slug = String(form.slug || "");
      const status = normalizeStatus(
        typeof getStatus === "function" ? getStatus(slug) : null,
      );
      return {
        pokemon: form,
        slug,
        label: form.form || displayName(form),
        current: slug === pokemon.slug,
        status,
        statusLabel: statusLabel(status),
      };
    });
  }

  function sanitizeListReturnHash(hash) {
    const raw = String(hash || "");
    const normalized = raw.startsWith("#") ? raw : `#${raw.replace(/^\/?/, "/")}`;
    const [path, query = ""] = normalized.split("?");
    if (path !== "#/liste" && path !== "#liste" && path !== "#/") return "#/liste";
    const params = new URLSearchParams(query);
    params.delete("slug");
    const qs = params.toString();
    return `#/liste${qs ? `?${qs}` : ""}`;
  }

  function listReturnHash(hash) {
    const raw = String(hash || "");
    const queryIndex = raw.indexOf("?");
    if (queryIndex >= 0) {
      const params = new URLSearchParams(raw.slice(queryIndex + 1));
      const from = params.get("from");
      if (from) return sanitizeListReturnHash(from);
    }
    return sanitizeListReturnHash(raw);
  }

  function pokemonRouteHref(slug, returnHash) {
    const route = `#/pokemon/${encodeURIComponent(String(slug || ""))}`;
    const from = encodeURIComponent(sanitizeListReturnHash(returnHash));
    return `${route}?from=${from}`;
  }

  function normalizeNoteText(value) {
    return String(value || "").trim().slice(0, 500);
  }

  function createNoteEditor(note, onSave) {
    const wrap = document.createElement("div");
    wrap.className = "pokemon-note-editor";

    const input = document.createElement("textarea");
    input.className = "pokemon-note-editor__input";
    input.maxLength = 500;
    input.rows = 3;
    input.placeholder = t("pokemon_fiche.note.placeholder");
    input.value = normalizeNoteText(note);
    wrap.append(input);

    const actions = document.createElement("div");
    actions.className = "pokemon-note-editor__actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "pokemon-note-editor__save";
    save.textContent = t("pokemon_fiche.note.save");
    const status = document.createElement("span");
    status.className = "pokemon-note-editor__status";
    actions.append(save, status);
    wrap.append(actions);

    save.addEventListener("click", async () => {
      const text = normalizeNoteText(input.value);
      input.value = text;
      save.disabled = true;
      status.textContent = "";
      try {
        if (typeof onSave === "function") await onSave(text);
        status.textContent = text ? t("pokemon_fiche.note.saved") : t("pokemon_fiche.note.deleted");
      } catch {
        status.textContent = t("pokemon_fiche.note.failed");
      } finally {
        save.disabled = false;
      }
    });

    return wrap;
  }

  const api = {
    buildFormEntries,
    buildFicheSectionPlan,
    buildOwnershipActionModel,
    buildStatusActionModel,
    createOwnershipActions,
    createStatusActions,
    createFicheSection,
    createCollapsibleBody,
    createNoteEditor,
    decorateFicheSection,
    decorateTypeChip,
    displayName,
    displayNumber,
    findForms,
    listReturnHash,
    normalizeImgPath,
    normalizeNoteText,
    ownershipLabel,
    ownershipPatchForAction,
    ownershipStateFromSources,
    parsePokemonRouteSlug,
    pokemonRouteHref,
    sectionDefinition,
    createTypeChip,
    normalizeTypeId,
    statusLabel,
    statusPatchForAction,
    subtitleName,
  };

  if (window.__POKEVAULT_FICHE_TESTS__) {
    api._test = api;
  }
  window.PokevaultPokemonFiche = api;
})();
