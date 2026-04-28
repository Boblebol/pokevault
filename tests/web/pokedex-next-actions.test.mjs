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
    this.type = "";
    this.listeners = {};
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

  addEventListener(name, handler) {
    this.listeners[name] = handler;
  }

  click() {
    this.listeners.click?.({ currentTarget: this });
  }
}

function textTree(node) {
  return [
    node.textContent || "",
    ...node.children.flatMap((child) => textTree(child)),
  ].join(" ");
}

function installBrowserStubs() {
  globalThis.__POKEVAULT_RECOMMENDATIONS_TESTS__ = true;
  globalThis.__POKEVAULT_NEXT_ACTIONS_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/recommendations.js?case=${Date.now()}`);
  await import(`../../web/pokedex-next-actions.js?case=${Date.now()}`);
  return globalThis.window.PokevaultNextActions._test;
}

test("renderNextActions renders each recommendation with its reason", async () => {
  const api = await loadModule();
  const host = new FakeElement("section");
  const opened = [];

  api.renderNextActions({
    host,
    actions: [
      {
        slug: "003-c",
        name: "Florizarre",
        number: 3,
        regionLabel: "Kanto",
        kind: "seen",
        reason: "Vu dans le Pokedex, pas encore capture.",
      },
      {
        slug: "152-d",
        name: "Germignon",
        number: 152,
        regionLabel: "Johto",
        kind: "active_region",
        reason: "Dans ta region active Johto.",
      },
    ],
    onOpen(slug) {
      opened.push(slug);
    },
  });

  const list = host.children.find((child) => child.className === "pokedex-next-actions__list");
  assert.ok(list);
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0].dataset.slug, "003-c");
  assert.match(textTree(list.children[0]), /Florizarre/);
  assert.match(textTree(list.children[0]), /pas encore capture/);
  list.children[0].click();
  assert.deepEqual(opened, ["003-c"]);
});

test("renderFromState defaults to a short mobile-friendly list", async () => {
  const api = await loadModule();
  const host = new FakeElement("section");
  const pool = [
    { slug: "001-a", number: "#001", region: "kanto", names: { fr: "A" } },
    { slug: "002-b", number: "#002", region: "kanto", names: { fr: "B" } },
    { slug: "003-c", number: "#003", region: "kanto", names: { fr: "C" } },
    { slug: "004-d", number: "#004", region: "kanto", names: { fr: "D" } },
  ];

  const actions = api.renderFromState({
    host,
    pool,
    caughtMap: {},
    statusMap: {},
    regionDefinitions: [{ id: "kanto", label_fr: "Kanto", low: 1, high: 151 }],
  });

  const list = host.children.find((child) => child.className === "pokedex-next-actions__list");
  assert.equal(actions.length, 3);
  assert.equal(list.children.length, 3);
});
