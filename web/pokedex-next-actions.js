/**
 * Pokédex-first next actions panel for the collection home.
 */
(function initPokedexNextActions() {
  "use strict";

  const DEFAULT_LIMIT = 3;
  const FALLBACK_I18N = {
    "next_actions.title": "À compléter maintenant",
    "next_actions.empty": "Pokédex complet sur ce périmètre.",
    "next_actions.open": "Ouvrir {name}",
    "next_actions.default_reason": "À compléter.",
  };

  function t(key, params = {}) {
    const runtime = window.PokevaultI18n;
    if (runtime?.t) return runtime.t(key, params);
    const template = FALLBACK_I18N[key] || key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
    );
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function displayNumber(value) {
    const raw = String(value || "").replace(/^#/, "").replace(/^0+/, "") || "0";
    return `#${raw}`;
  }

  function cleanActions(actions) {
    return Array.isArray(actions) ? actions.filter((action) => action?.slug) : [];
  }

  function renderHeader(host, count) {
    const header = el("div", "pokedex-next-actions__header");
    header.append(el("h2", "pokedex-next-actions__title", t("next_actions.title")));
    header.append(el("span", "pokedex-next-actions__meta", `${count}`));
    host.append(header);
  }

  function renderAction(action, onOpen) {
    const row = el("button", `pokedex-next-action is-${action.kind || "missing"}`);
    row.type = "button";
    row.dataset.slug = action.slug;
    row.setAttribute("aria-label", t("next_actions.open", { name: action.name || action.slug }));
    row.addEventListener("click", () => {
      if (typeof onOpen === "function") onOpen(action.slug, action, row);
    });

    row.append(el("span", "pokedex-next-action__num", displayNumber(action.number)));
    const body = el("span", "pokedex-next-action__body");
    body.append(el("strong", "pokedex-next-action__name", action.name || action.slug));
    body.append(el("span", "pokedex-next-action__reason", action.reason || t("next_actions.default_reason")));
    row.append(body);
    row.append(el("span", "app-icon pokedex-next-action__icon", "›"));
    return row;
  }

  function renderNextActions({ host, actions = [], onOpen = null } = {}) {
    if (!host) return;
    const rows = cleanActions(actions);
    host.replaceChildren();
    renderHeader(host, rows.length);
    if (!rows.length) {
      host.append(el("p", "pokedex-next-actions__empty", t("next_actions.empty")));
      return;
    }
    const list = el("div", "pokedex-next-actions__list");
    for (const action of rows) list.append(renderAction(action, onOpen));
    host.append(list);
  }

  function renderFromState({
    host,
    pool,
    caughtMap,
    statusMap,
    regionDefinitions,
    activeRegionId = "all",
    nearestBadge = null,
    activeMissionSlugs = [],
    limit = DEFAULT_LIMIT,
    onOpen = null,
  } = {}) {
    const actions = window.PokevaultRecommendations?.buildNextActions?.({
      pool,
      caughtMap,
      statusMap,
      regionDefinitions,
      activeRegionId,
      nearestBadge,
      activeMissionSlugs,
      limit,
    }) || [];
    renderNextActions({ host, actions, onOpen });
    return actions;
  }

  const api = {
    renderNextActions,
    renderFromState,
  };
  if (window.__POKEVAULT_NEXT_ACTIONS_TESTS__) {
    api._test = {
      renderNextActions,
      renderFromState,
    };
  }

  window.PokevaultNextActions = api;
})();
