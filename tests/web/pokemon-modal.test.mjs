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
    this.href = "";
    this.src = "";
    this.alt = "";
    this.value = "";
    this.type = "";
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
        const text = new FakeText(node);
        text.parentElement = this;
        this.children.push(text);
      } else if (node) {
        node.parentElement = this;
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

  focus() {
    globalThis.document.activeElement = this;
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

function installRoot() {
  const root = new FakeElement("div");
  root.id = "pokemonModal";
  root.hidden = true;
  const panel = new FakeElement("div");
  panel.className = "pokemon-modal__panel";
  const scrim = new FakeElement("button");
  scrim.className = "pokemon-modal__scrim";
  const close = new FakeElement("button");
  close.id = "pokemonModalClose";
  const content = new FakeElement("div");
  content.id = "pokemonModalContent";
  const status = new FakeElement("p");
  status.id = "pokemonModalStatus";
  panel.append(close, content, status);
  root.append(scrim, panel);
  return { root, content };
}

function installBrowserStubs() {
  const { root, content } = installRoot();
  globalThis.__POKEVAULT_FICHE_TESTS__ = true;
  globalThis.__POKEVAULT_MODAL_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.location = { hash: "#/liste" };
  globalThis.history = { replaceState() {} };
  globalThis.addEventListener = () => {};
  globalThis.document = {
    activeElement: null,
    body: new FakeElement("body"),
    addEventListener() {},
    getElementById(id) {
      if (id === "pokemonModal") return root;
      if (id === "pokemonModalContent") return content;
      if (id === "pokemonModalClose") return root.querySelector("#pokemonModalClose");
      if (id === "pokemonModalStatus") return root.querySelector("#pokemonModalStatus");
      return null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createTextNode(text) {
      return new FakeText(text);
    },
  };
  globalThis.PokevaultArtwork = {
    resolve(pokemon) {
      return { src: `/sprite/${pokemon.slug}.png` };
    },
    attach(img, resolved) {
      img.src = resolved.src;
    },
    subscribe() {},
  };
  globalThis.PokevaultGamePokedexes = {
    pokedexes: [
      { id: "rb-kanto", label_fr: "Pokédex de Kanto - Rouge/Bleu" },
      { id: "xy-kalos-central", label_fr: "Pokédex de Kalos Centre - X/Y" },
    ],
    appearances_by_slug: {
      "0001-bulbasaur": ["rb-kanto", "xy-kalos-central"],
    },
  };
  globalThis.PokedexCollection = {
    allPokemon: [
      {
        slug: "0001-bulbasaur",
        number: "0001",
        names: { fr: "Bulbizarre", en: "Bulbasaur" },
        image: "images/0001-bulbasaur.png",
        types: ["Plante", "Poison"],
        region: "kanto",
      },
      {
        slug: "0001-bulbasaur-mega",
        number: "0001",
        names: { fr: "Méga-Bulbizarre" },
        form: "Méga",
        types: ["Plante", "Poison"],
      },
    ],
    getStatus() {
      return { state: "caught" };
    },
    ownershipStateForSlug() {
      return { caught: true, duplicate: false };
    },
    getNote() {
      return "À transférer depuis Vert Feuille.";
    },
    setNote() {
      return Promise.resolve();
    },
    setPokemonOwnershipState() {
      return Promise.resolve();
    },
  };
  return { root, content };
}

async function loadModule() {
  const dom = installBrowserStubs();
  importCase += 1;
  const stamp = `${Date.now()}-${importCase}`;
  await import(`../../web/pokemon-fiche.js?case=${stamp}-fiche`);
  await import(`../../web/pokemon-modal.js?case=${stamp}-modal`);
  globalThis.window.PokevaultPokemonModal._test.resetForTests();
  return { dom, api: globalThis.window.PokevaultPokemonModal._test };
}

function textContent(node) {
  if (!node) return "";
  return [
    node.textContent || "",
    ...(node.children || []).map((child) => textContent(child)),
  ].join("");
}

test("open renders one modal surface and keeps PokevaultDrawer compatibility", async () => {
  const { dom } = await loadModule();

  globalThis.window.PokevaultDrawer.open("0001-bulbasaur", null);

  assert.equal(globalThis.window.PokevaultDrawer, globalThis.window.PokevaultPokemonModal);
  assert.equal(dom.root.hidden, false);
  assert.ok(String(dom.root.className).includes("is-open"));
  assert.deepEqual(
    dom.content.children.filter((child) => child.dataset?.section).map((child) => child.dataset.section),
    ["identity", "pokedex_status", "pokedex_entries", "type_matchups"],
  );
});

test("modal shows game Pokedex appearances and no card section", async () => {
  const { dom } = await loadModule();

  globalThis.window.PokevaultPokemonModal.open("0001-bulbasaur", null);

  const text = textContent(dom.content);
  assert.match(text, /Pokédex de Kanto - Rouge\/Bleu/);
  assert.match(text, /Pokédex de Kalos Centre - X\/Y/);
  assert.doesNotMatch(text, /Mes cartes/);
  assert.doesNotMatch(text, /TCG/);
});

test("legacy Pokemon hash opens the same modal instead of a full-page view", async () => {
  const { dom, api } = await loadModule();
  globalThis.location.hash = "#/pokemon/0001-bulbasaur";

  api.openFromCurrentHash();

  assert.equal(dom.root.hidden, false);
  assert.match(textContent(dom.content), /Bulbizarre/);
  assert.equal(globalThis.location.hash, "#/liste");
});
