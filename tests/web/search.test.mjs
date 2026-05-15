import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

function installBrowserStubs() {
  globalThis.__POKEVAULT_APP_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.location = { hash: "#/liste" };
  globalThis.history = { replaceState() {} };
  globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
  };
  globalThis.document = {
    title: "",
    addEventListener() {},
    querySelectorAll() { return []; },
    getElementById(id) {
      if (id === "search") return { addEventListener() {} };
      return null;
    },
  };
  globalThis.addEventListener = () => {};
}

async function loadModule() {
  installBrowserStubs();
  importCase += 1;
  await import(`../../web/app.js?case=${Date.now()}-${importCase}`);
  return globalThis.window.PokedexCollection.matchesSearch;
}

test("matchesSearch matches by name", async () => {
  const matchesSearch = await loadModule();
  const bulbasaur = {
    slug: "0001-bulbasaur",
    number: "0001",
    names: { fr: "Bulbizarre", en: "Bulbasaur" },
    types: ["grass", "poison"]
  };

  assert.equal(matchesSearch(bulbasaur, "bulb"), true);
  assert.equal(matchesSearch(bulbasaur, "bulbasaur"), true);
  assert.equal(matchesSearch(bulbasaur, "bizarre"), true);
  assert.equal(matchesSearch(bulbasaur, "charmander"), false);
});

test("matchesSearch matches by number", async () => {
  const matchesSearch = await loadModule();
  const bulbasaur = {
    slug: "0001-bulbasaur",
    number: "0001",
    names: { fr: "Bulbizarre", en: "Bulbasaur" },
    types: ["grass", "poison"]
  };

  assert.equal(matchesSearch(bulbasaur, "001"), true);
  assert.equal(matchesSearch(bulbasaur, "#0001"), true);
  assert.equal(matchesSearch(bulbasaur, "1"), true);
});

test("matchesSearch matches by type", async () => {
  const matchesSearch = await loadModule();
  const bulbasaur = {
    slug: "0001-bulbasaur",
    number: "0001",
    names: { fr: "Bulbizarre", en: "Bulbasaur" },
    types: ["grass", "poison"]
  };

  assert.equal(matchesSearch(bulbasaur, "grass"), true);
  assert.equal(matchesSearch(bulbasaur, "poison"), true);
  assert.equal(matchesSearch(bulbasaur, "fire"), false);
});

test("matchesSearch is diacritic insensitive", async () => {
  const matchesSearch = await loadModule();
  const p = {
    slug: "0006-charizard",
    names: { fr: "Dracaufeu" }
  };

  assert.equal(matchesSearch(p, "dracaufeu"), true);
  assert.equal(matchesSearch(p, "dracauféu"), true);
});

test("matchesSearch is fuzzy", async () => {
  const matchesSearch = await loadModule();
  const p = {
    slug: "0006-charizard",
    names: { fr: "Dracaufeu" }
  };

  assert.equal(matchesSearch(p, "dracauf"), true); // substring
  assert.equal(matchesSearch(p, "dracafeu"), true); // fuzzy levenshtein (dist 1)
});
