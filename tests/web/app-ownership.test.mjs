import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.type = "";
    this.loading = "";
    this.alt = "";
    this.src = "";
    this.title = "";
    this.events = {};
    this.classList = {
      add: (...classes) => {
        const existing = new Set(String(this.className || "").split(/\s+/).filter(Boolean));
        for (const cls of classes) existing.add(cls);
        this.className = [...existing].join(" ");
      },
    };
  }

  append(...nodes) {
    for (const node of nodes) {
      if (node) this.children.push(node);
    }
  }

  addEventListener(type, handler) {
    this.events[type] = handler;
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }
}

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

function findByClass(root, className) {
  for (const child of root.children || []) {
    if (String(child.className || "").split(/\s+/).includes(className)) return child;
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
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
  assert.equal(api.isSupportedBackupSchemaVersion(5), true);
  assert.equal(api.isSupportedBackupSchemaVersion(99), false);
});

test("direct ownership updates map capture duplicate release-one and release-all semantics", async () => {
  await loadModule();
  installRenderStubs();
  const membershipCalls = installTrainerContactStubs();
  const collection = globalThis.window.PokedexCollection;

  collection.setStatus("0001-bulbasaur", "seen", false);
  await collection.setPokemonOwnershipState("0001-bulbasaur", "owned");
  assert.deepEqual(collection.getStatus("0001-bulbasaur"), { state: "caught" });

  collection.setStatus("0002-ivysaur", "caught", true);
  await collection.setPokemonOwnershipState("0002-ivysaur", "duplicate");
  assert.deepEqual(collection.getStatus("0002-ivysaur"), { state: "caught" });

  collection.setStatus("0003-venusaur", "caught", true);
  await collection.setPokemonOwnershipState("0003-venusaur", "release_one");
  assert.deepEqual(collection.getStatus("0003-venusaur"), { state: "caught" });

  collection.setStatus("0004-charmander", "caught", true);
  await collection.setPokemonOwnershipState("0004-charmander", "none");
  assert.deepEqual(collection.getStatus("0004-charmander"), { state: "not_met" });

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
  assert.deepEqual(collection.getStatus("0007-squirtle"), { state: "caught" });
  assert.deepEqual(membershipCalls.at(-1), { slug: "0007-squirtle", listName: "for_trade", enabled: false });

  membershipCalls = installTrainerContactStubs({ for_trade: [] });
  collection.setStatus("0008-wartortle", "caught", true);
  collection.cycleOwnershipBySlug("0008-wartortle", {});
  await Promise.resolve();
  assert.deepEqual(collection.getStatus("0008-wartortle"), { state: "not_met" });
  assert.deepEqual(membershipCalls.at(-1), { slug: "0008-wartortle", listName: "for_trade", enabled: false });

  membershipCalls = installTrainerContactStubs({ for_trade: [] });
  collection.setStatus("0009-blastoise", "caught", false);
  collection.cycleOwnershipBySlug("0009-blastoise", { shift: true });
  await Promise.resolve();
  assert.deepEqual(collection.getStatus("0009-blastoise"), { state: "caught" });
  assert.deepEqual(membershipCalls.at(-1), { slug: "0009-blastoise", listName: "for_trade", enabled: true });

  membershipCalls = installTrainerContactStubs({ for_trade: ["0010-caterpie"] });
  collection.setStatus("0010-caterpie", "caught", true);
  collection.cycleOwnershipBySlug("0010-caterpie", { shift: true });
  await Promise.resolve();
  assert.deepEqual(collection.getStatus("0010-caterpie"), { state: "caught" });
  assert.deepEqual(membershipCalls.at(-1), { slug: "0010-caterpie", listName: "for_trade", enabled: false });
});

test("docs route is recognized as a first-class app view", async () => {
  const api = await loadModule();

  globalThis.location.hash = "#/docs";

  assert.equal(api.currentViewFromHash(), "docs");
});

test("artwork changes rerender the active Pokemon modal", async () => {
  const api = await loadModule();
  const rendered = [];
  globalThis.location.hash = "#/pokemon/0001-bulbasaur";
  globalThis.PokevaultPokemonModal = {
    render(slug) {
      rendered.push(slug);
    },
  };

  api.rerenderArtworkSurface();

  assert.deepEqual(rendered, ["0001-bulbasaur"]);
});

test("pokemon cards show Vu chez only for missing local Pokemon", async () => {
  await loadModule();
  globalThis.document.createElement = (tagName) => new FakeElement(tagName);
  globalThis.PokevaultPokemonFiche = {
    ownershipLabel() {
      return "";
    },
    ownershipStateFromSources(slug, options = {}) {
      const status = options.status || { state: "not_met" };
      return { caught: status.state === "caught", duplicate: false };
    },
    createOwnershipActions() {
      return null;
    },
  };
  globalThis.PokevaultTrainerContacts = {
    getOwnCard() {
      return { for_trade: [] };
    },
    tradeSummary() {
      return {
        availableFrom: ["Misty"],
        wantedBy: ["Brock"],
        matchCount: 1,
        canHelpCount: 1,
      };
    },
  };
  const collection = globalThis.window.PokedexCollection;
  const pokemon = {
    slug: "0001-bulbasaur",
    number: "0001",
    names: { fr: "Bulbizarre" },
    image: "",
    types: ["Plante"],
    region: "kanto",
  };

  collection.setStatus("0001-bulbasaur", "caught", false);
  const caughtCard = collection.createPokemonCard(pokemon);
  assert.equal(findByClass(caughtCard, "pokemon-network-badge"), null);

  collection.setStatus("0001-bulbasaur", "not_met", false);
  const missingCard = collection.createPokemonCard(pokemon);
  const badge = findByClass(missingCard, "pokemon-network-badge");
  assert.equal(badge.textContent, "Vu chez 1");
  assert.equal(String(badge.className).includes("is-match"), false);
  assert.match(missingCard["aria-label"], /vu chez 1 contact/);
  assert.doesNotMatch(missingCard["aria-label"], /match/);
});

test("pokemon cards suppress Vu chez for local duplicates even when raw progress is missing", async () => {
  await loadModule();
  globalThis.document.createElement = (tagName) => new FakeElement(tagName);
  globalThis.PokevaultPokemonFiche = {
    ownershipLabel(ownership) {
      return ownership.duplicate ? "Plusieurs exemplaires" : "";
    },
    ownershipStateFromSources(slug, options = {}) {
      const key = String(slug || "").trim();
      const status = options.status || { state: "not_met" };
      const forTrade = Array.isArray(options.ownCard?.for_trade) ? options.ownCard.for_trade : [];
      const duplicate = forTrade.includes(key);
      return { caught: duplicate || status.state === "caught", duplicate };
    },
    createOwnershipActions() {
      return null;
    },
  };
  globalThis.PokevaultTrainerContacts = {
    getOwnCard() {
      return { for_trade: ["0001-bulbasaur"] };
    },
    tradeSummary() {
      return {
        availableFrom: ["Misty"],
        wantedBy: [],
        matchCount: 0,
        canHelpCount: 0,
      };
    },
  };
  const collection = globalThis.window.PokedexCollection;
  const storage = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return storage.get(key) || null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
  };
  collection.setDimMode("missing");
  collection.setStatus("0001-bulbasaur", "not_met", false);
  const card = collection.createPokemonCard({
    slug: "0001-bulbasaur",
    number: "0001",
    names: { fr: "Bulbizarre" },
    image: "",
    types: ["Plante"],
    region: "kanto",
  });

  assert.equal(findByClass(card, "pokemon-network-badge"), null);
  assert.equal(String(card.className).includes("is-seen"), false);
  assert.equal(String(card.className).includes("is-duplicate"), true);
  assert.equal(String(card.className).includes("is-dimmed"), false);
  assert.doesNotMatch(card["aria-label"], /vu chez/);
  assert.equal(card.dataset.ownership, "Plusieurs exemplaires");
});
