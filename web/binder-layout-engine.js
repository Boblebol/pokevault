(function initBinderLayoutEngine() {
  "use strict";

  function positiveInt(value, fallback) {
    const n = Number.parseInt(String(value), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function normalizedLayout(binder = {}) {
    const rows = positiveInt(binder.rows, 3);
    const cols = positiveInt(binder.cols, 3);
    const sheets = positiveInt(binder.sheet_count ?? binder.sheetCount, 10);
    const perPage = rows * cols;
    const pageCount = sheets * 2;
    const capacity = perPage * pageCount;
    return { rows, cols, sheets, perPage, pageCount, capacity };
  }

  function nationalIntFromPokemon(p) {
    const s = String(p?.number || "").replace(/^#/, "").replace(/^0+/, "") || "0";
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function inferRegionFromDefs(n, defs = []) {
    for (const r of defs) {
      if (r && r.low <= n && n <= r.high) return r.id;
    }
    return "unknown";
  }

  function effectiveRegionId(p, defs = []) {
    if (p?.region) return p.region;
    return inferRegionFromDefs(nationalIntFromPokemon(p), defs);
  }

  function sortNational(pokemon = []) {
    return [...pokemon].sort((a, b) => {
      const na = nationalIntFromPokemon(a);
      const nb = nationalIntFromPokemon(b);
      if (na !== nb) return na - nb;
      return String(a?.slug || "").localeCompare(String(b?.slug || ""));
    });
  }

  function sortRegional(pokemon = [], defs = []) {
    const orderIdx = Object.fromEntries(defs.map((r, i) => [r.id, i]));
    return [...pokemon].sort((a, b) => {
      const ra = effectiveRegionId(a, defs);
      const rb = effectiveRegionId(b, defs);
      const ia = orderIdx[ra] ?? 999;
      const ib = orderIdx[rb] ?? 999;
      if (ia !== ib) return ia - ib;
      const fa = a?.region_native === false ? 1 : 0;
      const fb = b?.region_native === false ? 1 : 0;
      if (fa !== fb) return fa - fb;
      const na = nationalIntFromPokemon(a);
      const nb = nationalIntFromPokemon(b);
      if (na !== nb) return na - nb;
      return String(a?.slug || "").localeCompare(String(b?.slug || ""));
    });
  }

  function applyBinderScope(pokemon = [], binder = {}, defs = []) {
    const scope = String(binder.region_scope || binder.region_id || "").trim();
    return scope ? pokemon.filter((p) => effectiveRegionId(p, defs) === scope) : pokemon;
  }

  function applyBinderRange(items = [], binder = {}) {
    const startRaw = Number(binder.range_start);
    const limitRaw = Number(binder.range_limit);
    const start = Number.isFinite(startRaw) && startRaw > 0 ? Math.floor(startRaw) : 0;
    const hasLimit = Number.isFinite(limitRaw) && limitRaw > 0;
    if (start === 0 && !hasLimit) return items;
    const limit = hasLimit ? Math.floor(limitRaw) : items.length;
    return items.slice(start, start + limit);
  }

  function slotMeta(index, layout) {
    const pageIndex = Math.floor(index / layout.perPage);
    const slotInPage = index % layout.perPage;
    return {
      page: pageIndex + 1,
      sheet: Math.floor(pageIndex / 2) + 1,
      face: pageIndex % 2 === 0 ? "R" : "V",
      slot: slotInPage + 1,
      row: Math.floor(slotInPage / layout.cols) + 1,
      col: (slotInPage % layout.cols) + 1,
    };
  }

  function pokemonItem(pokemon, familyId = null) {
    return { pokemon, emptyKind: null, familyId };
  }

  function capacityItem() {
    return { pokemon: null, emptyKind: "capacity_empty", familyId: null };
  }

  function basicItemsForBinder(binder = {}, pokemon = [], defs = []) {
    const scoped = applyBinderScope(pokemon, binder, defs);
    const org = binder.organization === "by_region" ? "by_region" : "national";
    const sorted = org === "by_region" && defs.length ? sortRegional(scoped, defs) : sortNational(scoped);
    return sorted.map((p) => pokemonItem(p));
  }

  function computeBinderSlots({ binder = {}, pokemon = [], defs = [], includeCapacity = false } = {}) {
    const layout = normalizedLayout(binder);
    const ranged = applyBinderRange(basicItemsForBinder(binder, pokemon, defs), binder);
    const items = includeCapacity ? ranged.slice(0, layout.capacity) : ranged.slice();
    if (includeCapacity) {
      while (items.length < layout.capacity) items.push(capacityItem());
    }
    return items.map((item, idx) => ({
      binderId: String(binder.id || ""),
      binderName: String(binder.name || binder.id || ""),
      ...slotMeta(idx, layout),
      pokemon: item.pokemon,
      emptyKind: item.emptyKind,
      familyId: item.familyId,
    }));
  }

  function orderPokemonForBinder({ binder = {}, pokemon = [], defs = [], familyData = null } = {}) {
    void familyData;
    return computeBinderSlots({ binder, pokemon, defs, includeCapacity: false })
      .filter((slot) => slot.emptyKind !== "capacity_empty")
      .map((slot) => slot.pokemon || null);
  }

  window.PokevaultBinderLayout = {
    computeBinderSlots,
    orderPokemonForBinder,
    _test: {
      applyBinderRange,
      computeBinderSlots,
      effectiveRegionId,
      normalizedLayout,
      orderPokemonForBinder,
      slotMeta,
      sortNational,
      sortRegional,
    },
  };
})();
