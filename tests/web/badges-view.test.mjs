import assert from "node:assert/strict";
import { test } from "node:test";

function installBrowserStubs() {
  globalThis.__POKEVAULT_BADGES_TESTS__ = true;
  globalThis.window = globalThis;
  delete globalThis.PokedexCollection;
  delete globalThis.PokevaultArtwork;
  delete globalThis.PokevaultBadgeMission;
  globalThis.PokevaultI18n = {
    getLocale: () => "en",
    t: (key, params = {}) => {
      const messages = {
        "badges.status.unlocked": "Unlocked",
        "badges.status.sealed": "{percent}%",
        "badges.toast.title": "Badge unlocked",
      };
      return String(messages[key] || key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => (
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
      ));
    },
    subscribeLocale: () => () => {},
  };
  globalThis.document = {
    readyState: "loading",
    addEventListener() {},
    createElement(tagName = "") {
      const element = {
        attrs: {},
        children: [],
        className: "",
        listeners: {},
        tagName: String(tagName).toUpperCase(),
        append(...children) {
          this.children.push(...children);
        },
        replaceChildren(...children) {
          this.children = [...children];
        },
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        },
        addEventListener(name, fn) {
          this.listeners[name] = fn;
        },
        classList: {
          add(...classes) {
            element.className = [element.className, ...classes].filter(Boolean).join(" ");
          },
        },
        style: { setProperty() {} },
      };
      return element;
    },
  };
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/badges-view.js?case=${Date.now()}`);
  return globalThis.window.PokevaultBadges._test;
}

function flatten(node) {
  const children = Array.isArray(node?.children) ? node.children : [];
  return [node, ...children.flatMap(flatten)];
}

function byClass(node, className) {
  return flatten(node).filter((child) => String(child?.className || "").split(/\s+/).includes(className));
}

function textTree(node) {
  return flatten(node).map((child) => String(child?.textContent || "")).join(" ");
}

test("nearestBadge chooses the locked badge closest to completion", async () => {
  const api = await loadModule();
  const nearest = api.nearestBadge({
    catalog: [
      { id: "first_catch", title: "Premier", unlocked: true, current: 1, target: 1, percent: 100 },
      { id: "century", title: "Centenaire", unlocked: false, current: 42, target: 100, percent: 42 },
      { id: "shiny_ten", title: "Chasseur", unlocked: false, current: 8, target: 10, percent: 80 },
    ],
  });

  assert.equal(nearest.id, "shiny_ten");
});

test("displayBadgeCopy hides mystery trainer copy while locked", async () => {
  const api = await loadModule();
  const copy = api.displayBadgeCopy({
    id: "kanto_brock",
    title: "Pierre - Roche de Kanto",
    description: "Capturer l'equipe de Pierre dans Pokemon Rouge/Bleu.",
    unlocked: false,
    reveal: "mystery",
    i18n: {
      en: {
        title: "Brock - Badge",
        description: "Capture Brock's team in Pokemon Red/Blue.",
        mystery_title: "Sealed badge",
        mystery_hint: "A team from Pokemon Red/Blue is waiting to be rebuilt.",
      },
    },
  });

  assert.equal(copy.title, "Sealed badge");
  assert.equal(copy.description, "A team from Pokemon Red/Blue is waiting to be rebuilt.");
});

test("displayBadgeCopy reveals localized badge copy after unlock", async () => {
  const api = await loadModule();
  const copy = api.displayBadgeCopy({
    id: "kanto_brock",
    title: "Pierre - Roche de Kanto",
    description: "Capturer l'equipe de Pierre dans Pokemon Rouge/Bleu.",
    unlocked: true,
    reveal: "mystery",
    i18n: {
      en: {
        title: "Brock - Badge",
        description: "Capture Brock's team in Pokemon Red/Blue.",
        mystery_title: "Sealed badge",
        mystery_hint: "A team from Pokemon Red/Blue is waiting to be rebuilt.",
      },
    },
  });

  assert.equal(copy.title, "Brock - Badge");
  assert.equal(copy.description, "Capture Brock's team in Pokemon Red/Blue.");
});

test("filterBadges filters by status category and region", async () => {
  const api = await loadModule();
  const badges = [
    { id: "first_catch", unlocked: true, category: "milestone", region: "global" },
    { id: "kanto_brock", unlocked: false, category: "gym", region: "kanto" },
    { id: "gs_lance", unlocked: true, category: "champion", region: "johto" },
  ];

  assert.deepEqual(
    api.filterBadges(badges, { status: "locked", category: "gym", region: "kanto" }).map((b) => b.id),
    ["kanto_brock"],
  );
  assert.deepEqual(
    api.filterBadges(badges, { status: "unlocked", category: "all", region: "all" }).map((b) => b.id),
    ["first_catch", "gs_lance"],
  );
});

test("badgeTileClassNames includes metadata effect classes", async () => {
  const api = await loadModule();
  assert.deepEqual(api.badgeTileClassNames({
    unlocked: true,
    category: "champion",
    effect: "holo",
    reveal: "mystery",
  }), [
    "badge-tile",
    "is-unlocked",
    "badge-tile--champion",
    "badge-tile--holo",
    "badge-tile--mystery",
  ]);
});

test("buildSegmentedFilter exposes grouped controls to assistive tech", async () => {
  const api = await loadModule();
  const filter = api.buildSegmentedFilter("status", "badges.filter.status", [
    ["all", "badges.filter.all"],
  ]);

  assert.equal(filter.attrs.role, "group");
  assert.equal(filter.attrs["aria-label"], "badges.filter.status");
});

test("nearestBadge uses the smallest remaining count as tie-breaker", async () => {
  const api = await loadModule();
  const nearest = api.nearestBadge({
    catalog: [
      { id: "hundred_cards", title: "Cartes", unlocked: false, current: 50, target: 100, percent: 50 },
      { id: "shiny_ten", title: "Shiny", unlocked: false, current: 5, target: 10, percent: 50 },
    ],
  });

  assert.equal(nearest.id, "shiny_ten");
});

test("buildBadgeTile previews required pokemon thumbnails", async () => {
  const api = await loadModule();
  globalThis.PokedexCollection = {
    allPokemon: [
      { slug: "0074-geodude", number: "0074", names: { en: "Geodude" }, image: "data/images/0074-geodude.png" },
      { slug: "0095-onix", number: "0095", names: { en: "Onix" }, image: "data/images/0095-onix.png" },
    ],
  };

  const tile = api.buildBadgeTile({
    id: "kanto_brock",
    title: "Brock - Badge",
    description: "Capture Brock's team.",
    unlocked: false,
    current: 1,
    target: 2,
    percent: 50,
    requirements: [
      { slug: "0074-geodude", caught: true },
      { slug: "0095-onix", caught: false },
    ],
  });

  assert.equal(tile.attrs.tabindex, "0");
  assert.equal(tile.attrs["aria-haspopup"], "dialog");
  assert.equal(byClass(tile, "badge-requirement-chip").length, 2);
  assert.equal(byClass(tile, "is-caught").length, 1);
  assert.equal(byClass(tile, "is-missing").length, 1);
  assert.match(textTree(tile), /Geodude/);
  assert.match(textTree(tile), /Onix/);
});

test("buildBadgeDetail describes the pokemon required by the badge", async () => {
  const api = await loadModule();
  globalThis.PokedexCollection = {
    allPokemon: [
      { slug: "0074-geodude", number: "0074", names: { en: "Geodude" }, image: "data/images/0074-geodude.png" },
      { slug: "0095-onix", number: "0095", names: { en: "Onix" }, image: "data/images/0095-onix.png" },
    ],
  };

  const detail = api.buildBadgeDetail({
    id: "kanto_brock",
    title: "Brock - Badge",
    description: "Capture Brock's team.",
    unlocked: false,
    current: 1,
    target: 2,
    percent: 50,
    hint: "Encore 1 Pokemon de l'equipe à capturer.",
    category: "gym",
    region: "kanto",
    rarity: "rare",
    effect: "gloss",
    requirements: [
      { slug: "0074-geodude", caught: true },
      { slug: "0095-onix", caught: false },
    ],
  });

  assert.equal(detail.attrs.role, "dialog");
  assert.equal(detail.attrs["aria-modal"], "true");
  assert.match(textTree(detail), /Brock - Badge/);
  assert.match(textTree(detail), /Geodude/);
  assert.match(textTree(detail), /Onix/);
  assert.equal(byClass(detail, "badge-detail-requirement").length, 2);
});

test("buildBadgeDetail does not expose a badge mission follow action", async () => {
  const api = await loadModule();

  const detail = api.buildBadgeDetail({
    id: "kanto_brock",
    title: "Brock - Badge",
    description: "Capture Brock's team.",
    requirements: [{ slug: "0074-geodude", caught: false }],
  });

  const nodes = flatten(detail);
  assert.equal(nodes.some((node) => String(node.className || "").includes("badge-detail__mission-btn")), false);
  assert.equal(nodes.some((node) => (
    /Suivre ce badge|Follow this badge|Mission active|Active mission/.test(String(node.textContent || ""))
  )), false);
  assert.equal(byClass(detail, "badge-detail-requirement").length, 1);
});
