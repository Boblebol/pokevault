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
  ]);
  assert.equal(sections.at(-1).id, "notes");
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

test("createCollapsibleBody collapses fiche content and toggles it", async () => {
  const api = await loadModule();
  const section = api.createFicheSection({ id: "forms", title: "Formes" });

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
  assert.equal(api.parsePokemonRouteSlug("#pokemon/0001-bulbasaur?tab=formes"), "0001-bulbasaur");
  assert.equal(api.parsePokemonRouteSlug("#/pokemon/mr-mime%20test"), "mr-mime test");
  assert.equal(api.parsePokemonRouteSlug("#/liste?slug=0025-pikachu"), null);
});

test("buildStatusActionModel exposes only direct Pokedex capture actions", async () => {
  const api = await loadModule();

  const seenActions = api.buildStatusActionModel({ state: "seen", shiny: true });
  assert.deepEqual(seenActions.map((action) => action.id), [
    "not_met",
    "seen",
    "caught",
  ]);
  assert.equal(seenActions[1].active, true);

  const caughtActions = api.buildStatusActionModel({ state: "caught", shiny: true });
  assert.equal(caughtActions[2].active, true);
  assert.equal(caughtActions.some((action) => action.id === "shiny"), false);
});

test("buildOwnershipActionModel exposes incremental capture and release actions", async () => {
  const api = await loadModule();

  const empty = api.buildOwnershipActionModel({ caught: false, duplicate: false });
  assert.deepEqual(empty.map((action) => action.id), ["capture"]);
  assert.deepEqual(empty.map((action) => action.label), ["Capturer"]);
  assert.deepEqual(empty.map((action) => action.patch), ["owned"]);
  assert.equal(api.ownershipLabel({ caught: false, duplicate: false }), "À attraper");

  const owned = api.buildOwnershipActionModel({ caught: true, duplicate: false });
  assert.deepEqual(owned.map((action) => action.id), ["capture", "release"]);
  assert.deepEqual(owned.map((action) => action.label), ["Capturer", "Relâcher"]);
  assert.deepEqual(owned.map((action) => action.patch), ["duplicate", "none"]);
  assert.equal(api.ownershipLabel({ caught: true, duplicate: false }), "Capturé");

  const duplicate = api.buildOwnershipActionModel({ caught: true, duplicate: true });
  assert.deepEqual(duplicate.map((action) => action.id), ["capture", "release"]);
  assert.deepEqual(duplicate.map((action) => action.patch), ["duplicate", "release_one"]);
  assert.equal(api.ownershipLabel({ caught: true, duplicate: true }), "Plusieurs exemplaires");
});

test("ownershipPatchForAction maps plus one and minus one ownership flow", async () => {
  const api = await loadModule();

  assert.equal(api.ownershipPatchForAction({ caught: false, duplicate: false }, "capture"), "owned");
  assert.equal(api.ownershipPatchForAction({ caught: true, duplicate: false }, "capture"), "duplicate");
  assert.equal(api.ownershipPatchForAction({ caught: true, duplicate: true }, "capture"), "duplicate");
  assert.equal(api.ownershipPatchForAction({ caught: true, duplicate: true }, "release"), "release_one");
  assert.equal(api.ownershipPatchForAction({ caught: true, duplicate: false }, "release"), "none");
  assert.equal(api.ownershipPatchForAction({ caught: false, duplicate: false }, "release"), null);
  assert.equal(api.ownershipPatchForAction({ caught: true, duplicate: false }, "owned"), null);
});

test("createOwnershipActions renders one or two buttons for the flow", async () => {
  const api = await loadModule();
  const called = [];

  const empty = api.createOwnershipActions({ caught: false, duplicate: false }, (patch, action) => {
    called.push([patch, action.id]);
  });

  assert.equal(empty.children.length, 1);
  assert.equal(empty.children[0].dataset.action, "capture");
  assert.equal(empty.children[0].textContent, "Capturer");
  empty.children[0].events.click({ preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(called.pop(), ["owned", "capture"]);

  const duplicate = api.createOwnershipActions({ caught: true, duplicate: true }, (patch, action) => {
    called.push([patch, action.id]);
  });
  assert.deepEqual(duplicate.children.map((button) => button.dataset.action), ["capture", "release"]);
  duplicate.children[1].events.click({ preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(called.pop(), ["release_one", "release"]);
});

test("createTypeChip decorates type labels with stable color data", async () => {
  const api = await loadModule();

  const chip = api.createTypeChip("Électrik", "pokemon-modal-type-badge");

  assert.equal(chip.textContent, "Électrik");
  assert.equal(chip.dataset.type, "electric");
  assert.match(chip.className, /pokemon-type-chip/);
  assert.match(chip.className, /pokemon-modal-type-badge/);
});

test("ownershipStateFromSources derives duplicate from local Trainer Card only", async () => {
  const api = await loadModule();

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "not_met" },
      ownCard: { for_trade: [] },
    }),
    { caught: false, duplicate: false },
  );

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "caught" },
      ownCard: { for_trade: [] },
    }),
    { caught: true, duplicate: false },
  );

  assert.deepEqual(
    api.ownershipStateFromSources("0130-gyarados", {
      status: { state: "not_met" },
      ownCard: { for_trade: ["0130-gyarados"] },
    }),
    { caught: true, duplicate: true },
  );
});

test("statusPatchForAction ignores legacy shiny inputs", async () => {
  const api = await loadModule();

  assert.deepEqual(
    api.statusPatchForAction({ state: "caught", shiny: true }, "seen"),
    { state: "seen" },
  );
  assert.deepEqual(
    api.statusPatchForAction({ state: "caught", shiny: true }, "not_met"),
    { state: "not_met" },
  );
  assert.deepEqual(
    api.statusPatchForAction({ state: "seen", shiny: true }, "caught"),
    { state: "caught" },
  );
  assert.equal(api.statusPatchForAction({ state: "seen" }, "shiny"), null);
});

test("buildFormEntries keeps each regional and special form status independent", async () => {
  const api = await loadModule();
  globalThis.__POKEVAULT_CAPTURE_SCOPE_TESTS__ = true;
  await import(`../../web/pokemon-capture-scope.js?case=fiche-${Date.now()}`);
  const forms = [
    { slug: "0003-venusaur", number: "0003", names: { fr: "Florizarre" } },
    { slug: "0003-venusaur-mega", number: "0003", names: { fr: "Méga-Florizarre" }, form: "Méga" },
    { slug: "0003-venusaur-alola", number: "0003", names: { fr: "Florizarre d'Alola" }, form: "Forme d'Alola" },
    { slug: "0003-venusaur-galar", number: "0003", names: { fr: "Florizarre de Galar" }, form: "Forme de Galar" },
    { slug: "0003-venusaur-hisui", number: "0003", names: { fr: "Florizarre de Hisui" }, form: "Forme de Hisui" },
    { slug: "0003-venusaur-paldea", number: "0003", names: { fr: "Florizarre de Paldea" }, form: "Forme de Paldea" },
  ];
  const statusBySlug = {
    "0003-venusaur": { state: "caught" },
    "0003-venusaur-mega": { state: "seen" },
    "0003-venusaur-alola": { state: "caught", shiny: true },
    "0003-venusaur-galar": { state: "not_met" },
    "0003-venusaur-hisui": { state: "seen", shiny: true },
    "0003-venusaur-paldea": { state: "caught" },
  };

  const entries = api.buildFormEntries(forms[0], forms, (slug) => statusBySlug[slug]);

  assert.deepEqual(entries.map((entry) => entry.slug), forms.map((form) => form.slug));
  assert.equal(entries[0].current, true);
  assert.equal(entries[1].statusLabel, "Aperçu");
  assert.equal(entries[1].capturable, false);
  assert.equal(entries[2].statusLabel, "Attrapé");
  assert.equal(entries[2].capturable, true);
  assert.equal("shiny" in entries[4].status, false);
  assert.equal(entries[5].label, "Forme de Paldea");
  assert.equal(entries[5].capturable, true);
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
        "pokemon_fiche.ownership.owned": "Caught",
        "pokemon_fiche.ownership.duplicate": "Multiple copies",
        "pokemon_fiche.ownership.capture": "Catch",
        "pokemon_fiche.ownership.release": "Release",
        "pokemon_fiche.ownership.none": "To catch",
        "pokemon_fiche.status.not_met": "Not met",
        "pokemon_fiche.status.seen": "Seen",
        "pokemon_fiche.status.caught": "Caught",
      }[key] || key;
    },
  };

  assert.deepEqual(api.buildOwnershipActionModel({}).map((action) => action.label), [
    "Catch",
  ]);
  assert.equal(api.ownershipLabel({ caught: true, duplicate: true }), "Multiple copies");
  assert.equal(api.statusLabel({ state: "seen", shiny: false }), "Seen");
  assert.equal(api.statusLabel({ state: "caught", shiny: true }), "Caught");
});
