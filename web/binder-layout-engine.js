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

  function familyReservedItem(familyId) {
    return { pokemon: null, emptyKind: "family_reserved", familyId };
  }

  function padRowToColumns(row, cols, familyId, emptyKind = "family_reserved") {
    const out = row.slice(0, cols);
    while (out.length < cols) {
      out.push(emptyKind === "capacity_empty" ? capacityItem() : familyReservedItem(familyId));
    }
    return out;
  }

  function chunkRowToColumns(row, cols, familyId) {
    const chunks = [];
    const width = positiveInt(cols, 3);
    for (let start = 0; start < row.length; start += width) {
      chunks.push(padRowToColumns(row.slice(start, start + width), width, familyId));
    }
    return chunks.length ? chunks : [padRowToColumns([], width, familyId)];
  }

  function familyLayoutBlocks(pokemon = [], familyData = null, cols = 3) {
    const bySlug = new Map();
    for (const p of pokemon) {
      const slug = String(p?.slug || "");
      if (slug) bySlug.set(slug, p);
    }

    const emitted = new Set();
    const families = Array.isArray(familyData?.families) ? familyData.families : [];
    const blocks = [];

    for (const family of families) {
      const familyId = String(family?.id || "");
      const rows = Array.isArray(family?.layout_rows) ? family.layout_rows : [];
      const blockRows = [];
      let hasRepresentedPokemon = false;

      for (const rawRow of rows) {
        if (!Array.isArray(rawRow)) continue;
        const row = [];
        for (const slugRaw of rawRow) {
          if (!slugRaw) {
            row.push(familyReservedItem(familyId));
            continue;
          }
          const slug = String(slugRaw);
          const p = bySlug.get(slug);
          if (!p || emitted.has(slug)) {
            row.push(familyReservedItem(familyId));
            continue;
          }
          row.push(pokemonItem(p, familyId));
          emitted.add(slug);
          hasRepresentedPokemon = true;
        }
        blockRows.push(...chunkRowToColumns(row, cols, familyId));
      }

      if (hasRepresentedPokemon) blocks.push({ familyId, rows: blockRows });
    }

    const leftovers = sortNational(
      pokemon.filter((p) => p?.slug && !emitted.has(String(p.slug))),
    );
    for (const p of leftovers) {
      blocks.push({
        familyId: String(p.slug || ""),
        rows: [padRowToColumns([pokemonItem(p, String(p.slug || ""))], cols, String(p.slug || ""))],
      });
    }
    return blocks;
  }

  function flattenFamilyBlocksPageAware(blocks = [], layout) {
    const out = [];
    let rowInPage = 0;

    for (const block of blocks) {
      const blockRows = block.rows || [];
      if (
        rowInPage > 0 &&
        blockRows.length <= layout.rows &&
        rowInPage + blockRows.length > layout.rows
      ) {
        while (rowInPage < layout.rows) {
          out.push(...padRowToColumns([], layout.cols, null, "capacity_empty"));
          rowInPage += 1;
        }
        rowInPage = 0;
      }

      for (const row of blockRows) {
        out.push(...padRowToColumns(row, layout.cols, block.familyId));
        rowInPage = (rowInPage + 1) % layout.rows;
      }
    }
    return out;
  }

  function basicItemsForBinder(binder = {}, pokemon = [], defs = [], familyData = null) {
    const layout = normalizedLayout(binder);
    const scoped = applyBinderScope(pokemon, binder, defs);
    const org =
      binder.organization === "by_region" || binder.organization === "family"
        ? binder.organization
        : "national";

    if (org === "family" && familyData && Array.isArray(familyData.families)) {
      return flattenFamilyBlocksPageAware(
        familyLayoutBlocks(scoped, familyData, layout.cols),
        layout,
      );
    }

    const sorted = org === "by_region" && defs.length ? sortRegional(scoped, defs) : sortNational(scoped);
    return sorted.map((p) => pokemonItem(p));
  }

  function computeBinderSlots({ binder = {}, pokemon = [], defs = [], familyData = null, includeCapacity = false } = {}) {
    const layout = normalizedLayout(binder);
    const ranged = applyBinderRange(basicItemsForBinder(binder, pokemon, defs, familyData), binder);
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
    const slots = computeBinderSlots({ binder, pokemon, defs, familyData, includeCapacity: false });
    if (binder.organization === "family") {
      return slots.map((slot) => slot.pokemon || null);
    }
    return slots
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
      familyLayoutBlocks,
      flattenFamilyBlocksPageAware,
      normalizedLayout,
      orderPokemonForBinder,
      slotMeta,
      sortNational,
      sortRegional,
    },
  };
})();
