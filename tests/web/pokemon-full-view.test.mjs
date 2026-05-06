import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;
let fullViewApi = null;

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.hidden = false;
    this.href = "";
    this.disabled = false;
    this.type = "";
    this.events = {};
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  addEventListener(type, handler) {
    this.events[type] = handler;
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }
}

function installBrowserStubs(root) {
  const statusCalls = [];
  const ownershipCalls = [];
  const noteCalls = [];
  globalThis.__POKEVAULT_FICHE_TESTS__ = true;
  globalThis.__POKEVAULT_FULLVIEW_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.location = {
    hash: "#/pokemon/0001-bulbasaur?from=%23%2Fliste%3Fregion%3Dkanto%26forms%3Dregional",
  };
  globalThis.document = {
    body: new FakeElement("body"),
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return id === "viewPokemon" ? root : null;
    },
    querySelector() {
      return null;
    },
  };
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { cards: [] };
    },
  });
  globalThis.PokevaultArtwork = {
    resolve(pokemon) {
      return { src: `/sprite/${pokemon.slug}.png`, fallbacks: ["/fallback.png"] };
    },
    attach(img, resolved) {
      img.src = resolved.src;
      img.dataset.fallbacks = resolved.fallbacks.join(",");
    },
  };
  globalThis.PokedexCollection = {
    statusCalls,
    ownershipCalls,
    noteCalls,
    allPokemon: [
      {
        slug: "0001-bulbasaur",
        number: "0001",
        names: { fr: "Bulbizarre", en: "Bulbasaur" },
        image: "images/0001-bulbasaur.png",
        types: ["Plante"],
        region: "kanto",
      },
      {
        slug: "0001-bulbasaur-alola",
        number: "0001",
        names: { fr: "Bulbizarre d'Alola" },
        image: "images/0001-bulbasaur-alola.png",
        form: "Forme d'Alola",
        types: ["Plante"],
        region: "alola",
      },
      {
        slug: "0001-bulbasaur-galar",
        number: "0001",
        names: { fr: "Bulbizarre de Galar" },
        form: "Forme de Galar",
        types: ["Plante"],
        region: "galar",
      },
      {
        slug: "0001-bulbasaur-hisui",
        number: "0001",
        names: { fr: "Bulbizarre de Hisui" },
        form: "Forme de Hisui",
        types: ["Plante"],
        region: "hisui",
      },
      {
        slug: "0001-bulbasaur-paldea",
        number: "0001",
        names: { fr: "Bulbizarre de Paldea" },
        form: "Forme de Paldea",
        types: ["Plante"],
        region: "paldea",
      },
      {
        slug: "0001-bulbasaur-mega",
        number: "0001",
        names: { fr: "Méga-Bulbizarre" },
        form: "Méga",
        types: ["Plante"],
        region: "kanto",
      },
    ],
    getStatus(slug) {
      const statuses = {
        "0001-bulbasaur": { state: "caught", shiny: true },
        "0001-bulbasaur-alola": { state: "seen", shiny: false },
        "0001-bulbasaur-galar": { state: "not_met", shiny: false },
        "0001-bulbasaur-hisui": { state: "caught", shiny: false },
        "0001-bulbasaur-paldea": { state: "seen", shiny: true },
        "0001-bulbasaur-mega": { state: "caught", shiny: true },
      };
      return statuses[slug] || { state: "not_met", shiny: false };
    },
    setStatus(slug, state, shiny) {
      statusCalls.push({ slug, state, shiny });
    },
    ownershipStateForSlug() {
      return { caught: true, duplicate: true };
    },
    setPokemonOwnershipState(slug, state) {
      ownershipCalls.push({ slug, state });
      return Promise.resolve();
    },
    tradeSummaryForSlug() {
      return {
        availableFrom: ["Misty"],
        wantedBy: ["Brock"],
        matchCount: 1,
        canHelpCount: 1,
      };
    },
    getNote(slug) {
      return slug === "0001-bulbasaur" ? "À transférer depuis Vert Feuille." : "";
    },
    setNote(slug, note) {
      noteCalls.push({ slug, note });
      return Promise.resolve();
    },
  };
  globalThis.PokevaultHunts = {
    entry() {
      return { priority: "normal", note: "A revoir dans Ecarlate." };
    },
    async patch() {},
  };
}

async function loadModules(root) {
  installBrowserStubs(root);
  if (!fullViewApi) {
    importCase += 1;
    const stamp = `${Date.now()}-${importCase}`;
    await import(`../../web/pokemon-fiche.js?case=${stamp}-fiche`);
    await import(`../../web/pokemon-full-view.js?case=${stamp}-full`);
    fullViewApi = globalThis.window.PokevaultFullView._test;
  }
  return fullViewApi;
}

test("renderInto resolves hero image through artwork switcher", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);

  api.renderInto(root, "0001-bulbasaur");

  const hero = root.children.find((child) => child.dataset?.section === "identity");
  const imageWrap = hero.children.find((child) => child.className === "fullview-hero__img");
  const img = imageWrap.children[0];
  assert.equal(img.src, "/sprite/0001-bulbasaur.png");
  assert.equal(img.dataset.fallbacks, "/fallback.png");
});

test("renderInto resolves form images through artwork switcher", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);

  api.renderInto(root, "0001-bulbasaur");

  const formsSection = root.children.find((child) => child.dataset?.section === "forms");
  const list = formsSection.children.find((child) => child.className === "fullview-forms-grid");
  const alolaImg = list.children[1].children[0];
  assert.equal(alolaImg.src, "/sprite/0001-bulbasaur-alola.png");
  assert.equal(alolaImg.dataset.fallbacks, "/fallback.png");
});

test("renderInto uses artwork resolve source without attach helper", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);
  globalThis.PokevaultArtwork = {
    resolve(pokemon) {
      return { src: `/resolved-only/${pokemon.slug}.png`, fallbacks: ["/ignored.png"] };
    },
  };

  api.renderInto(root, "0001-bulbasaur");

  const hero = root.children.find((child) => child.dataset?.section === "identity");
  const imageWrap = hero.children.find((child) => child.className === "fullview-hero__img");
  const img = imageWrap.children[0];
  assert.equal(img.src, "/resolved-only/0001-bulbasaur.png");
});

test("renderInto lays out the B1 fiche sections before secondary cards", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);

  api.renderInto(root, "0001-bulbasaur");

  assert.deepEqual(
    root.children
      .filter((child) => child.dataset?.section)
      .map((child) => child.dataset.section),
    [
      "identity",
      "pokedex_status",
      "forms",
      "personal_progress",
      "notes",
      "cards",
    ],
  );
  assert.equal(root.children.at(-1).dataset.section, "cards");
  assert.equal(root.children.at(-2).children.at(-1).className, "pokemon-note-editor");
});

test("renderInto shows trade-oriented ownership actions and exchange context", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);

  api.renderInto(root, "0001-bulbasaur");

  const statusSection = root.children.find((child) => child.dataset?.section === "pokedex_status");
  const label = statusSection.children.find((child) => child.className === "fullview-hero__status-label");
  assert.equal(label.textContent, "Double");

  const row = statusSection.children.find((child) => child.className === "pokemon-ownership-actions");
  const buttons = row.children;
  assert.deepEqual(buttons.map((button) => button.textContent), [
    "Capturé",
    "Double",
    "Relâcher 1",
    "Relâcher",
  ]);
  assert.equal(buttons[1].dataset.active, "true");

  const exchange = statusSection.children.find((child) => child.className === "pokemon-exchange-context");
  assert.equal(exchange.children[0].textContent, "Match possible avec Misty.");
  assert.equal(exchange.children[1].textContent, "Brock cherche ce Pokémon.");

  buttons[2].events.click({
    preventDefault() {},
    stopPropagation() {},
  });
  assert.deepEqual(globalThis.PokedexCollection.ownershipCalls.at(-1), {
    slug: "0001-bulbasaur",
    state: "release_one",
  });
});

test("renderInto ownership helper source does not receive wanted state", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);
  const sourceCalls = [];
  const originalHelper = globalThis.PokevaultPokemonFiche.ownershipStateFromSources;
  globalThis.PokevaultPokemonFiche.ownershipStateFromSources = (slug, options) => {
    sourceCalls.push({ slug, options });
    return originalHelper(slug, options);
  };
  delete globalThis.PokedexCollection.ownershipStateForSlug;
  globalThis.PokedexCollection.getStatus = () => ({ state: "not_met", shiny: false });
  globalThis.PokevaultHunts.isWanted = () => true;
  globalThis.PokevaultTrainerContacts = {
    getOwnCard() {
      return { wants: ["0001-bulbasaur"], for_trade: [] };
    },
  };

  api.renderInto(root, "0001-bulbasaur");

  assert.equal(sourceCalls.length > 0, true);
  assert.equal(Object.hasOwn(sourceCalls[0].options, "wanted"), false);
  const statusSection = root.children.find((child) => child.dataset?.section === "pokedex_status");
  const label = statusSection.children.find((child) => child.className === "fullview-hero__status-label");
  assert.equal(label.dataset.state, "none");
  globalThis.PokevaultPokemonFiche.ownershipStateFromSources = originalHelper;
});

test("renderInto shows B3 linked forms with independent statuses and list return", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);

  api.renderInto(root, "0001-bulbasaur");

  const formsSection = root.children.find((child) => child.dataset?.section === "forms");
  const list = formsSection.children.find((child) => child.className === "fullview-forms-grid");
  const tiles = list.children;
  assert.equal(tiles.length, 6);
  assert.equal(tiles[0].dataset.current, "true");
  assert.equal(tiles[0].href, "#/pokemon/0001-bulbasaur?from=%23%2Fliste%3Fregion%3Dkanto%26forms%3Dregional");
  assert.equal(tiles[1].href, "#/pokemon/0001-bulbasaur-alola?from=%23%2Fliste%3Fregion%3Dkanto%26forms%3Dregional");

  const statusLabels = tiles.map((tile) => tile.children.at(-1).textContent);
  assert.deepEqual(statusLabels, [
    "Attrapé shiny",
    "Aperçu",
    "Non rencontré",
    "Attrapé",
    "Aperçu",
    "Attrapé shiny",
  ]);
});

test("renderInto shows B4 note editor and saves trimmed personal note", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);

  api.renderInto(root, "0001-bulbasaur");

  const notesSection = root.children.find((child) => child.dataset?.section === "notes");
  const editor = notesSection.children.find((child) => child.className === "pokemon-note-editor");
  const textarea = editor.children.find((child) => child.tagName === "TEXTAREA");
  const actions = editor.children.find((child) => child.className === "pokemon-note-editor__actions");
  const button = actions.children.find((child) => child.tagName === "BUTTON");
  assert.equal(textarea.value, "À transférer depuis Vert Feuille.");

  textarea.value = "  Capture Route 4  ";
  await button.events.click();
  assert.deepEqual(globalThis.PokedexCollection.noteCalls.at(-1), {
    slug: "0001-bulbasaur",
    note: "Capture Route 4",
  });
});

test("renderInto keeps B5 cards as a collapsed secondary section", async () => {
  const root = new FakeElement("div");
  const api = await loadModules(root);

  api.renderInto(root, "0001-bulbasaur");

  const cardsSection = root.children.find((child) => child.dataset?.section === "cards");
  const heading = cardsSection.children[0];
  const toggle = heading.children[0];
  const body = cardsSection.children.find((child) => child.className.includes("pokemon-fiche-section__body"));
  assert.equal(cardsSection.dataset.collapsible, "true");
  assert.equal(cardsSection.dataset.collapsed, "true");
  assert.equal(body.hidden, true);
  assert.equal(toggle["aria-expanded"], "false");
  assert.equal(body.children[0].className, "fullview-cards-body");

  toggle.events.click();
  assert.equal(cardsSection.dataset.collapsed, "false");
  assert.equal(body.hidden, false);
});
