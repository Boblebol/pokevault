/**
 * Shared helpers for Pokémon fiche surfaces.
 *
 * B1 keeps the drawer and full route on the same information architecture:
 * identity, Pokédex status, forms, personal progression, notes, then cards.
 */
(function initPokemonFiche() {
  "use strict";

  const SECTION_DEFINITIONS = [
    { id: "identity", title: "Identité" },
    { id: "pokedex_status", title: "Statut Pokédex" },
    { id: "forms", title: "Formes" },
    { id: "personal_progress", title: "Progression personnelle" },
    { id: "notes", title: "Notes" },
    { id: "cards", title: "Mes cartes", secondary: true },
  ];
  const STATUS_ACTIONS = [
    { id: "not_met", label: "Non rencontré", state: "not_met" },
    { id: "seen", label: "Vu", state: "seen" },
    { id: "caught", label: "Capturé", state: "caught" },
    { id: "shiny", label: "Shiny" },
  ];
  const OWNERSHIP_ACTIONS = [
    { id: "wanted", label: "Cherche" },
    { id: "owned", label: "J'ai" },
    { id: "duplicate", label: "Double" },
  ];

  function buildFicheSectionPlan() {
    return SECTION_DEFINITIONS.map((section) => ({ ...section }));
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
    const title = options?.title || definition.title || id;
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
        label.textContent = options.label || heading.textContent || "Section";
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
    return names.fr || names.en || pokemon?.name_fr || pokemon?.slug || "Inconnu";
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
    if (state === "caught") return clean.shiny ? "Attrapé shiny" : "Attrapé";
    if (state === "seen") return "Aperçu";
    return "Non rencontré";
  }

  function normalizeStatus(status) {
    const state = status?.state === "seen" || status?.state === "caught"
      ? status.state
      : "not_met";
    return {
      state,
      shiny: state === "caught" && Boolean(status?.shiny),
    };
  }

  function normalizeStatusPatch(state, shiny) {
    const cleanState = state === "seen" || state === "caught" ? state : "not_met";
    return {
      state: cleanState,
      shiny: cleanState === "caught" && Boolean(shiny),
    };
  }

  function buildStatusActionModel(status) {
    const clean = normalizeStatus(status);
    return STATUS_ACTIONS.map((action) => {
      if (action.id === "shiny") {
        return {
          ...action,
          active: clean.state === "caught" && clean.shiny,
          disabled: clean.state !== "caught",
        };
      }
      return {
        ...action,
        active: clean.state === action.state,
        disabled: false,
      };
    });
  }

  function statusPatchForAction(status, actionId) {
    const clean = normalizeStatus(status);
    if (actionId === "not_met" || actionId === "seen") {
      return normalizeStatusPatch(actionId, false);
    }
    if (actionId === "caught") {
      return normalizeStatusPatch("caught", clean.state === "caught" && clean.shiny);
    }
    if (actionId === "shiny") {
      if (clean.state !== "caught") return null;
      return normalizeStatusPatch("caught", !clean.shiny);
    }
    return null;
  }

  function normalizeOwnershipState(state) {
    return {
      wanted: Boolean(state?.wanted),
      caught: Boolean(state?.caught),
      duplicate: Boolean(state?.duplicate),
    };
  }

  function ownershipLabel(state) {
    const clean = normalizeOwnershipState(state);
    if (clean.duplicate) return "Double";
    if (clean.wanted) return "Cherche";
    if (clean.caught) return "J'ai";
    return "Je n'ai pas";
  }

  function buildOwnershipActionModel(state) {
    const clean = normalizeOwnershipState(state);
    return OWNERSHIP_ACTIONS.map((action) => ({
      ...action,
      active: action.id === "duplicate"
        ? clean.duplicate
        : action.id === "wanted"
          ? clean.wanted && !clean.duplicate
          : clean.caught && !clean.wanted && !clean.duplicate,
      disabled: false,
    }));
  }

  function ownershipPatchForAction(state, actionId) {
    const clean = normalizeOwnershipState(state);
    if (actionId === "wanted") return clean.wanted && !clean.duplicate ? "none" : "wanted";
    if (actionId === "owned") return clean.caught && !clean.wanted && !clean.duplicate ? "none" : "owned";
    if (actionId === "duplicate") return clean.duplicate ? "owned" : "duplicate";
    return null;
  }

  function createOwnershipActions(state, onAction, options = {}) {
    const row = document.createElement("div");
    row.className = joinClasses("pokemon-ownership-actions", options.compact ? "is-compact" : "");
    for (const action of buildOwnershipActionModel(state)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pokemon-trade-chip";
      button.dataset.action = action.id;
      button.dataset.active = action.active ? "true" : "false";
      button.setAttribute("aria-pressed", action.active ? "true" : "false");
      button.textContent = action.label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = ownershipPatchForAction(state, action.id);
        if (!next) return;
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

  function findForms(pokemon, allPokemon) {
    if (!pokemon) return [];
    const number = String(pokemon.number || "");
    if (!number) return [];
    const all = Array.isArray(allPokemon) ? allPokemon : [];
    return all.filter(
      (row) => String(row?.number || "") === number && (row?.slug || "") !== pokemon.slug,
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
    input.placeholder = "Lieu, version, échange, objectif...";
    input.value = normalizeNoteText(note);
    wrap.append(input);

    const actions = document.createElement("div");
    actions.className = "pokemon-note-editor__actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "pokemon-note-editor__save";
    save.textContent = "Sauver la note";
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
        status.textContent = text ? "Note sauvegardée." : "Note supprimée.";
      } catch {
        status.textContent = "Sauvegarde impossible.";
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
    displayName,
    displayNumber,
    findForms,
    listReturnHash,
    normalizeImgPath,
    normalizeNoteText,
    ownershipLabel,
    ownershipPatchForAction,
    parsePokemonRouteSlug,
    pokemonRouteHref,
    sectionDefinition,
    statusLabel,
    statusPatchForAction,
    subtitleName,
  };

  if (window.__POKEVAULT_FICHE_TESTS__) {
    api._test = api;
  }
  window.PokevaultPokemonFiche = api;
})();
