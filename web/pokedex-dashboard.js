/**
 * Pokédex-first dashboard helpers for the collection home.
 */
(function initPokedexDashboard() {
  "use strict";

  function pokemonKey(pokemon) {
    return String(pokemon?.slug || "");
  }

  function nationalNumber(pokemon) {
    const raw = String(pokemon?.number || "").replace(/^#/, "").replace(/^0+/, "") || "0";
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : 0;
  }

  function regionIdForPokemon(pokemon, regions) {
    if (pokemon?.region) return String(pokemon.region);
    const number = nationalNumber(pokemon);
    for (const region of regions) {
      if (region.low <= number && number <= region.high) return region.id;
    }
    return "_other";
  }

  function statusForPokemon(slug, statusMap, caughtMap) {
    const status = statusMap?.[slug];
    if (status?.state === "caught" || caughtMap?.[slug]) {
      return { state: "caught", shiny: Boolean(status?.shiny) };
    }
    if (status?.state === "seen") return { state: "seen", shiny: false };
    return { state: "not_met", shiny: false };
  }

  function cleanCardStats(cardStats) {
    const cards = Number(cardStats?.cards);
    const sets = Number(cardStats?.sets);
    return {
      cards: Number.isFinite(cards) ? Math.max(0, cards) : 0,
      sets: Number.isFinite(sets) ? Math.max(0, sets) : 0,
    };
  }

  function computeDashboardMetrics({
    pool = [],
    statusMap = {},
    caughtMap = {},
    regionDefinitions = [],
    cardStats = {},
  } = {}) {
    const regions = regionDefinitions.map((region) => ({
      id: String(region.id),
      label: region.label_fr || region.label || region.id,
      low: Number(region.low) || 0,
      high: Number(region.high) || 0,
      caught: 0,
      seen: 0,
      total: 0,
      percentCaught: 0,
    }));
    const byRegion = new Map(regions.map((region) => [region.id, region]));
    let otherRegion = null;
    let seen = 0;
    let caught = 0;
    let shiny = 0;
    let notMet = 0;

    for (const pokemon of Array.isArray(pool) ? pool : []) {
      const slug = pokemonKey(pokemon);
      const status = statusForPokemon(slug, statusMap, caughtMap);
      if (status.state === "caught") {
        caught += 1;
        if (status.shiny) shiny += 1;
      } else if (status.state === "seen") {
        seen += 1;
      } else {
        notMet += 1;
      }

      const regionId = regionIdForPokemon(pokemon, regions);
      let region = byRegion.get(regionId);
      if (!region) {
        if (!otherRegion) {
          otherRegion = {
            id: "_other",
            label: "Autre",
            low: 0,
            high: 0,
            caught: 0,
            seen: 0,
            total: 0,
            percentCaught: 0,
          };
        }
        region = otherRegion;
      }
      region.total += 1;
      if (status.state === "caught") region.caught += 1;
      if (status.state === "seen") region.seen += 1;
    }

    const regionRows = [...regions, ...(otherRegion ? [otherRegion] : [])]
      .filter((region) => region.total > 0)
      .map((region) => ({
        ...region,
        percentCaught: region.total
          ? Math.round((region.caught / region.total) * 100)
          : 0,
      }));
    const total = seen + caught + notMet;
    return {
      total,
      notMet,
      seen,
      caught,
      shiny,
      percentCaught: total ? Math.round((caught / total) * 100) : 0,
      cardStats: cleanCardStats(cardStats),
      regions: regionRows,
    };
  }

  function renderMetricCard({ label, value, detail, metric, secondary = false }) {
    const card = document.createElement("article");
    card.className = "pokedex-dashboard-card";
    card.dataset.metric = metric;
    if (secondary) card.classList.add("is-secondary");

    const labelEl = document.createElement("span");
    labelEl.className = "pokedex-dashboard-card__label";
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.className = "pokedex-dashboard-card__value";
    valueEl.textContent = String(value);
    const detailEl = document.createElement("span");
    detailEl.className = "pokedex-dashboard-card__detail";
    detailEl.textContent = detail;
    card.append(labelEl, valueEl, detailEl);
    return card;
  }

  function renderRegionRow(region) {
    const row = document.createElement("div");
    row.className = "pokedex-dashboard-region";
    row.textContent = `${region.label} · ${region.caught} / ${region.total}`;
    row.setAttribute("aria-label", `${region.label}: ${region.caught} sur ${region.total}`);

    const bar = document.createElement("span");
    bar.className = "pokedex-dashboard-region__bar";
    const fill = document.createElement("span");
    fill.className = "pokedex-dashboard-region__fill";
    fill.style.width = `${Math.max(0, Math.min(100, region.percentCaught))}%`;
    bar.append(fill);
    row.append(bar);
    return row;
  }

  function renderDashboard({ cardsHost, regionsHost, metrics }) {
    if (!cardsHost || !regionsHost || !metrics) return;
    const cardSummary = metrics.cardStats || { cards: 0, sets: 0 };
    cardsHost.replaceChildren(
      renderMetricCard({
        label: "Non rencontrés",
        value: metrics.notMet,
        detail: "À découvrir",
        metric: "missing",
      }),
      renderMetricCard({
        label: "Vus",
        value: metrics.seen,
        detail: "À capturer",
        metric: "seen",
      }),
      renderMetricCard({
        label: "Capturés",
        value: metrics.caught,
        detail: `${metrics.percentCaught}% du dex`,
        metric: "caught",
      }),
      renderMetricCard({
        label: "Shiny",
        value: metrics.shiny,
        detail: "Bonus",
        metric: "shiny",
        secondary: true,
      }),
      renderMetricCard({
        label: "Cartes",
        value: cardSummary.cards,
        detail: `${cardSummary.sets} set(s)`,
        metric: "cards",
        secondary: true,
      }),
    );

    regionsHost.replaceChildren(...metrics.regions.map(renderRegionRow));
  }

  function renderFromState({
    cardsHost,
    regionsHost,
    pool,
    statusMap,
    caughtMap,
    regionDefinitions,
    cardStats,
  }) {
    const metrics = computeDashboardMetrics({
      pool,
      statusMap,
      caughtMap,
      regionDefinitions,
      cardStats,
    });
    renderDashboard({ cardsHost, regionsHost, metrics });
    return metrics;
  }

  const api = {
    computeDashboardMetrics,
    renderDashboard,
    renderFromState,
  };
  if (window.__POKEVAULT_DASHBOARD_TESTS__) {
    api._test = {
      computeDashboardMetrics,
      renderDashboard,
    };
  }
  window.PokevaultDashboard = api;
})();
