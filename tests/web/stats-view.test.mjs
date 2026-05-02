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
        "stats.kpi.cards": "Catalogued cards",
        "stats.kpi.cards_empty": "Add a card to activate TCG tracking",
        "stats.region_archive": "Regional archive",
        "stats.collection_gaps": "Collection gaps",
        "stats.gap_line": "{type} · {count} missing specimen(s)",
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
    computeCardStats() {
      return { cards: 0, sets: 0 };
    },
  };

  api.render();

  assert.equal(elements.statsRailCount.textContent, "1 / 2 caught");
  assert.equal(elements.statsRailMissing.textContent, "1 missing");
  assert.match(textTree(elements.statsBody), /Global completion state/);
  assert.match(textTree(elements.statsBody), /Total specimens/);
  assert.match(textTree(elements.statsBody), /Regional archive/);
  assert.match(textTree(elements.statsBody), /Completion by type/);
});
