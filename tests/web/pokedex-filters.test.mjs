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

  // Hide missing: false, Hide caught: false -> show all
  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: {
      hideCaught: false,
      hideMissing: false,
      region: "alola",
      forms: "regional_only",
      type: "dark",
      tags: [],
    },
    caughtMap: {},
    statusMap: {},
    narrativeTagsFor: () => ["regional"],
  }), true);

  // Hide missing: true -> hide because not caught
  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: {
      hideCaught: false,
      hideMissing: true,
      region: "alola",
      forms: "regional_only",
      type: "dark",
      tags: [],
    },
    caughtMap: {},
    statusMap: {},
    narrativeTagsFor: () => ["regional"],
  }), false);

  // Hide caught: true -> show because not caught
  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: {
      hideCaught: true,
      hideMissing: false,
      region: "alola",
      forms: "regional_only",
      type: "dark",
      tags: [],
    },
    caughtMap: {},
    statusMap: {},
    narrativeTagsFor: () => ["regional"],
  }), true);
});

test("matchesPokemonFilters supports independent hide toggles", async () => {
  const api = await loadModule();
  const pokemon = { slug: "0025-pikachu", number: "#025", region: "kanto", types: ["electric"] };
  const statusMap = {
    "0025-pikachu": { state: "caught", shiny: true },
  };

  // Caught pokemon, hideCaught: true -> false
  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: { hideCaught: true, hideMissing: false, region: "all", forms: "all", type: "all", tags: [] },
    caughtMap: {},
    statusMap,
  }), false);

  // Caught pokemon, hideMissing: true -> true
  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: { hideCaught: false, hideMissing: true, region: "all", forms: "all", type: "all", tags: [] },
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
    filters: { hideCaught: false, hideMissing: true, region: "kanto", forms: "all", type: "fire", tags: [] },
    caughtMap: {},
    statusMap: {},
  }));

  assert.deepEqual(rows, []);
});

test("parseFilterHash parses hc and hm params", async () => {
  const api = await loadModule();

  const parsed = api.parseFilterHash(
    "#/liste?hc=1&region=johto&forms=regional&type=fire&tags=starter,legendary",
    {
      regionIds: ["kanto", "johto"],
      typeIds: ["fire", "water"],
      tagIds: ["starter", "legendary"],
    },
  );

  assert.equal(parsed.view, "liste");
  assert.deepEqual(parsed.filters, {
    hideCaught: true,
    hideMissing: false,
    region: "johto",
    forms: "regional_only",
    type: "fire",
    tags: ["starter", "legendary"],
  });
});

test("buildFilterHash uses hc and hm params", async () => {
  const api = await loadModule();

  const next = api.buildFilterHash("#/liste?slug=0025-pikachu", {
    hideCaught: false,
    hideMissing: true,
    region: "kanto",
    forms: "regional_only",
    type: "electric",
    tags: ["starter"],
  });
  const [, query = ""] = next.split("?");
  const params = new URLSearchParams(query);

  assert.equal(next.startsWith("#/liste?"), true);
  assert.equal(params.get("slug"), "0025-pikachu");
  assert.equal(params.get("hc"), null);
  assert.equal(params.get("hm"), "1");
  assert.equal(params.get("region"), "kanto");
  assert.equal(params.get("forms"), "regional");
  assert.equal(params.get("type"), "electric");
  assert.equal(params.get("tags"), "starter");
});

test("matchesPokemonFilters ignores removed hunt predicate", async () => {
  const api = await loadModule();
  const pokemon = { slug: "0025-pikachu", number: "#025", region: "kanto", types: ["electric"] };

  assert.equal(api.matchesPokemonFilters(pokemon, {
    filters: { hideCaught: false, hideMissing: false, region: "all", forms: "all", type: "all", tags: [] },
    caughtMap: {},
    statusMap: {},
    isWanted() {
      throw new Error("hunt predicate should not be used");
    },
  }), true);
});
