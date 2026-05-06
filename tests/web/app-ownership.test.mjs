import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

function installBrowserStubs() {
  globalThis.__POKEVAULT_APP_TESTS__ = true;
  globalThis.window = globalThis;
  delete globalThis.PokevaultTrainerContacts;
  delete globalThis.PokevaultPokemonFiche;
  globalThis.location = { hash: "#/settings" };
  globalThis.history = { replaceState() {} };
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  globalThis.document = {
    title: "",
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
  };
  globalThis.addEventListener = () => {};
}

async function loadModule() {
  installBrowserStubs();
  importCase += 1;
  await import(`../../web/app.js?case=${Date.now()}-${importCase}`);
  return globalThis.window.PokedexCollection._test;
}

function installRenderStubs() {
  const grid = { replaceChildren() {}, append() {} };
  const progressFill = { style: {}, parentElement: { setAttribute() {} } };
  const counter = { textContent: "" };
  globalThis.document.createElement = () => ({ className: "", textContent: "" });
  globalThis.document.getElementById = (id) => {
    if (id === "grid") return grid;
    if (id === "progressFill") return progressFill;
    if (id === "counter") return counter;
    return null;
  };
}

function installTrainerContactStubs(ownCard = { for_trade: [] }) {
  const membershipCalls = [];
  globalThis.PokevaultTrainerContacts = {
    getOwnCard() {
      return ownCard;
    },
    setOwnListMembership(slug, listName, enabled) {
      membershipCalls.push({ slug, listName, enabled });
      return Promise.resolve();
    },
  };
  return membershipCalls;
}

test("shouldDimCardForHighlight dims doubles as captured cards", async () => {
  const api = await loadModule();

  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: true, duplicate: false }),
    true,
  );
  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: true, duplicate: true }),
    true,
  );
  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: false, duplicate: false }),
    false,
  );
  assert.equal(
    api.shouldDimCardForHighlight("missing", { caught: false, duplicate: false }),
    true,
  );
  assert.equal(
    api.shouldDimCardForHighlight("missing", { caught: true, duplicate: true }),
    false,
  );
});

test("backup import accepts schema versions emitted by the backend", async () => {
  const api = await loadModule();

  assert.equal(api.isSupportedBackupSchemaVersion(1), true);
  assert.equal(api.isSupportedBackupSchemaVersion(2), true);
  assert.equal(api.isSupportedBackupSchemaVersion(3), true);
  assert.equal(api.isSupportedBackupSchemaVersion(4), true);
  assert.equal(api.isSupportedBackupSchemaVersion(5), false);
  assert.equal(api.isSupportedBackupSchemaVersion(99), false);
});

test("direct ownership updates map capture duplicate release-one and release-all semantics", async () => {
  await loadModule();
  installRenderStubs();
  const membershipCalls = installTrainerContactStubs();
  const collection = globalThis.window.PokedexCollection;

  collection.setStatus("0001-bulbasaur", "seen", false);
  await collection.setPokemonOwnershipState("0001-bulbasaur", "owned");
  assert.deepEqual(collection.getStatus("0001-bulbasaur"), { state: "caught", shiny: false });

  collection.setStatus("0002-ivysaur", "caught", true);
  await collection.setPokemonOwnershipState("0002-ivysaur", "duplicate");
  assert.deepEqual(collection.getStatus("0002-ivysaur"), { state: "caught", shiny: true });

  collection.setStatus("0003-venusaur", "caught", true);
  await collection.setPokemonOwnershipState("0003-venusaur", "release_one");
  assert.deepEqual(collection.getStatus("0003-venusaur"), { state: "caught", shiny: true });

  collection.setStatus("0004-charmander", "caught", true);
  await collection.setPokemonOwnershipState("0004-charmander", "none");
  assert.deepEqual(collection.getStatus("0004-charmander"), { state: "not_met", shiny: false });

  assert.deepEqual(membershipCalls, [
    { slug: "0001-bulbasaur", listName: "for_trade", enabled: false },
    { slug: "0002-ivysaur", listName: "for_trade", enabled: true },
    { slug: "0003-venusaur", listName: "for_trade", enabled: false },
    { slug: "0004-charmander", listName: "for_trade", enabled: false },
  ]);
});

test("cycleOwnershipBySlug follows simplified capture duplicate release formula", async () => {
  await loadModule();
  installRenderStubs();
  const collection = globalThis.window.PokedexCollection;
  globalThis.PokevaultPokemonFiche = {
    ownershipStateFromSources(slug, options = {}) {
      const key = String(slug || "").trim();
      const status = options.status || { state: "not_met" };
      const forTrade = Array.isArray(options.ownCard?.for_trade) ? options.ownCard.for_trade : [];
      const duplicate = forTrade.includes(key);
      return { caught: duplicate || status.state === "caught", duplicate };
    },
  };

  let membershipCalls = installTrainerContactStubs({ for_trade: [] });
  collection.cycleOwnershipBySlug("0007-squirtle", {});
  await Promise.resolve();
  assert.deepEqual(collection.getStatus("0007-squirtle"), { state: "caught", shiny: false });
  assert.deepEqual(membershipCalls.at(-1), { slug: "0007-squirtle", listName: "for_trade", enabled: false });

  membershipCalls = installTrainerContactStubs({ for_trade: [] });
  collection.setStatus("0008-wartortle", "caught", true);
  collection.cycleOwnershipBySlug("0008-wartortle", {});
  await Promise.resolve();
  assert.deepEqual(collection.getStatus("0008-wartortle"), { state: "not_met", shiny: false });
  assert.deepEqual(membershipCalls.at(-1), { slug: "0008-wartortle", listName: "for_trade", enabled: false });

  membershipCalls = installTrainerContactStubs({ for_trade: [] });
  collection.setStatus("0009-blastoise", "caught", false);
  collection.cycleOwnershipBySlug("0009-blastoise", { shift: true });
  await Promise.resolve();
  assert.deepEqual(collection.getStatus("0009-blastoise"), { state: "caught", shiny: false });
  assert.deepEqual(membershipCalls.at(-1), { slug: "0009-blastoise", listName: "for_trade", enabled: true });

  membershipCalls = installTrainerContactStubs({ for_trade: ["0010-caterpie"] });
  collection.setStatus("0010-caterpie", "caught", true);
  collection.cycleOwnershipBySlug("0010-caterpie", { shift: true });
  await Promise.resolve();
  assert.deepEqual(collection.getStatus("0010-caterpie"), { state: "caught", shiny: true });
  assert.deepEqual(membershipCalls.at(-1), { slug: "0010-caterpie", listName: "for_trade", enabled: false });
});

test("docs route is recognized as a first-class app view", async () => {
  const api = await loadModule();

  globalThis.location.hash = "#/docs";

  assert.equal(api.currentViewFromHash(), "docs");
});

test("artwork changes rerender the active Pokemon route", async () => {
  const api = await loadModule();
  const rendered = [];
  globalThis.location.hash = "#/pokemon/0001-bulbasaur";
  globalThis.PokevaultFullView = {
    render(slug) {
      rendered.push(slug);
    },
  };

  api.rerenderArtworkSurface();

  assert.deepEqual(rendered, ["0001-bulbasaur"]);
});
