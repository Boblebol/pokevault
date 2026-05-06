import assert from "node:assert/strict";
import { test } from "node:test";

function installBrowserStubs() {
  globalThis.__POKEVAULT_FILTERS_TESTS__ = true;
  globalThis.window = globalThis;
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/pokedex-filters.js?case=${Date.now()}`);
  return globalThis.window.PokevaultFilters._test;
}

test("matchesPokemonFilters combines status region type and regional forms", async () => {
  const api = await loadModule();
  const pokemon = {
    slug: "0052-meowth-alola",
    number: "#052",
    region: "alola",
    form: "Forme d'Alola",
    types: ["dark"],
  };

  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: {
      status: "missing",
      region: "alola",
      forms: "regional_only",
      type: "dark",
      tags: [],
    },
    caughtMap: {},
    statusMap: {},
    narrativeTagsFor: () => ["regional"],
  }), true);

  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: {
      status: "caught",
      region: "alola",
      forms: "regional_only",
      type: "dark",
      tags: [],
    },
    caughtMap: {},
    statusMap: {},
    narrativeTagsFor: () => ["regional"],
  }), false);

  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: {
      status: "missing",
      region: "alola",
      forms: "base_only",
      type: "dark",
      tags: [],
    },
    caughtMap: {},
    statusMap: {},
  }), false);
});

test("matchesPokemonFilters supports only all missing and caught status filters", async () => {
  const api = await loadModule();
  const pokemon = { slug: "0025-pikachu", number: "#025", region: "kanto", types: ["electric"] };
  const statusMap = {
    "0025-pikachu": { state: "caught", shiny: true },
  };

  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: { status: "caught", region: "all", forms: "all", type: "all", tags: [] },
    caughtMap: {},
    statusMap,
  }), true);
  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: { status: "missing", region: "all", forms: "all", type: "all", tags: [] },
    caughtMap: {},
    statusMap,
  }), false);
  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: { status: "all", region: "all", forms: "all", type: "all", tags: [] },
    caughtMap: {},
    statusMap,
  }), true);
});

test("matchesPokemonFilters exposes an empty filtered state", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "0001-bulbasaur", number: "#001", region: "kanto", types: ["grass"] },
    { slug: "0152-chikorita", number: "#152", region: "johto", types: ["grass"] },
  ];

  const rows = pool.filter((pokemon) => api.matchesPokemonFilters(pokemon, {
    filters: { status: "missing", region: "kanto", forms: "all", type: "fire", tags: [] },
    caughtMap: {},
    statusMap: {},
  }));

  assert.deepEqual(rows, []);
});

test("parseFilterHash normalizes legacy status filters to all", async () => {
  const api = await loadModule();

  const parsed = api.parseFilterHash(
    "#/liste?status=seen&region=johto&forms=regional&type=fire&tags=starter,legendary",
    {
      regionIds: ["kanto", "johto"],
      typeIds: ["fire", "water"],
      tagIds: ["starter", "legendary"],
    },
  );

  assert.equal(parsed.view, "liste");
  assert.deepEqual(parsed.filters, {
    status: "all",
    region: "johto",
    forms: "regional_only",
    type: "fire",
    tags: ["starter", "legendary"],
  });
});

test("buildFilterHash preserves existing route params while writing filters", async () => {
  const api = await loadModule();

  const next = api.buildFilterHash("#/liste?slug=0025-pikachu&status=missing", {
    status: "hunts",
    region: "kanto",
    forms: "regional_only",
    type: "electric",
    tags: ["starter"],
  });
  const [, query = ""] = next.split("?");
  const params = new URLSearchParams(query);

  assert.equal(next.startsWith("#/liste?"), true);
  assert.equal(params.get("slug"), "0025-pikachu");
  assert.equal(params.get("status"), null);
  assert.equal(params.get("region"), "kanto");
  assert.equal(params.get("forms"), "regional");
  assert.equal(params.get("type"), "electric");
  assert.equal(params.get("tags"), "starter");
});

test("matchesPokemonFilters ignores removed hunt predicate", async () => {
  const api = await loadModule();
  const pokemon = { slug: "0025-pikachu", number: "#025", region: "kanto", types: ["electric"] };

  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: { status: "hunts", region: "all", forms: "all", type: "all", tags: [] },
    caughtMap: {},
    statusMap: {},
    isWanted() {
      throw new Error("hunt predicate should not be used");
    },
  }), true);
});
