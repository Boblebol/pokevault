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
    this.src = "";
    this.href = "";
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
      } else {
        if (node) node.parentElement = this;
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

  focus() {
    globalThis.document.activeElement = this;
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
    this.parentElement = null;
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
  globalThis.__drawerRoot = null;
  globalThis.document = {
    activeElement: null,
    body: new FakeElement("body"),
    addEventListener() {},
    dispatchEvent() {},
    getElementById(id) {
      return id === "pokemonDrawer" ? globalThis.__drawerRoot : null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createTextNode(text) {
      return new FakeText(text);
    },
  };
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { cards: [] };
    },
  });
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

function makeDrawerRoot() {
  const root = new FakeElement("div");
  root.id = "pokemonDrawer";
  root.hidden = true;
  const panel = new FakeElement("div");
  panel.className = "drawer__panel";
  const scrim = new FakeElement("button");
  scrim.className = "drawer__scrim";
  const content = new FakeElement("div");
  content.id = "pokemonDrawerContent";
  const status = new FakeElement("p");
  status.id = "pokemonDrawerStatus";
  const close = new FakeElement("button");
  close.id = "pokemonDrawerClose";
  panel.append(close, content, status);
  root.append(scrim, panel);
  return { root, content };
}

function drawerHeaderImage(content) {
  const header = content.children.find((child) => child.dataset?.section === "identity");
  const imageWrap = header.children.find((child) => child.className === "drawer-header__img");
  return imageWrap.children[0];
}

function installDrawerCollection({ caught = false, availableFrom = ["Misty"] } = {}) {
  globalThis.PokedexCollection = {
    allPokemon: [
      {
        slug: "0001-bulbasaur",
        number: "0001",
        names: { fr: "Bulbizarre" },
        image: "images/0001-bulbasaur.png",
        types: ["Plante"],
        region: "kanto",
      },
    ],
    getStatus() {
      return { state: caught ? "caught" : "not_met", shiny: false };
    },
    ownershipStateForSlug() {
      return { caught, duplicate: false };
    },
    tradeSummaryForSlug() {
      return { availableFrom, wantedBy: [], matchCount: 0, canHelpCount: 0 };
    },
    getNote() {
      return "";
    },
  };
}

test("drawer rerenders header artwork when artwork mode changes", async () => {
  await loadModule();
  const { root, content } = makeDrawerRoot();
  globalThis.__drawerRoot = root;
  globalThis.PokedexCollection = {
    allPokemon: [
      {
        slug: "0001-bulbasaur",
        number: "0001",
        names: { fr: "Bulbizarre" },
        image: "images/0001-bulbasaur.png",
        types: ["Plante"],
        region: "kanto",
      },
    ],
    getStatus() {
      return { state: "caught", shiny: false };
    },
    ownershipStateForSlug() {
      return { caught: true, duplicate: false };
    },
    tradeSummaryForSlug() {
      return { availableFrom: [], wantedBy: [], matchCount: 0, canHelpCount: 0 };
    },
    getNote() {
      return "";
    },
  };
  let artworkSuffix = "initial";
  let artworkListener = null;
  globalThis.PokevaultArtwork = {
    resolve(pokemon) {
      return { src: `/drawer/${artworkSuffix}/${pokemon.slug}.png`, fallbacks: [] };
    },
    subscribe(listener) {
      artworkListener = listener;
      return () => {};
    },
  };

  globalThis.window.PokevaultDrawer.open("0001-bulbasaur", null);
  assert.equal(drawerHeaderImage(content).src, "/drawer/initial/0001-bulbasaur.png");

  artworkSuffix = "updated";
  artworkListener();

  assert.equal(drawerHeaderImage(content).src, "/drawer/updated/0001-bulbasaur.png");
});

test("drawer exchange context shows duplicate availability only", async () => {
  const api = await loadModule();
  globalThis.PokedexCollection = {
    tradeSummaryForSlug() {
      return {
        availableFrom: ["Misty"],
        wantedBy: ["Brock"],
        matchCount: 1,
        canHelpCount: 1,
      };
    },
  };

  const exchange = api.buildExchangeContext("0001-bulbasaur");
  assert.equal(exchange.children.length, 1);
  assert.equal(exchange.children[0].textContent, "Vu chez Misty.");
});

test("drawer status section suppresses exchange context for caught local Pokemon", async () => {
  const api = await loadModule();
  installDrawerCollection({ caught: true, availableFrom: ["Misty"] });

  const section = api.buildStatusSection("0001-bulbasaur");

  assert.equal(findInTree(section, ".pokemon-exchange-context"), null);
});

test("drawer status section shows exchange context for missing Pokemon available from contacts", async () => {
  const api = await loadModule();
  installDrawerCollection({ caught: false, availableFrom: ["Misty"] });

  const section = api.buildStatusSection("0001-bulbasaur");

  const exchange = findInTree(section, ".pokemon-exchange-context");
  assert.equal(exchange.children.length, 1);
  assert.equal(exchange.children[0].textContent, "Vu chez Misty.");
});

test("drawer ownership helper source does not receive wanted state", async () => {
  await loadModule();
  const { root } = makeDrawerRoot();
  globalThis.__drawerRoot = root;
  const sourceCalls = [];
  const originalHelper = globalThis.PokevaultPokemonFiche.ownershipStateFromSources;
  globalThis.PokevaultPokemonFiche.ownershipStateFromSources = (slug, options) => {
    sourceCalls.push({ slug, options });
    return originalHelper(slug, options);
  };
  globalThis.PokedexCollection = {
    allPokemon: [
      {
        slug: "0025-pikachu",
        number: "0025",
        names: { fr: "Pikachu" },
        image: "images/0025-pikachu.png",
        types: ["Électrik"],
        region: "kanto",
      },
    ],
    getStatus() {
      return { state: "not_met", shiny: false };
    },
    tradeSummaryForSlug() {
      return { availableFrom: [], wantedBy: [], matchCount: 0, canHelpCount: 0 };
    },
    getNote() {
      return "";
    },
  };
  globalThis.PokevaultTrainerContacts = {
    getOwnCard() {
      return { wants: ["0025-pikachu"], for_trade: [] };
    },
  };

  globalThis.window.PokevaultDrawer.open("0025-pikachu", null);

  assert.equal(sourceCalls.length, 1);
  assert.equal(Object.hasOwn(sourceCalls[0].options, "wanted"), false);
});
