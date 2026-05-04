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
