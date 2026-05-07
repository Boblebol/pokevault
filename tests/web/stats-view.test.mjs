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
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.classList = new FakeClassList();
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
}

function textTree(node) {
  return [
    node.textContent || "",
    ...node.children.flatMap((child) => textTree(child)),
  ].join(" ");
}

function findByClass(node, className) {
  if (!node || typeof node !== "object") return null;
  const classes = String(node.className || "").split(/\s+/).filter(Boolean);
  if (classes.includes(className)) return node;
  for (const child of node.children || []) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

async function loadModule(elements) {
  globalThis.window = globalThis;
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return elements[id] || null;
    },
  };
  await import(`../../web/stats-view.js?case=${Date.now()}`);
  return globalThis.window.PokedexStats;
}

test("renderStats follows English i18n labels when available", async () => {
  const elements = {
    statsBody: new FakeElement("main"),
    statsRailPct: new FakeElement("span"),
    statsRailCount: new FakeElement("span"),
    statsRailMissing: new FakeElement("span"),
    statsRailBadge: new FakeElement("div"),
    statsBadges: new FakeElement("section"),
  };
  const api = await loadModule(elements);
  globalThis.PokevaultI18n = {
    t(key, params = {}) {
      const messages = {
        "stats.next_badge": "Next badge",
        "stats.rail_caught": "{caught} / {total} caught",
        "stats.rail_missing": "{count} missing",
        "stats.hero_title": "Global completion state",
        "stats.hero_pct": "{pct}% complete",
        "stats.hero_sub": "{missing} missing · {caught} / {total}",
        "stats.hero_ring": "TO CATCH",
        "stats.kpi.total": "Total specimens",
        "stats.kpi.total_sub": "Entries tracked in the local Pokedex",
        "stats.kpi.caught": "Caught",
        "stats.kpi.caught_sub": "{pct}% global completion",
        "stats.kpi.missing": "Missing",
        "stats.kpi.missing_sub": "Collection priority",
        "stats.region_archive": "Regional archive",
        "stats.type_completion": "Completion by type",
      };
      return (messages[key] || key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name]));
    },
  };
  globalThis.PokedexCollection = {
    poolForCollectionScope() {
      return [
        { slug: "001-a", number: "#001", region: "kanto", types: ["Grass"] },
        { slug: "002-b", number: "#002", region: "kanto", types: ["Grass"] },
      ];
    },
    caughtMap: { "001-a": true },
    statusMap: {},
    regionDefinitions: [{ id: "kanto", label_fr: "Kanto", low: 1, high: 151 }],
  };
  globalThis.PokevaultRecommendations = {
    rankTargets() {
      throw new Error("stats must not render recommendation objectives");
    },
  };
  globalThis.PokevaultHunts = {
    state: { hunts: { "002-b": { wanted: true } } },
  };
  globalThis.PokevaultBadges = {
    nearest() {
      return {
        title: "Sabrina - Marsh",
        current: 1,
        target: 2,
        percent: 50,
        unlocked: false,
      };
    },
  };

  api.render();

  const bodyText = textTree(elements.statsBody);
  assert.equal(elements.statsRailCount.textContent, "1 / 2 caught");
  assert.equal(elements.statsRailMissing.textContent, "1 missing");
  assert.equal(elements.statsRailBadge.hidden, true);
  assert.match(bodyText, /Global completion state/);
  assert.match(bodyText, /Total specimens/);
  assert.match(bodyText, /Regional archive/);
  assert.match(bodyText, /Completion by type/);
  assert.doesNotMatch(bodyText, /Collection gaps/);
  assert.doesNotMatch(textTree(elements.statsRailBadge), /Next badge/);
  assert.doesNotMatch(textTree(elements.statsRailBadge), /Sabrina - Marsh/);
  assert.doesNotMatch(bodyText, /Catalogued cards/);
  assert.doesNotMatch(bodyText, /TCG/);

  const bento = findByClass(elements.statsBody, "stats-bento-grid--two");
  assert.ok(bento);
  assert.equal(
    bento.children.filter((child) => String(child.className).includes("stats-region-wrap")).length,
    2,
  );
});
