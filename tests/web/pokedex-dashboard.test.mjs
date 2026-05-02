import assert from "node:assert/strict";
import { test } from "node:test";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) this.values.add(name);
  }

  toggle(name, force) {
    if (force === false) this.values.delete(name);
    else if (force === true || !this.values.has(name)) this.values.add(name);
    else this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.classList = new FakeClassList();
    this.attributes = {};
    this.dataset = {};
    this.style = { setProperty() {} };
    this.textContent = "";
    this.className = "";
    this.hidden = false;
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

function installBrowserStubs() {
  globalThis.__POKEVAULT_DASHBOARD_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/pokedex-dashboard.js?case=${Date.now()}`);
  return globalThis.window.PokevaultDashboard._test;
}

test("computeDashboardMetrics prioritizes Pokedex status over add-ons", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "001-a", number: "#001", region: "kanto" },
    { slug: "002-b", number: "#002", region: "kanto" },
    { slug: "152-c", number: "#152", region: "johto" },
    { slug: "153-d", number: "#153", region: "johto" },
  ];
  const statusMap = {
    "001-a": { state: "caught", shiny: true },
    "002-b": { state: "seen", shiny: false },
    "152-c": { state: "caught", shiny: false },
  };
  const regions = [
    { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
    { id: "johto", label_fr: "Johto", low: 152, high: 251 },
  ];

  const metrics = api.computeDashboardMetrics({
    pool,
    statusMap,
    regionDefinitions: regions,
    cardStats: { cards: 3, sets: 2 },
  });

  assert.deepEqual(
    {
      total: metrics.total,
      notMet: metrics.notMet,
      seen: metrics.seen,
      caught: metrics.caught,
      shiny: metrics.shiny,
      percentCaught: metrics.percentCaught,
      cards: metrics.cardStats.cards,
      sets: metrics.cardStats.sets,
    },
    {
      total: 4,
      notMet: 1,
      seen: 1,
      caught: 2,
      shiny: 1,
      percentCaught: 50,
      cards: 3,
      sets: 2,
    },
  );
});

test("computeDashboardMetrics returns region progress in roadmap order", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "152-c", number: "#152", region: "johto" },
    { slug: "001-a", number: "#001", region: "kanto" },
    { slug: "002-b", number: "#002", region: "kanto" },
  ];
  const statusMap = {
    "001-a": { state: "caught", shiny: false },
    "152-c": { state: "seen", shiny: false },
  };
  const regions = [
    { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
    { id: "johto", label_fr: "Johto", low: 152, high: 251 },
  ];

  const metrics = api.computeDashboardMetrics({
    pool,
    statusMap,
    regionDefinitions: regions,
  });

  assert.deepEqual(metrics.regions.map((row) => ({
    label: row.label,
    caught: row.caught,
    seen: row.seen,
    total: row.total,
    percentCaught: row.percentCaught,
  })), [
    { label: "Kanto", caught: 1, seen: 0, total: 2, percentCaught: 50 },
    { label: "Johto", caught: 0, seen: 1, total: 1, percentCaught: 0 },
  ]);
});

test("renderDashboard puts core Pokedex cards before secondary add-ons", async () => {
  const api = await loadModule();
  const cardsHost = new FakeElement("div");
  const regionsHost = new FakeElement("div");

  api.renderDashboard({
    cardsHost,
    regionsHost,
    metrics: {
      total: 4,
      notMet: 1,
      seen: 1,
      caught: 2,
      shiny: 1,
      percentCaught: 50,
      cardStats: { cards: 3, sets: 2 },
      regions: [
        { id: "kanto", label: "Kanto", caught: 1, seen: 0, total: 2, percentCaught: 50 },
        { id: "johto", label: "Johto", caught: 1, seen: 1, total: 2, percentCaught: 50 },
      ],
    },
  });

  assert.deepEqual(
    cardsHost.children.map((child) => child.dataset.metric),
    ["missing", "seen", "caught", "shiny", "cards"],
  );
  assert.equal(cardsHost.children[3].classList.contains("is-secondary"), true);
  assert.equal(cardsHost.children[4].classList.contains("is-secondary"), true);
  assert.equal(regionsHost.children.length, 2);
  assert.match(regionsHost.children[0].textContent, /Kanto/);
  assert.match(regionsHost.children[0].textContent, /1 \/ 2/);
});

test("renderDashboard follows English i18n labels when available", async () => {
  const api = await loadModule();
  globalThis.PokevaultI18n = {
    t(key, params = {}) {
      const messages = {
        "dashboard.card.not_met": "Not met",
        "dashboard.card.not_met_detail": "To discover",
        "dashboard.card.seen": "Seen",
        "dashboard.card.seen_detail": "To catch",
        "dashboard.card.caught": "Caught",
        "dashboard.card.caught_detail": "{pct}% of the dex",
        "dashboard.card.shiny": "Shiny",
        "dashboard.card.shiny_detail": "Bonus",
        "dashboard.card.cards": "Cards",
        "dashboard.card.cards_detail": "{sets} set(s)",
        "dashboard.region.aria": "{region}: {caught} of {total}",
      };
      return (messages[key] || key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name]));
    },
  };
  const cardsHost = new FakeElement("div");
  const regionsHost = new FakeElement("div");

  api.renderDashboard({
    cardsHost,
    regionsHost,
    metrics: {
      total: 4,
      notMet: 1,
      seen: 1,
      caught: 2,
      shiny: 1,
      percentCaught: 50,
      cardStats: { cards: 3, sets: 2 },
      regions: [
        { id: "kanto", label: "Kanto", caught: 1, seen: 0, total: 2, percentCaught: 50 },
      ],
    },
  });

  assert.equal(cardsHost.children[0].children[0].textContent, "Not met");
  assert.equal(cardsHost.children[1].children[2].textContent, "To catch");
  assert.equal(cardsHost.children[2].children[2].textContent, "50% of the dex");
  assert.equal(cardsHost.children[4].children[2].textContent, "2 set(s)");
  assert.equal(regionsHost.children[0].attributes["aria-label"], "Kanto: 1 of 2");
});
