import assert from "node:assert/strict";
import { test } from "node:test";

async function loadModule() {
  globalThis.__POKEVAULT_CAPTURE_SCOPE_TESTS__ = true;
  globalThis.window = globalThis;
  await import(`../../web/pokemon-capture-scope.js?case=${Date.now()}-${Math.random()}`);
  return globalThis.window.PokevaultCaptureScope._test;
}

test("classifies base and regional forms as capturable", async () => {
  const api = await loadModule();

  assert.equal(api.isCapturablePokemonEntry({ slug: "0025-pikachu", number: "0025", form: null }), true);
  assert.equal(api.isCapturablePokemonEntry({ slug: "0052-meowth-alola", form: "Forme d'Alola" }), true);
  assert.equal(api.isCapturablePokemonEntry({ slug: "0052-meowth-galar", form: "Forme de Galar" }), true);
  assert.equal(api.isCapturablePokemonEntry({ slug: "0550-basculin-white-striped-form", form: "Forme de Hisui" }), true);
  assert.equal(api.isCapturablePokemonEntry({ slug: "0194-wooper-paldea", form: "Forme de Paldea" }), true);
});

test("classifies non-regional alternate forms as informational", async () => {
  const api = await loadModule();

  assert.equal(api.isCapturablePokemonEntry({ slug: "0006-charizard-mega-x", form: "Méga X" }), false);
  assert.equal(api.isCapturablePokemonEntry({ slug: "0025-pikachu-world-cap", form: "Casquette Monde" }), false);
  assert.equal(api.isCapturablePokemonEntry({ slug: "0351-castform-sunny-form", form: "Forme Solaire" }), false);
  assert.equal(api.isCapturablePokemonEntry({ slug: "1024-terapagos-stellar-form", form: "Forme Stellaire" }), false);
});

test("filters a pokedex list down to capturable entries", async () => {
  const api = await loadModule();
  const rows = [
    { slug: "0001-bulbasaur", number: "0001", form: null },
    { slug: "0003-venusaur-mega", number: "0003", form: "Méga" },
    { slug: "0052-meowth-alola", number: "0052", form: "Forme d'Alola" },
  ];

  assert.deepEqual(api.capturablePokemonEntries(rows).map((p) => p.slug), [
    "0001-bulbasaur",
    "0052-meowth-alola",
  ]);
});
