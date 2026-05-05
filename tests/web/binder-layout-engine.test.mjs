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

test("computeBinderSlots emits page, sheet, face, row and column metadata", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "kanto", name: "Kanto", rows: 2, cols: 2, sheet_count: 2 },
    pokemon: makePokemon(5),
    defs: [{ id: "kanto", low: 1, high: 151 }],
    includeCapacity: true,
  });

  assert.equal(slots.length, 16);
  assert.deepEqual(
    slots.slice(0, 5).map((slot) => ({
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
      { page: 1, sheet: 1, face: "R", slot: 3, row: 2, col: 1, slug: "0003-pokemon-3", emptyKind: null },
      { page: 1, sheet: 1, face: "R", slot: 4, row: 2, col: 2, slug: "0004-pokemon-4", emptyKind: null },
      { page: 2, sheet: 1, face: "V", slot: 1, row: 1, col: 1, slug: "0005-pokemon-5", emptyKind: null },
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
    binder: { id: "tiny", name: "Tiny", rows: 1, cols: 2, sheet_count: 1 },
    pokemon: makePokemon(6),
    defs: [{ id: "kanto", low: 1, high: 151 }],
    includeCapacity: true,
  });

  assert.equal(slots.length, 4);
  assert.deepEqual(
    slots.map((slot) => slot.pokemon?.slug),
    ["0001-pokemon-1", "0002-pokemon-2", "0003-pokemon-3", "0004-pokemon-4"],
  );
});

test("family slots preserve intentional holes and expose reserved metadata", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 2, cols: 3, sheet_count: 1 },
    pokemon: [
      { slug: "0133-eevee", number: "0133" },
      { slug: "0134-vaporeon", number: "0134" },
      { slug: "0135-jolteon", number: "0135" },
    ],
    familyData: {
      families: [
        {
          id: "0133-eevee",
          layout_rows: [
            ["0133-eevee", "0134-vaporeon"],
            [null, "0135-jolteon"],
          ],
        },
      ],
    },
  });

  assert.deepEqual(
    slots.map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId]),
    [
      ["0133-eevee", null, "0133-eevee"],
      ["0134-vaporeon", null, "0133-eevee"],
      [null, "family_reserved", "0133-eevee"],
      [null, "family_reserved", "0133-eevee"],
      ["0135-jolteon", null, "0133-eevee"],
      [null, "family_reserved", "0133-eevee"],
    ],
  );
});

test("family slots preserve reserved-only rows inside represented family blocks", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 3, cols: 3, sheet_count: 1 },
    pokemon: [
      { slug: "0133-eevee", number: "0133" },
      { slug: "0134-vaporeon", number: "0134" },
    ],
    familyData: {
      families: [
        {
          id: "0133-eevee",
          layout_rows: [
            ["0133-eevee", "0134-vaporeon"],
            [null, "0135-jolteon"],
          ],
        },
      ],
    },
  });

  assert.deepEqual(
    slots.slice(3, 6).map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId]),
    [
      [null, "family_reserved", "0133-eevee"],
      [null, "family_reserved", "0133-eevee"],
      [null, "family_reserved", "0133-eevee"],
    ],
  );
});

test("family slots wrap overwide rows without dropping pokemon", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 2, cols: 2, sheet_count: 1 },
    pokemon: [
      { slug: "0001-a", number: "0001" },
      { slug: "0002-b", number: "0002" },
      { slug: "0003-c", number: "0003" },
    ],
    familyData: {
      families: [
        {
          id: "f1",
          layout_rows: [["0001-a", "0002-b", "0003-c"]],
        },
      ],
    },
  });

  assert.deepEqual(
    slots.map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId]),
    [
      ["0001-a", null, "f1"],
      ["0002-b", null, "f1"],
      ["0003-c", null, "f1"],
      [null, "family_reserved", "f1"],
    ],
  );
});

test("family block starts on next page when remaining rows cannot fit it", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 2, cols: 3, sheet_count: 2 },
    pokemon: [
      { slug: "0001-a", number: "0001" },
      { slug: "0002-b", number: "0002" },
      { slug: "0003-c", number: "0003" },
      { slug: "0004-d", number: "0004" },
      { slug: "0005-e", number: "0005" },
      { slug: "0006-f", number: "0006" },
      { slug: "0007-g", number: "0007" },
      { slug: "0008-h", number: "0008" },
      { slug: "0009-i", number: "0009" },
    ],
    familyData: {
      families: [
        { id: "f1", layout_rows: [["0001-a", "0002-b", "0003-c"]] },
        { id: "f2", layout_rows: [["0004-d", "0005-e", "0006-f"], ["0007-g", "0008-h", "0009-i"]] },
      ],
    },
    includeCapacity: true,
  });

  const f2First = slots.find((slot) => slot.pokemon?.slug === "0004-d");
  assert.equal(f2First.page, 2);
  assert.equal(slots[3].emptyKind, "capacity_empty");
  assert.equal(slots[4].emptyKind, "capacity_empty");
  assert.equal(slots[5].emptyKind, "capacity_empty");
});

test("family block starts on next page when compact row would split it", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 2, cols: 3, sheet_count: 2 },
    pokemon: [
      { slug: "0001-a", number: "0001" },
      { slug: "0002-b", number: "0002" },
      { slug: "0003-c", number: "0003" },
      { slug: "0004-d", number: "0004" },
      { slug: "0005-e", number: "0005" },
      { slug: "0006-f", number: "0006" },
      { slug: "0007-g", number: "0007" },
    ],
    familyData: {
      families: [
        { id: "f1", layout_rows: [["0001-a", "0002-b", "0003-c"]] },
        { id: "f2", layout_rows: [["0004-d", "0005-e"]] },
        { id: "f3", layout_rows: [["0006-f"], ["0007-g"]] },
      ],
    },
    includeCapacity: true,
  });

  const f3First = slots.find((slot) => slot.pokemon?.slug === "0006-f");
  assert.equal(f3First.page, 2);
  assert.deepEqual(
    slots.slice(0, 6).map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId]),
    [
      ["0001-a", null, "f1"],
      ["0002-b", null, "f1"],
      ["0003-c", null, "f1"],
      ["0004-d", null, "f2"],
      ["0005-e", null, "f2"],
      [null, "alignment_empty", null],
    ],
  );
});

test("family block shares a partial row when all its rows still fit the page", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 2, cols: 3, sheet_count: 2 },
    pokemon: [
      { slug: "0001-a", number: "0001" },
      { slug: "0002-b", number: "0002" },
      { slug: "0003-c", number: "0003" },
    ],
    familyData: {
      families: [
        { id: "f1", layout_rows: [["0001-a"]] },
        { id: "f2", layout_rows: [["0002-b"], ["0003-c"]] },
      ],
    },
    includeCapacity: true,
  });

  assert.deepEqual(
    slots.slice(0, 6).map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId, slot.page]),
    [
      ["0001-a", null, "f1", 1],
      ["0002-b", null, "f2", 1],
      [null, "family_reserved", "f2", 1],
      ["0003-c", null, "f2", 1],
      [null, "family_reserved", "f2", 1],
      [null, "family_reserved", "f2", 1],
    ],
  );
});

test("orderPokemonForBinder preserves page-aware family gaps", async () => {
  const api = await loadEngine();
  const ordered = api.orderPokemonForBinder({
    binder: { id: "families", name: "Familles", organization: "family", rows: 2, cols: 3, sheet_count: 2 },
    pokemon: [
      { slug: "0001-a", number: "0001" },
      { slug: "0002-b", number: "0002" },
      { slug: "0003-c", number: "0003" },
      { slug: "0004-d", number: "0004" },
      { slug: "0005-e", number: "0005" },
      { slug: "0006-f", number: "0006" },
      { slug: "0007-g", number: "0007" },
      { slug: "0008-h", number: "0008" },
      { slug: "0009-i", number: "0009" },
    ],
    familyData: {
      families: [
        { id: "f1", layout_rows: [["0001-a", "0002-b", "0003-c"]] },
        { id: "f2", layout_rows: [["0004-d", "0005-e", "0006-f"], ["0007-g", "0008-h", "0009-i"]] },
      ],
    },
  });

  assert.deepEqual(
    ordered.map((p) => p?.slug || null),
    [
      "0001-a",
      "0002-b",
      "0003-c",
      null,
      null,
      null,
      "0004-d",
      "0005-e",
      "0006-f",
      "0007-g",
      "0008-h",
      "0009-i",
    ],
  );
});

test("family layout packs a complete solo family into remaining row cells", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 3, cols: 3, sheet_count: 1 },
    pokemon: [
      { slug: "0325-spoink", number: "0325" },
      { slug: "0326-grumpig", number: "0326" },
      { slug: "0327-spinda", number: "0327" },
    ],
    familyData: {
      families: [
        { id: "0325-spoink", layout_rows: [["0325-spoink", "0326-grumpig"]] },
        { id: "0327-spinda", layout_rows: [["0327-spinda"]] },
      ],
    },
  });

  assert.deepEqual(
    slots.slice(0, 3).map((slot) => [slot.pokemon?.slug || null, slot.emptyKind]),
    [
      ["0325-spoink", null],
      ["0326-grumpig", null],
      ["0327-spinda", null],
    ],
  );
});

test("family layout preserves explicit holes before Tarpaud as family reserved", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 3, cols: 3, sheet_count: 1 },
    pokemon: [
      { slug: "0060-ptitard", number: "0060" },
      { slug: "0061-tetarte", number: "0061" },
      { slug: "0062-tartard", number: "0062" },
      { slug: "0186-tarpaud", number: "0186" },
    ],
    familyData: {
      families: [
        {
          id: "0060-ptitard",
          layout_rows: [
            ["0060-ptitard", "0061-tetarte", "0062-tartard"],
            [null, null, "0186-tarpaud"],
          ],
        },
      ],
    },
  });

  assert.deepEqual(
    slots.slice(3, 6).map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId]),
    [
      [null, "family_reserved", "0060-ptitard"],
      [null, "family_reserved", "0060-ptitard"],
      ["0186-tarpaud", null, "0060-ptitard"],
    ],
  );
});

test("family layout closes a short branch row when the next family row cannot fit", async () => {
  const api = await loadEngine();
  const slots = api.computeBinderSlots({
    binder: { id: "families", name: "Familles", organization: "family", rows: 3, cols: 3, sheet_count: 1 },
    pokemon: [
      { slug: "0060-poliwag", number: "0060" },
      { slug: "0061-poliwhirl", number: "0061" },
      { slug: "0062-poliwrath", number: "0062" },
      { slug: "0186-politoed", number: "0186" },
      { slug: "0063-abra", number: "0063" },
      { slug: "0064-kadabra", number: "0064" },
      { slug: "0065-alakazam", number: "0065" },
    ],
    familyData: {
      families: [
        {
          id: "0060-poliwag",
          layout_rows: [
            ["0060-poliwag", "0061-poliwhirl", "0062-poliwrath"],
            ["0186-politoed"],
          ],
        },
        {
          id: "0063-abra",
          layout_rows: [["0063-abra", "0064-kadabra", "0065-alakazam"]],
        },
      ],
    },
  });

  assert.deepEqual(
    slots.slice(0, 9).map((slot) => [slot.pokemon?.slug || null, slot.emptyKind, slot.familyId]),
    [
      ["0060-poliwag", null, "0060-poliwag"],
      ["0061-poliwhirl", null, "0060-poliwag"],
      ["0062-poliwrath", null, "0060-poliwag"],
      ["0186-politoed", null, "0060-poliwag"],
      [null, "alignment_empty", null],
      [null, "alignment_empty", null],
      ["0063-abra", null, "0063-abra"],
      ["0064-kadabra", null, "0063-abra"],
      ["0065-alakazam", null, "0063-abra"],
    ],
  );
});
