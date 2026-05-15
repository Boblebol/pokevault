import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

async function loadEngine() {
  globalThis.window = globalThis;
  importCase += 1;
  await import(`../../web/binder-layout-engine.js?case=${Date.now()}-${importCase}`);
  return globalThis.window.PokevaultBinderLayout._test;
}

function makePokemon(count, region = "kanto") {
  return Array.from({ length: count }, (_, idx) => {
    const n = idx + 1;
    const number = String(n).padStart(4, "0");
    return {
      slug: `${number}-pokemon-${n}`,
      number,
      names: { fr: `Pokemon ${n}`, en: `Pokemon ${n}` },
      region,
    };
  });
}

test("normalizedLayout always returns 3x3 grid", async () => {
  const api = await loadEngine();
  const layout = api.normalizedLayout({ rows: 4, cols: 5, sheetCount: 10 });
  assert.equal(layout.rows, 3);
  assert.equal(layout.cols, 3);
  assert.equal(layout.perPage, 9);
});

test("computeBinderSlots emits page, sheet, face, row and column metadata", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "kanto", name: "Kanto", rows: 3, cols: 3, sheet_count: 2 },
    pokemon: makePokemon(10),
    defs: [{ id: "kanto", low: 1, high: 151 }],
    includeCapacity: true,
  });

  assert.equal(slots.length, 36); // 9 * 2 * 2
  assert.deepEqual(
    slots.slice(0, 10).map((slot) => ({
      page: slot.page,
      sheet: slot.sheet,
      face: slot.face,
      slot: slot.slot,
      row: slot.row,
      col: slot.col,
      slug: slot.pokemon?.slug || null,
      emptyKind: slot.emptyKind,
    })),
    [
      { page: 1, sheet: 1, face: "R", slot: 1, row: 1, col: 1, slug: "0001-pokemon-1", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 2, row: 1, col: 2, slug: "0002-pokemon-2", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 3, row: 1, col: 3, slug: "0003-pokemon-3", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 4, row: 2, col: 1, slug: "0004-pokemon-4", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 5, row: 2, col: 2, slug: "0005-pokemon-5", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 6, row: 2, col: 3, slug: "0006-pokemon-6", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 7, row: 3, col: 1, slug: "0007-pokemon-7", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 8, row: 3, col: 2, slug: "0008-pokemon-8", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 9, row: 3, col: 3, slug: "0009-pokemon-9", emptyKind: null },
      { page: 2, sheet: 1, face: "V", slot: 1, row: 1, col: 1, slug: "0010-pokemon-10", emptyKind: null },
    ],
  );
  assert.equal(slots.at(-1).emptyKind, "capacity_empty");
});

test("orderPokemonForBinder preserves regional range behavior", async () => {
  const api = await loadEngine();
  const ordered = api.orderPokemonForBinder({
    binder: {
      id: "kanto-2",
      organization: "national",
      region_scope: "kanto",
      range_start: 8,
      range_limit: 8,
    },
    pokemon: makePokemon(10),
    defs: [{ id: "kanto", low: 1, high: 151 }],
  });

  assert.deepEqual(
    ordered.map((p) => p.slug),
    ["0009-pokemon-9", "0010-pokemon-10"],
  );
});

test("computeBinderSlots caps capacity output when pokemon exceed physical slots", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "tiny", name: "Tiny", rows: 1, cols: 2, sheet_count: 1 }, // Will be 3x3, so 18 slots
    pokemon: makePokemon(25),
    defs: [{ id: "kanto", low: 1, high: 151 }],
    includeCapacity: true,
  });

  assert.equal(slots.length, 18);
  assert.deepEqual(
    slots.map((slot) => slot.pokemon?.slug).slice(0, 5),
    ["0001-pokemon-1", "0002-pokemon-2", "0003-pokemon-3", "0004-pokemon-4", "0005-pokemon-5"],
  );
});

test("regional family album starts each region on a new sheet recto", async () => {
  const api = await loadEngine();
  const defs = [
    { id: "kanto", low: 1, high: 151 },
    { id: "johto", low: 152, high: 251 },
  ];
  const pokemon = [
    { slug: "0001-bulbasaur", number: "0001", region: "kanto" },
    { slug: "0002-ivysaur", number: "0002", region: "kanto" },
    { slug: "0003-venusaur", number: "0003", region: "kanto" },
    { slug: "0152-chikorita", number: "0152", region: "johto" },
  ];
  const familyData = {
    families: [
      { id: "0001-bulbasaur", layout_rows: [["0001-bulbasaur", "0002-ivysaur", "0003-venusaur"]] },
      { id: "0152-chikorita", layout_rows: [["0152-chikorita"]] },
    ],
  };

  const slots = api.computeBinderSlots({
    binder: { id: "grand", organization: "regional_family_album", rows: 3, cols: 3, sheet_count: 2 },
    pokemon,
    defs,
    familyData,
    includeCapacity: true,
  });

  assert.equal(slots.length, 36); // 9 * 2 * 2
  assert.deepEqual(
    slots.map((slot) => ({
      page: slot.page,
      sheet: slot.sheet,
      face: slot.face,
      slug: slot.pokemon?.slug || null,
      emptyKind: slot.emptyKind,
    })).slice(0, 20),
    [
      { page: 1, sheet: 1, face: "R", slug: "0001-bulbasaur", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slug: "0002-ivysaur", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slug: "0003-venusaur", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slug: null, emptyKind: "capacity_empty" },
      { page: 1, sheet: 1, face: "R", slug: null, emptyKind: "capacity_empty" },
      { page: 1, sheet: 1, face: "R", slug: null, emptyKind: "capacity_empty" },
      { page: 1, sheet: 1, face: "R", slug: null, emptyKind: "capacity_empty" },
      { page: 1, sheet: 1, face: "R", slug: null, emptyKind: "capacity_empty" },
      { page: 1, sheet: 1, face: "R", slug: null, emptyKind: "capacity_empty" },
      // Page 2 (Verso of Sheet 1) is capacity_empty until Sheet 2
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      { page: 2, sheet: 1, face: "V", slug: null, emptyKind: "capacity_empty" },
      // Page 3 (Recto of Sheet 2) starts Johto
      { page: 3, sheet: 2, face: "R", slug: "0152-chikorita", emptyKind: null },
      { page: 3, sheet: 2, face: "R", slug: null, emptyKind: "alignment_empty" },
    ],
  );
});

test("regional family album keeps regional forms in their form region", async () => {
  const api = await loadEngine();
  const ordered = api.orderPokemonForBinder({
    binder: { id: "grand", organization: "regional_family_album", rows: 3, cols: 3, sheet_count: 2 },
    pokemon: [
      { slug: "0019-rattata", number: "0019", region: "kanto" },
      { slug: "0019-rattata-alola", number: "0019", region: "alola" },
    ],
    defs: [
      { id: "kanto", low: 1, high: 151 },
      { id: "alola", low: 722, high: 809 },
    ],
    familyData: {
      families: [
        { id: "0019-rattata", layout_rows: [["0019-rattata", "0019-rattata-alola"]] },
      ],
    },
  });

  assert.equal(ordered[0].slug, "0019-rattata");
  assert.equal(ordered[18].slug, "0019-rattata-alola");
  assert.equal(ordered.length, 21); // 1 rattata + 2 align + 15 capacity + 1 rattata-alola + 2 align
});

test("regional family album ignores stale binder scope and range fields", async () => {
  const api = await loadEngine();
  const ordered = api.orderPokemonForBinder({
    binder: {
      id: "grand",
      organization: "regional_family_album",
      rows: 3,
      cols: 3,
      sheet_count: 2,
      region_scope: "kanto",
      region_id: "kanto",
      range_start: 8,
      range_limit: 1,
    },
    pokemon: [
      { slug: "0001-bulbasaur", number: "0001", region: "kanto" },
      { slug: "0152-chikorita", number: "0152", region: "johto" },
    ],
    defs: [
      { id: "kanto", low: 1, high: 151 },
      { id: "johto", low: 152, high: 251 },
    ],
    familyData: {
      families: [
        { id: "0001-bulbasaur", layout_rows: [["0001-bulbasaur"]] },
        { id: "0152-chikorita", layout_rows: [["0152-chikorita"]] },
      ],
    },
  });

  assert.equal(ordered[0].slug, "0001-bulbasaur");
  assert.equal(ordered[18].slug, "0152-chikorita");
});

test("regional family album drops family rows emptied by regional filtering", async () => {
  const api = await loadEngine();
  const defs = [
    { id: "kanto", low: 1, high: 151 },
    { id: "alola", low: 722, high: 807 },
  ];
  const pokemon = [
    { slug: "0019-rattata", number: "0019", region: "kanto" },
    { slug: "0019-rattata-alola", number: "0019", region: "alola", region_native: false },
  ];
  const familyData = {
    families: [
      {
        id: "0019-rattata",
        layout_rows: [["0019-rattata"], ["0019-rattata-alola"]],
      },
    ],
  };

  const ordered = api.orderPokemonForBinder({
    binder: {
      id: "grand",
      organization: "regional_family_album",
      rows: 3,
      cols: 3,
      sheet_count: 2,
    },
    pokemon,
    defs,
    familyData,
  });

  assert.equal(ordered[0].slug, "0019-rattata");
  assert.equal(ordered[18].slug, "0019-rattata-alola");
});

test("regional family album drops reserved holes when a branch row has no regional pokemon", async () => {
  const api = await loadEngine();
  const defs = [
    { id: "kanto", low: 1, high: 151 },
    { id: "johto", low: 152, high: 251 },
  ];
  const pokemon = [
    { slug: "0043-oddish", number: "0043", region: "kanto" },
    { slug: "0044-gloom", number: "0044", region: "kanto" },
    { slug: "0045-vileplume", number: "0045", region: "kanto" },
    { slug: "0182-bellossom", number: "0182", region: "johto" },
  ];
  const familyData = {
    families: [
      {
        id: "0043-oddish",
        layout_rows: [
          ["0043-oddish", "0044-gloom", "0045-vileplume"],
          [null, null, "0182-bellossom"],
        ],
      },
    ],
  };

  const ordered = api.orderPokemonForBinder({
    binder: {
      id: "grand",
      organization: "regional_family_album",
      rows: 3,
      cols: 3,
      sheet_count: 2,
    },
    pokemon,
    defs,
    familyData,
  });

  assert.deepEqual(
    ordered.map((p) => p?.slug || null).slice(0, 4),
    ["0043-oddish", "0044-gloom", "0045-vileplume", null],
  );
  assert.equal(ordered[18 + 2].slug, "0182-bellossom"); // Sheet 1 (18 slots) then Sheet 2 Page 1 starts with Bellossom's row
});

test("regional family album strictly aligns multi-row blocks to start on new rows", async () => {
  const api = await loadEngine();
  const defs = [{ id: "kanto", low: 1, high: 151 }];
  const pokemon = [
    { slug: "0001-single", number: "0001", region: "kanto" },
    { slug: "0002-multi-1", number: "0002", region: "kanto" },
    { slug: "0003-multi-2", number: "0003", region: "kanto" },
    { slug: "0004-multi-3", number: "0004", region: "kanto" },
    { slug: "0005-multi-4", number: "0005", region: "kanto" },
  ];
  const familyData = {
    families: [
      { id: "0001-single", layout_rows: [["0001-single"]] },
      {
        id: "0002-multi",
        layout_rows: [
          ["0002-multi-1", "0003-multi-2"],
          ["0004-multi-3", "0005-multi-4"],
        ],
      },
    ],
  };

  const slots = api.computeBinderSlots({
    binder: { id: "test", organization: "regional_family_album", rows: 3, cols: 3, sheet_count: 1 },
    pokemon,
    defs,
    familyData,
    includeCapacity: false,
  });

  const slugsAndEmpties = slots.map(s => s.pokemon?.slug || s.emptyKind);
  
  assert.deepEqual(slugsAndEmpties.slice(0, 8), [
    "0001-single",
    "alignment_empty",
    "alignment_empty",
    "0002-multi-1",
    "0003-multi-2",
    "alignment_empty",
    "0004-multi-3",
    "0005-multi-4",
  ]);
});
