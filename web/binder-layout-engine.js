(function initBinderLayoutEngine() {
  "use strict";

  function positiveInt(value, fallback) {
    const n = Number.parseInt(String(value), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function normalizedLayout(binder = {}) {
    const rows = 3;
    const cols = 3;
    const sheets = positiveInt(binder.sheet_count ?? binder.sheetCount, 10);
    const perPage = 9;
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
    const regionalFormRegions = ["alola", "galar", "hisui", "paldea"];
    if (p?.region && regionalFormRegions.includes(p.region)) return p.region;
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

  function isRegionalFamilyAlbum(binder = {}) {
    return binder.organization === "regional_family_album";
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

  function padToNextSheetRecto(items, layout) {
    const sheetSize = layout.perPage * 2;
    while (items.length % sheetSize !== 0) items.push(capacityItem());
    return items;
  }

  function familyReservedItem(familyId) {
    return { pokemon: null, emptyKind: "family_reserved", familyId };
  }

  function alignmentEmptyItem() {
    return { pokemon: null, emptyKind: "alignment_empty", familyId: null };
  }

  function padRowToColumns(row, cols, familyId, emptyKind = "family_reserved") {
    const out = row.slice(0, cols);
    while (out.length < cols) {
      if (emptyKind === "capacity_empty") out.push(capacityItem());
      else if (emptyKind === "alignment_empty") out.push(alignmentEmptyItem());
      else out.push(familyReservedItem(familyId));
    }
    return out;
  }

  function chunkRowToColumns(row, cols) {
    const chunks = [];
    const width = positiveInt(cols, 3);
    for (let start = 0; start < row.length; start += width) {
      chunks.push(row.slice(start, start + width));
    }
    return chunks.length ? chunks : [[]];
  }

  function familyLayoutBlocks(pokemon = [], familyData = null, cols = 3, options = {}) {
    const reserveMissingSlugs = options.reserveMissingSlugs !== false;
    const continuousAlignment = options.continuousAlignment === true;
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
      let blockRows = [];
      let hasRepresentedPokemon = false;

      if (continuousAlignment) {
        let members = Array.isArray(family?.members) ? family.members : [];
        if (members.length === 0 && Array.isArray(family?.layout_rows)) {
          members = family.layout_rows.flat().filter((s) => !!s);
        }
        const familyItems = [];
        for (const slug of members) {
          const p = bySlug.get(slug);
          if (p && !emitted.has(slug)) {
            familyItems.push(pokemonItem(p, familyId));
            emitted.add(slug);
            hasRepresentedPokemon = true;
          }
        }
        if (hasRepresentedPokemon) {
          blockRows = chunkRowToColumns(familyItems, cols);
          const lastRow = blockRows[blockRows.length - 1];
          while (lastRow.length < cols) {
            lastRow.push(alignmentEmptyItem());
          }
        }
      } else {
        const rows = Array.isArray(family?.layout_rows) ? family.layout_rows : [];
        for (const rawRow of rows) {
          if (!Array.isArray(rawRow)) continue;
          const row = [];
          let rowHasPokemon = false;
          for (const slugRaw of rawRow) {
            if (!slugRaw) {
              row.push(familyReservedItem(familyId));
              continue;
            }
            const slug = String(slugRaw);
            const p = bySlug.get(slug);
            if (!p || emitted.has(slug)) {
              if (reserveMissingSlugs) row.push(familyReservedItem(familyId));
              continue;
            }
            row.push(pokemonItem(p, familyId));
            emitted.add(slug);
            rowHasPokemon = true;
            hasRepresentedPokemon = true;
          }
          if (rowHasPokemon || reserveMissingSlugs) blockRows.push(...chunkRowToColumns(row, cols));
        }
      }

      if (hasRepresentedPokemon) blocks.push({ familyId, rows: blockRows });
    }
    const leftovers = sortNational(
      pokemon.filter((p) => p?.slug && !emitted.has(String(p.slug))),
    );
    for (const p of leftovers) {
      const familyId = String(p.slug || "");
      blocks.push({
        familyId,
        rows: [[pokemonItem(p, familyId)]],
      });
    }
    return blocks;
  }

  function flattenFamilyBlocksPageAware(blocks = [], layout, options = {}) {
    const strictRowAlign = options.strictRowAlign === true;
    const out = [];
    let rowInPage = 0;
    let currentRow = null;
    let currentFamilyId = null;

    function flushCurrent(emptyKind = "alignment_empty", familyId = null) {
      if (!currentRow) return;
      out.push(...padRowToColumns(currentRow, layout.cols, familyId, emptyKind));
      currentRow = null;
      currentFamilyId = null;
      rowInPage = (rowInPage + 1) % layout.rows;
    }

    function closePageWithCapacity() {
      while (rowInPage < layout.rows) {
        out.push(...padRowToColumns([], layout.cols, null, "capacity_empty"));
        rowInPage += 1;
      }
      rowInPage = 0;
    }

    function startNextPageIfBlockWouldSplit(blockRowCount) {
      if (
        rowInPage > 0 &&
        blockRowCount <= layout.rows &&
        rowInPage + blockRowCount > layout.rows
      ) {
        closePageWithCapacity();
      }
    }

    function currentPageRowsNeededForBlock(blockRows) {
      const firstRow = blockRows[0] || [];
      const firstRowSharesCurrent = currentRow && currentRow.length + firstRow.length <= layout.cols;
      return blockRows.length + (firstRowSharesCurrent ? 0 : 1);
    }

    for (const block of blocks) {
      const blockRows = block.rows || [];

      if (strictRowAlign && currentRow && blockRows.length > 1) {
        flushCurrent("alignment_empty", null);
      }

      if (
        currentRow &&
        blockRows.length <= layout.rows &&
        rowInPage + currentPageRowsNeededForBlock(blockRows) > layout.rows
      ) {
        flushCurrent("alignment_empty", null);
        startNextPageIfBlockWouldSplit(blockRows.length);
      }
      if (!currentRow) startNextPageIfBlockWouldSplit(blockRows.length);

      for (let rowIndex = 0; rowIndex < blockRows.length; rowIndex += 1) {
        const row = blockRows[rowIndex] || [];
        if (rowIndex > 0) flushCurrent();

        if (currentRow && currentRow.length + row.length > layout.cols) {
          flushCurrent("alignment_empty", null);
          startNextPageIfBlockWouldSplit(blockRows.length - rowIndex);
        }

        if (!currentRow) {
          currentRow = [];
          currentFamilyId = block.familyId;
        }

        currentRow.push(...row);
        currentFamilyId = block.familyId;
        if (currentRow.length >= layout.cols) flushCurrent();
      }
    }

    flushCurrent();
    return out;
  }

  function regionalFamilyAlbumItems(pokemon = [], defs = [], familyData = null, layout, familyGroup = "aligned") {
    const useFamilyBlocks = familyGroup !== "compact";
    const continuousAlignment = familyGroup === "aligned";

    if (!defs.length) {
      if (familyData && Array.isArray(familyData.families) && useFamilyBlocks) {
        return flattenFamilyBlocksPageAware(
          familyLayoutBlocks(pokemon, familyData, layout.cols, { continuousAlignment }),
          layout,
          { strictRowAlign: true },
        );
      }
      return sortNational(pokemon).map((p) => pokemonItem(p));
    }

    const out = [];
    for (let idx = 0; idx < defs.length; idx += 1) {
      const regionId = defs[idx]?.id;
      if (!regionId) continue;
      if (idx > 0) padToNextSheetRecto(out, layout);

      const regionPokemon = pokemon.filter((p) => effectiveRegionId(p, defs) === regionId);
      if (familyData && Array.isArray(familyData.families) && useFamilyBlocks) {
        out.push(
          ...flattenFamilyBlocksPageAware(
            familyLayoutBlocks(regionPokemon, familyData, layout.cols, {
              reserveMissingSlugs: false,
              continuousAlignment,
            }),
            layout,
            { strictRowAlign: true },
          ),
        );
      } else {
        out.push(...sortNational(regionPokemon).map((p) => pokemonItem(p)));
      }
    }
    return out;
  }

  function basicItemsForBinder(binder = {}, pokemon = [], defs = [], familyData = null) {
    const layout = normalizedLayout(binder);
    const familyGroup = binder.family_group || binder.binder_family_group || "aligned";

    if (isRegionalFamilyAlbum(binder)) {
      return regionalFamilyAlbumItems(pokemon, defs, familyData, layout, familyGroup);
    }

    const scoped = applyBinderScope(pokemon, binder, defs);
    const sorted = sortNational(scoped);
    return sorted.map((p) => pokemonItem(p));
  }

  function computeBinderSlots({ binder = {}, pokemon = [], defs = [], familyData = null, includeCapacity = false } = {}) {
    const layout = normalizedLayout(binder);
    const baseItems = basicItemsForBinder(binder, pokemon, defs, familyData);
    const ranged = isRegionalFamilyAlbum(binder) ? baseItems : applyBinderRange(baseItems, binder);
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
    return slots.map((slot) => slot.pokemon || null);
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
      isRegionalFamilyAlbum,
      normalizedLayout,
      orderPokemonForBinder,
      padToNextSheetRecto,
      regionalFamilyAlbumItems,
      slotMeta,
      sortNational,
    },
  };
})();
