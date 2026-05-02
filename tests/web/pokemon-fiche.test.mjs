import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;
let ficheApi = null;

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.hidden = false;
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

function installBrowserStubs() {
  globalThis.__POKEVAULT_FICHE_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };
}

async function loadModule() {
  installBrowserStubs();
  if (!ficheApi) {
    importCase += 1;
    await import(`../../web/pokemon-fiche.js?case=${Date.now()}-${importCase}`);
    ficheApi = globalThis.window.PokevaultPokemonFiche._test;
  }
  return ficheApi;
}

test("buildFicheSectionPlan keeps B1 sections in Pokedex-first order", async () => {
  const api = await loadModule();

  const sections = api.buildFicheSectionPlan();

  assert.deepEqual(sections.map((section) => section.id), [
    "identity",
    "pokedex_status",
    "forms",
    "personal_progress",
    "notes",
    "cards",
  ]);
  assert.equal(sections.at(-1).id, "cards");
  assert.equal(sections.at(-1).secondary, true);
});

test("createFicheSection renders a labelled DOM section", async () => {
  const api = await loadModule();

  const section = api.createFicheSection({ id: "notes", title: "Notes", headingLevel: 3 });

  assert.equal(section.tagName, "SECTION");
  assert.equal(section.className, "pokemon-fiche-section");
  assert.equal(section.dataset.section, "notes");
  assert.equal(section.children[0].tagName, "H3");
  assert.equal(section.children[0].className, "pokemon-fiche-section__title");
  assert.equal(section.children[0].textContent, "Notes");
});

test("createCollapsibleBody collapses secondary fiche content and toggles it", async () => {
  const api = await loadModule();
  const section = api.createFicheSection({ id: "cards", title: "Mes cartes" });

  const body = api.createCollapsibleBody(section, { collapsed: true });

  const button = section.children[0].children[0];
  assert.equal(section.dataset.collapsible, "true");
  assert.equal(section.dataset.collapsed, "true");
  assert.equal(body.hidden, true);
  assert.equal(button["aria-expanded"], "false");

  button.events.click();
  assert.equal(section.dataset.collapsed, "false");
  assert.equal(body.hidden, false);
  assert.equal(button["aria-expanded"], "true");
});

test("parsePokemonRouteSlug reads hash routes for full Pokemon pages", async () => {
  const api = await loadModule();

  assert.equal(api.parsePokemonRouteSlug("#/pokemon/0025-pikachu"), "0025-pikachu");
  assert.equal(api.parsePokemonRouteSlug("#pokemon/0001-bulbasaur?tab=cards"), "0001-bulbasaur");
  assert.equal(api.parsePokemonRouteSlug("#/pokemon/mr-mime%20test"), "mr-mime test");
  assert.equal(api.parsePokemonRouteSlug("#/liste?slug=0025-pikachu"), null);
});

test("buildStatusActionModel exposes direct B2 actions with shiny gated by caught", async () => {
  const api = await loadModule();

  const seenActions = api.buildStatusActionModel({ state: "seen", shiny: true });
  assert.deepEqual(seenActions.map((action) => action.id), [
    "not_met",
    "seen",
    "caught",
    "shiny",
  ]);
  assert.equal(seenActions[1].active, true);
  assert.equal(seenActions[3].disabled, true);
  assert.equal(seenActions[3].active, false);

  const shinyActions = api.buildStatusActionModel({ state: "caught", shiny: true });
  assert.equal(shinyActions[2].active, true);
  assert.equal(shinyActions[3].active, true);
  assert.equal(shinyActions[3].disabled, false);
});

test("buildOwnershipActionModel exposes compact trade-oriented actions", async () => {
  const api = await loadModule();

  const empty = api.buildOwnershipActionModel({ wanted: false, caught: false, duplicate: false });
  assert.deepEqual(empty.map((action) => action.id), ["wanted", "owned", "duplicate"]);
  assert.deepEqual(empty.map((action) => action.label), ["Cherche", "Capturé", "Double"]);
  assert.deepEqual(empty.map((action) => action.active), [false, false, false]);

  const wanted = api.buildOwnershipActionModel({ wanted: true, caught: false, duplicate: false });
  assert.deepEqual(wanted.map((action) => action.active), [true, false, false]);

  const owned = api.buildOwnershipActionModel({ wanted: false, caught: true, duplicate: false });
  assert.deepEqual(owned.map((action) => action.active), [false, true, false]);

  const duplicate = api.buildOwnershipActionModel({ wanted: false, caught: true, duplicate: true });
  assert.deepEqual(duplicate.map((action) => action.active), [false, false, true]);
});

test("ownershipPatchForAction keeps Double as a tradeable owned state", async () => {
  const api = await loadModule();

  assert.equal(api.ownershipPatchForAction({ wanted: false, caught: false, duplicate: false }, "wanted"), "wanted");
  assert.equal(api.ownershipPatchForAction({ wanted: true, caught: false, duplicate: false }, "wanted"), "none");
  assert.equal(api.ownershipPatchForAction({ wanted: false, caught: true, duplicate: false }, "owned"), "none");
  assert.equal(api.ownershipPatchForAction({ wanted: false, caught: true, duplicate: true }, "duplicate"), "owned");
  assert.equal(api.ownershipPatchForAction({ wanted: true, caught: false, duplicate: false }, "duplicate"), "duplicate");
});

test("ownershipStateFromSources prioritizes Double and owned over searches", async () => {
  const api = await loadModule();

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "not_met", shiny: false },
      wanted: true,
      ownCard: { wants: ["0130-gyarados"], for_trade: [] },
    }),
    { wanted: true, caught: false, duplicate: false },
  );

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "caught", shiny: false },
      wanted: true,
      ownCard: { wants: ["0130-gyarados"], for_trade: [] },
    }),
    { wanted: false, caught: true, duplicate: false },
  );

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "seen", shiny: false },
      wanted: true,
      ownCard: { wants: ["0130-gyarados"], for_trade: ["0130-gyarados"] },
    }),
    { wanted: false, caught: true, duplicate: true },
  );
});

test("statusPatchForAction prevents shiny from surviving non-caught states", async () => {
  const api = await loadModule();

  assert.deepEqual(
    api.statusPatchForAction({ state: "caught", shiny: true }, "seen"),
    { state: "seen", shiny: false },
  );
  assert.deepEqual(
    api.statusPatchForAction({ state: "caught", shiny: true }, "not_met"),
    { state: "not_met", shiny: false },
  );
  assert.deepEqual(
    api.statusPatchForAction({ state: "caught", shiny: false }, "shiny"),
    { state: "caught", shiny: true },
  );
  assert.equal(api.statusPatchForAction({ state: "seen", shiny: false }, "shiny"), null);
});

test("buildFormEntries keeps each regional and special form status independent", async () => {
  const api = await loadModule();
  const forms = [
    { slug: "0003-venusaur", number: "0003", names: { fr: "Florizarre" } },
    { slug: "0003-venusaur-mega", number: "0003", names: { fr: "Méga-Florizarre" }, form: "Méga" },
    { slug: "0003-venusaur-alola", number: "0003", names: { fr: "Florizarre d'Alola" }, form: "Forme d'Alola" },
    { slug: "0003-venusaur-galar", number: "0003", names: { fr: "Florizarre de Galar" }, form: "Forme de Galar" },
    { slug: "0003-venusaur-hisui", number: "0003", names: { fr: "Florizarre de Hisui" }, form: "Forme de Hisui" },
    { slug: "0003-venusaur-paldea", number: "0003", names: { fr: "Florizarre de Paldea" }, form: "Forme de Paldea" },
  ];
  const statusBySlug = {
    "0003-venusaur": { state: "caught", shiny: false },
    "0003-venusaur-mega": { state: "seen", shiny: false },
    "0003-venusaur-alola": { state: "caught", shiny: true },
    "0003-venusaur-galar": { state: "not_met", shiny: false },
    "0003-venusaur-hisui": { state: "seen", shiny: true },
    "0003-venusaur-paldea": { state: "caught", shiny: false },
  };

  const entries = api.buildFormEntries(forms[0], forms, (slug) => statusBySlug[slug]);

  assert.deepEqual(entries.map((entry) => entry.slug), forms.map((form) => form.slug));
  assert.equal(entries[0].current, true);
  assert.equal(entries[1].statusLabel, "Aperçu");
  assert.equal(entries[2].statusLabel, "Attrapé shiny");
  assert.equal(entries[4].status.shiny, false);
  assert.equal(entries[5].label, "Forme de Paldea");
});

test("pokemon form route helpers preserve a sanitized list return hash", async () => {
  const api = await loadModule();

  const href = api.pokemonRouteHref(
    "0003-venusaur-alola",
    "#/liste?region=kanto&forms=regional&slug=0003-venusaur",
  );
  assert.equal(
    href,
    "#/pokemon/0003-venusaur-alola?from=%23%2Fliste%3Fregion%3Dkanto%26forms%3Dregional",
  );
  assert.equal(
    api.listReturnHash("#/pokemon/0003-venusaur?from=%23%2Fliste%3Fregion%3Dhisui"),
    "#/liste?region=hisui",
  );
  assert.equal(api.listReturnHash("#/stats"), "#/liste");
});

test("normalizeNoteText trims notes and drops empty content", async () => {
  const api = await loadModule();

  assert.equal(api.normalizeNoteText("  Route 4 / échange  "), "Route 4 / échange");
  assert.equal(api.normalizeNoteText("   "), "");
  assert.equal(api.normalizeNoteText(null), "");
});

test("fiche labels follow English i18n when available", async () => {
  const api = await loadModule();
  globalThis.PokevaultI18n = {
    t(key) {
      return {
        "pokemon_fiche.ownership.wanted": "Wanted",
        "pokemon_fiche.ownership.owned": "Caught",
        "pokemon_fiche.ownership.duplicate": "Double",
        "pokemon_fiche.status.not_met": "Not met",
        "pokemon_fiche.status.seen": "Seen",
        "pokemon_fiche.status.caught": "Caught",
        "pokemon_fiche.status.caught_shiny": "Shiny caught",
      }[key] || key;
    },
  };

  assert.deepEqual(api.buildOwnershipActionModel({}).map((action) => action.label), [
    "Wanted",
    "Caught",
    "Double",
  ]);
  assert.equal(api.statusLabel({ state: "seen", shiny: false }), "Seen");
  assert.equal(api.statusLabel({ state: "caught", shiny: true }), "Shiny caught");
});
