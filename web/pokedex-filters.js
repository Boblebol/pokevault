/**
 * Shared Pokédex-first filter helpers.
 */
(function initPokedexFilters() {
  "use strict";

  const STATUS_FILTERS = new Set(["all", "missing", "caught"]);
  const FORM_FILTERS = new Set(["all", "base_only", "base_regional", "regional_only"]);

  function normText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function slugOf(pokemon) {
    return String(pokemon?.slug || "");
  }

  function statusForPokemon(slug, caughtMap = {}, statusMap = {}) {
    const raw = statusMap?.[slug];
    if (raw?.state === "caught" || caughtMap?.[slug]) {
      return { state: "caught", shiny: Boolean(raw?.shiny) };
    }
    if (raw?.state === "seen") return { state: "seen", shiny: false };
    return { state: "not_met", shiny: false };
  }

  function isMegaFormPokemon(pokemon) {
    const form = normText(pokemon?.form);
    const slug = normText(pokemon?.slug);
    return /\bmega\b/.test(form) || slug.includes("-mega-") || /-mega(-x|-y)?$/.test(slug);
  }

  function isGigamaxPokemon(pokemon) {
    const form = normText(pokemon?.form);
    const slug = normText(pokemon?.slug);
    return form.includes("gigamax") || form.includes("g-max") || slug.includes("gmax") || slug.includes("gigantamax");
  }

  function isRegionalFormPokemon(pokemon) {
    if (isMegaFormPokemon(pokemon) || isGigamaxPokemon(pokemon)) return false;
    const form = normText(pokemon?.form);
    const slug = normText(pokemon?.slug);
    if (
      /\bd'?alola\b/.test(form) ||
      form.includes("de galar") ||
      form.includes("hisui") ||
      form.includes("hisu") ||
      form.includes("paldea")
    ) {
      return true;
    }
    return (
      /(^|-)(alola|galar|hisui|paldea)(-|$)/.test(slug) ||
      slug.includes("alolan") ||
      slug.includes("galarian") ||
      slug.includes("hisuian")
    );
  }

  function isNamedSpecialForm(pokemon) {
    const form = String(pokemon?.form || "").trim();
    if (!form) return false;
    return !isRegionalFormPokemon(pokemon);
  }

  function normalizeStatus(value) {
    const raw = String(value || "all");
    return STATUS_FILTERS.has(raw) ? raw : "all";
  }

  function normalizeForms(value) {
    const raw = String(value || "all");
    if (raw === "regional") return "regional_only";
    return FORM_FILTERS.has(raw) ? raw : "all";
  }

  function normalizeRegion(value, regionIds = []) {
    const raw = String(value || "all");
    if (raw === "all") return "all";
    return !regionIds.length || regionIds.includes(raw) ? raw : "all";
  }

  function normalizeType(value, typeIds = []) {
    const raw = String(value || "all");
    if (raw === "all") return "all";
    return !typeIds.length || typeIds.includes(raw) ? raw : "all";
  }

  function normalizeTags(value, tagIds = []) {
    const raw = Array.isArray(value) ? value : String(value || "").split(",");
    const known = new Set(tagIds || []);
    const out = [];
    for (const item of raw) {
      const tag = String(item || "").trim();
      if (!tag) continue;
      if (known.size && !known.has(tag)) continue;
      if (!out.includes(tag)) out.push(tag);
    }
    return out;
  }

  function normalizeFilterState(filters = {}, options = {}) {
    return {
      status: normalizeStatus(filters.status),
      region: normalizeRegion(filters.region, options.regionIds || []),
      forms: normalizeForms(filters.forms),
      type: normalizeType(filters.type, options.typeIds || []),
      tags: normalizeTags(filters.tags, options.tagIds || []),
    };
  }

  function parseRoute(hash) {
    const raw = String(hash || "#/liste").replace(/^#\/?/, "");
    const q = raw.indexOf("?");
    if (q < 0) return { view: raw || "liste", params: new URLSearchParams() };
    return {
      view: raw.slice(0, q) || "liste",
      params: new URLSearchParams(raw.slice(q + 1)),
    };
  }

  function parseFilterHash(hash, options = {}) {
    const { view, params } = parseRoute(hash);
    return {
      view,
      filters: normalizeFilterState({
        status: params.get("status") || "all",
        region: params.get("region") || "all",
        forms: params.get("forms") || "all",
        type: params.get("type") || "all",
        tags: params.get("tags") || "",
      }, options),
    };
  }

  function writeParam(params, name, value, defaultValue, encodedValue = value) {
    if (!value || value === defaultValue) params.delete(name);
    else params.set(name, encodedValue);
  }

  function buildFilterHash(hash, filters = {}, options = {}) {
    const { view, params } = parseRoute(hash);
    const normalized = normalizeFilterState(filters, options);
    writeParam(params, "status", normalized.status, "all");
    writeParam(params, "region", normalized.region, "all");
    writeParam(
      params,
      "forms",
      normalized.forms,
      "all",
      normalized.forms === "regional_only" ? "regional" : normalized.forms,
    );
    writeParam(params, "type", normalized.type, "all");
    if (normalized.tags.length) params.set("tags", normalized.tags.join(","));
    else params.delete("tags");
    const qs = params.toString();
    return `#/${view || "liste"}${qs ? `?${qs}` : ""}`;
  }

  function matchesStatus(pokemon, filters, caughtMap, statusMap) {
    const slug = slugOf(pokemon);
    const status = statusForPokemon(slug, caughtMap, statusMap);
    if (filters.status === "caught") return status.state === "caught";
    if (filters.status === "missing") return status.state !== "caught";
    return true;
  }

  function matchesForms(pokemon, forms) {
    if (forms === "all") return true;
    if (forms === "regional_only") return isRegionalFormPokemon(pokemon);
    if (forms === "base_only") return !isRegionalFormPokemon(pokemon) && !isNamedSpecialForm(pokemon);
    if (forms === "base_regional") {
      return !isNamedSpecialForm(pokemon) || isRegionalFormPokemon(pokemon);
    }
    return true;
  }

  function matchesType(pokemon, type) {
    if (type === "all") return true;
    return (pokemon?.types || []).some((item) => String(item) === type);
  }

  function matchesTags(pokemon, tags, narrativeTagsFor) {
    if (!tags.length) return true;
    const pokemonTags = typeof narrativeTagsFor === "function" ? narrativeTagsFor(pokemon) : [];
    if (!Array.isArray(pokemonTags) || !pokemonTags.length) return false;
    return tags.some((tag) => pokemonTags.includes(tag));
  }

  function matchesPokemonFilters(pokemon, {
    filters,
    caughtMap = {},
    statusMap = {},
    effectiveRegion = null,
    narrativeTagsFor = null,
  } = {}) {
    const clean = normalizeFilterState(filters || {});
    const region = typeof effectiveRegion === "function"
      ? effectiveRegion(pokemon)
      : String(pokemon?.region || "all");
    return (
      matchesStatus(pokemon, clean, caughtMap, statusMap) &&
      (clean.region === "all" || region === clean.region) &&
      matchesForms(pokemon, clean.forms) &&
      matchesType(pokemon, clean.type) &&
      matchesTags(pokemon, clean.tags, narrativeTagsFor)
    );
  }

  const api = {
    normalizeFilterState,
    parseFilterHash,
    buildFilterHash,
    matchesPokemonFilters,
    isRegionalFormPokemon,
    statusForPokemon,
  };
  if (window.__POKEVAULT_FILTERS_TESTS__) {
    api._test = api;
  }
  window.PokevaultFilters = api;
})();
