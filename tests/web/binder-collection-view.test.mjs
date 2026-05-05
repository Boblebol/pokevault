import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

function createFakeElement(tagName = "div") {
  const el = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    className: "",
    dataset: {},
    attributes: {},
    style: {
      props: {},
      setProperty(name, value) {
        this.props[name] = value;
      },
    },
    get options() {
      return this.children.filter((child) => child.tagName === "OPTION");
    },
    get textContent() {
      return this._textContent || this.children.map((child) => child.textContent || "").join("");
    },
    set textContent(value) {
      this._textContent = String(value);
      this.children = [];
    },
    append(...children) {
      this._textContent = "";
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this._textContent = "";
      this.children = [...children];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    addEventListener() {},
  };
  el.classList = {
    add(...classes) {
      const current = new Set(el.className.split(/\s+/).filter(Boolean));
      for (const cls of classes) current.add(cls);
      el.className = [...current].join(" ");
    },
    toggle(cls, force) {
      const current = new Set(el.className.split(/\s+/).filter(Boolean));
      const next = force ?? !current.has(cls);
      if (next) current.add(cls);
      else current.delete(cls);
      el.className = [...current].join(" ");
    },
  };
  return el;
}

function createFakeDocument(elements = {}) {
  return {
    createElement: createFakeElement,
    getElementById(id) {
      return elements[id] || null;
    },
  };
}

async function loadModule({ document = createFakeDocument() } = {}) {
  globalThis.__POKEVAULT_BINDER_SHELL_TESTS__ = true;
  globalThis.window = globalThis;
  delete globalThis.PokevaultI18n;
  delete globalThis.PokedexBinder;
  delete globalThis.PokedexCollection;
  delete globalThis.PokevaultBinderLayout;
  globalThis.document = document;
  importCase += 1;
  await import(`../../web/binder-collection-view.js?case=${Date.now()}-${importCase}`);
  return globalThis.window.PokedexBinderShell._test;
}

test("binder shell formats physical binder labels through i18n", async () => {
  const api = await loadModule();
  globalThis.PokevaultI18n = {
    t(key, params = {}) {
      const messages = {
        "binder_shell.format": "Format {rows}×{cols} · {sheets} sheets · {capacity} slots.",
        "binder_shell.face.recto": "Front",
        "binder_shell.face.verso": "Back",
        "binder_shell.page_label": "Page {page} (sheet {sheet}/{sheets} {face})",
      };
      return (messages[key] || key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name]));
    },
  };

  assert.equal(
    api.binderFormatText({ rows: 2, cols: 2, sheet_count: 5 }),
    "Format 2×2 · 5 sheets · 40 slots.",
  );
  assert.deepEqual(api.faceLabels({ sheet_count: 5 }, 0, 2), [
    "Page 1 (sheet 1/5 Front)",
    "Page 2 (sheet 1/5 Back)",
  ]);
});

test("binder shell creates a visible family reserved card", async () => {
  const api = await loadModule();
  const card = api.createReservedSlotCard({
    emptyKind: "family_reserved",
    familyId: "0133-eevee",
    slot: 4,
  });

  assert.equal(card.className, "card card--reserved-slot binder-card");
  assert.equal(card.dataset.emptyKind, "family_reserved");
  assert.equal(card.textContent.includes("Reserve famille"), true);
});

test("binder grid renders alignment empty as quiet empty slot", async () => {
  const api = await loadModule();
  const card = api.createReservedSlotCard({
    emptyKind: "alignment_empty",
    familyId: null,
    slot: 2,
  });

  assert.equal(card.dataset.emptyKind, "alignment_empty");
  assert.equal(card.dataset.familyId, "");
  assert.equal(card.className.includes("card--alignment-empty"), true);
  assert.ok(String(card.textContent || "").includes("Emplacement vide"));
  assert.equal(String(card.textContent || "").includes("Reserve famille"), false);
});

test("binder shell renders physical slots while nav metrics use logical binder totals", async () => {
  await loadModule({
    document: createFakeDocument({
      binderPagesHost: createFakeElement("div"),
      binderShellHint: createFakeElement("p"),
      binderMetrics: createFakeElement("div"),
      binderVaultsNav: createFakeElement("nav"),
    }),
  });

  const logicalPokemon = [
    { slug: "0001-bulbasaur", number: "0001" },
    { slug: "0002-ivysaur", number: "0002" },
    { slug: "0003-venusaur", number: "0003" },
    { slug: "0004-charmander", number: "0004" },
    { slug: "0005-charmeleon", number: "0005" },
  ];

  globalThis.PokedexCollection = {
    allPokemon: logicalPokemon,
    caughtMap: {
      "0001-bulbasaur": true,
      "0002-ivysaur": true,
      "0004-charmander": true,
    },
    regionDefinitions: [],
    createPokemonCard(pokemon, opts = {}) {
      const card = createFakeElement("article");
      card.className = opts.empty ? "card card--empty-slot" : "card";
      card.textContent = pokemon ? pokemon.slug : "empty";
      return card;
    },
  };
  globalThis.PokevaultBinderLayout = {
    computeBinderSlots() {
      return [
        { slot: 1, pokemon: logicalPokemon[0], emptyKind: null, familyId: "0001-bulbasaur" },
        { slot: 2, pokemon: null, emptyKind: "family_reserved", familyId: "0001-bulbasaur" },
        { slot: 3, pokemon: null, emptyKind: "capacity_empty", familyId: null },
      ];
    },
  };
  globalThis.PokedexBinder = {
    orderPokemonForBinder() {
      return logicalPokemon;
    },
  };

  globalThis.PokedexBinderShell.syncFromConfig({
    binders: [{ id: "tiny", name: "Tiny", rows: 1, cols: 3, sheet_count: 1 }],
  });

  const pagesHost = globalThis.document.getElementById("binderPagesHost");
  const hint = globalThis.document.getElementById("binderShellHint");
  const metrics = globalThis.document.getElementById("binderMetrics");
  const nav = globalThis.document.getElementById("binderVaultsNav");

  assert.equal(pagesHost.textContent.includes("Reserve famille"), true);
  assert.equal(hint.textContent.includes("sur 3 cases, 5 Pokémon"), true);
  assert.equal(metrics.textContent.includes("3 / 5"), true);
  assert.equal(nav.textContent.includes("3 / 5"), true);
});

test("binder shell keeps the empty-data hint when physical capacity slots exist", async () => {
  await loadModule({
    document: createFakeDocument({
      binderPagesHost: createFakeElement("div"),
      binderShellHint: createFakeElement("p"),
      binderMetrics: createFakeElement("div"),
      binderVaultsNav: createFakeElement("nav"),
    }),
  });

  globalThis.PokedexCollection = {
    allPokemon: [],
    caughtMap: {},
    regionDefinitions: [],
  };
  globalThis.PokevaultBinderLayout = {
    computeBinderSlots() {
      return [
        { slot: 1, pokemon: null, emptyKind: "capacity_empty", familyId: null },
        { slot: 2, pokemon: null, emptyKind: "capacity_empty", familyId: null },
        { slot: 3, pokemon: null, emptyKind: "capacity_empty", familyId: null },
      ];
    },
  };
  globalThis.PokedexBinder = {
    orderPokemonForBinder() {
      return [];
    },
  };

  globalThis.PokedexBinderShell.syncFromConfig({
    binders: [{ id: "empty", name: "Empty", rows: 1, cols: 3, sheet_count: 1 }],
  });

  const hint = globalThis.document.getElementById("binderShellHint");
  assert.equal(hint.textContent.includes("Charge le Pokédex"), true);
  assert.equal(hint.textContent.includes("Emplacements 1-3"), false);
});
