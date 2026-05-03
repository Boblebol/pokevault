import assert from "node:assert/strict";
import { test } from "node:test";

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName || "").toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.style = {};
    this.textContent = "";
    this.className = "";
    this.hidden = false;
    this.href = "";
    this.type = "";
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(name, handler) {
    this.listeners[name] = handler;
  }

  click() {
    this.listeners.click?.({ currentTarget: this });
  }
}

function flatten(node) {
  return [node, ...(node.children || []).flatMap(flatten)];
}

function textTree(node) {
  return flatten(node).map((child) => String(child.textContent || "")).join(" ");
}

function installBrowserStubs() {
  const storage = new Map();
  globalThis.__POKEVAULT_BADGE_MISSION_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };
  globalThis.document = {
    readyState: "loading",
    addEventListener() {},
    getElementById() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };
  return storage;
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/badge-mission.js?case=${Date.now()}`);
  return globalThis.window.PokevaultBadgeMission._test;
}

test("active badge mission stores only a badge id and resolves catalog details", async () => {
  const api = await loadModule();
  const badge = {
    id: "kanto_brock",
    title: "Brock - Badge",
    requirements: [{ slug: "0074-geodude", caught: false }],
  };

  api.setActiveBadge("kanto_brock");

  assert.equal(api.readActiveId(), "kanto_brock");
  assert.equal(api.activeBadge({ catalog: [badge] })?.title, "Brock - Badge");
});

test("activeTargetSlugs returns missing pokemon from the active badge mission", async () => {
  const api = await loadModule();
  api.setActiveBadge("kanto_brock");

  const slugs = api.activeTargetSlugs({
    catalog: [{
      id: "kanto_brock",
      requirements: [
        { slug: "0074-geodude", caught: true },
        { slug: "0095-onix", caught: false },
      ],
    }],
  });

  assert.deepEqual(slugs, ["0095-onix"]);
});

test("renderInto shows the active badge mission pokemon and opens targets", async () => {
  const api = await loadModule();
  const opened = [];
  api.setActiveBadge("kanto_brock");
  globalThis.PokedexCollection = {
    allPokemon: [
      { slug: "0074-geodude", number: "#074", names: { en: "Geodude" }, image: "data/images/geodude.png" },
      { slug: "0095-onix", number: "#095", names: { en: "Onix" }, image: "data/images/onix.png" },
    ],
  };
  globalThis.PokevaultBadges = {
    state: {
      catalog: [{
        id: "kanto_brock",
        title: "Brock - Badge",
        current: 1,
        target: 2,
        percent: 50,
        requirements: [
          { slug: "0074-geodude", caught: true },
          { slug: "0095-onix", caught: false },
        ],
      }],
    },
  };
  const host = new FakeElement("section");

  api.renderInto(host, { onOpen: (slug) => opened.push(slug) });

  assert.match(textTree(host), /Mission badge/);
  assert.match(textTree(host), /Brock - Badge/);
  assert.match(textTree(host), /Geodude/);
  assert.match(textTree(host), /Onix/);
  const target = flatten(host).find((node) => node.dataset.slug === "0095-onix");
  assert.ok(target);
  target.click();
  assert.deepEqual(opened, ["0095-onix"]);
});
