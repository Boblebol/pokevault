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
    this.hidden = false;
    this.type = "";
    this.id = "";
    this.events = {};
    this.classList = {
      add: (...classes) => {
        const existing = new Set(String(this.className || "").split(/\s+/).filter(Boolean));
        for (const cls of classes) existing.add(cls);
        this.className = [...existing].join(" ");
      },
      remove: (...classes) => {
        const remove = new Set(classes);
        this.className = String(this.className || "")
          .split(/\s+/)
          .filter((cls) => cls && !remove.has(cls))
          .join(" ");
      },
    };
  }

  append(...nodes) {
    for (const node of nodes) {
      if (typeof node === "string") {
        this.children.push(new FakeText(node));
      } else {
        this.children.push(node);
      }
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  addEventListener(type, handler) {
    this.events[type] = handler;
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  querySelector(selector) {
    return findInTree(this, selector);
  }
}

class FakeText {
  constructor(text) {
    this.tagName = "#TEXT";
    this.textContent = text;
    this.children = [];
  }
}

function matchesSelector(node, selector) {
  if (!node || node.tagName === "#TEXT") return false;
  if (selector.startsWith(".")) {
    return String(node.className || "").split(/\s+/).includes(selector.slice(1));
  }
  if (selector.startsWith("#")) return node.id === selector.slice(1);
  return node.tagName === selector.toUpperCase();
}

function findInTree(root, selector) {
  for (const child of root.children || []) {
    if (matchesSelector(child, selector)) return child;
    const found = findInTree(child, selector);
    if (found) return found;
  }
  return null;
}

function installBrowserStubs() {
  globalThis.__POKEVAULT_FICHE_TESTS__ = true;
  globalThis.__POKEVAULT_DRAWER_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.location = { hash: "" };
  globalThis.history = { replaceState() {} };
  globalThis.document = {
    activeElement: null,
    addEventListener() {},
    dispatchEvent() {},
    getElementById() {
      return null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createTextNode(text) {
      return new FakeText(text);
    },
  };
}

async function loadModule() {
  installBrowserStubs();
  importCase += 1;
  const stamp = `${Date.now()}-${importCase}`;
  await import(`../../web/pokemon-fiche.js?case=${stamp}-fiche`);
  await import(`../../web/pokemon-drawer.js?case=${stamp}-drawer`);
  return globalThis.window.PokevaultDrawer._test;
}

test("payloadFromFormData includes selected TCG metadata", async () => {
  const api = await loadModule();
  const fd = new FormData();
  fd.set("set_id", " sv1 ");
  fd.set("num", " 25 ");
  fd.set("variant", " Common ");
  fd.set("lang", " fr ");
  fd.set("condition", "near_mint");
  fd.set("qty", "2");
  fd.set("note", " promo ");
  fd.set("image_url", " https://images.example/sv1-25_hires.png ");
  fd.set("tcg_api_id", " sv1-25 ");

  assert.deepEqual(api.payloadFromFormData(fd, "0025-pikachu"), {
    pokemon_slug: "0025-pikachu",
    set_id: "sv1",
    num: "25",
    variant: "Common",
    lang: "fr",
    condition: "near_mint",
    qty: 2,
    acquired_at: null,
    note: "promo",
    image_url: "https://images.example/sv1-25_hires.png",
    tcg_api_id: "sv1-25",
  });
});

test("applyTcgCardToForm prefills local card fields", async () => {
  const api = await loadModule();
  const form = {
    elements: {
      tcg_api_id: { value: "" },
      set_id: { value: "" },
      num: { value: "" },
      variant: { value: "" },
      image_url: { value: "" },
    },
  };

  api.applyTcgCardToForm(form, {
    id: "base1-4",
    set_id: "base1",
    number: "4",
    rarity: "Rare Holo",
    small_image_url: "https://images.example/base1-4.png",
    large_image_url: "https://images.example/base1-4_hires.png",
  });

  assert.equal(form.elements.tcg_api_id.value, "base1-4");
  assert.equal(form.elements.set_id.value, "base1");
  assert.equal(form.elements.num.value, "4");
  assert.equal(form.elements.variant.value, "Rare Holo");
  assert.equal(form.elements.image_url.value, "https://images.example/base1-4_hires.png");
});

test("buildCardsSection keeps add-card and TCG search inside a collapsed B5 body", async () => {
  const api = await loadModule();

  const section = api.buildCardsSection();
  const body = section.children.find((child) =>
    String(child.className || "").includes("pokemon-fiche-section__body"),
  );
  const heading = section.children[0];
  const toggle = heading.children[0];

  assert.equal(section.dataset.section, "cards");
  assert.equal(section.dataset.collapsed, "true");
  assert.equal(body.hidden, true);
  assert.equal(toggle["aria-expanded"], "false");
  assert.ok(body.querySelector("#drawerAddCardForm"));
  assert.ok(body.querySelector(".drawer-tcg-search"));
});
