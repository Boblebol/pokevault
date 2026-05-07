import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;
let binderApi = null;

function installBrowserStubs() {
  globalThis.window = globalThis;
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  globalThis.document = {
    createElement(tagName) {
      return {
        tagName,
        children: [],
        classList: { add() {}, remove() {} },
        dataset: {},
        append(...nodes) {
          this.children.push(...nodes);
        },
        replaceChildren(...nodes) {
          this.children = [...nodes];
        },
        addEventListener() {},
        setAttribute() {},
      };
    },
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
  };
}

function makeInteractiveElement(tagName) {
  const el = {
    tagName,
    children: [],
    className: "",
    dataset: {},
    hidden: false,
    _textContent: "",
    value: "",
    listeners: {},
    classList: {
      add(...names) {
        const classes = new Set(String(el.className || "").split(/\s+/).filter(Boolean));
        for (const name of names) classes.add(name);
        el.className = [...classes].join(" ");
      },
      remove(...names) {
        const remove = new Set(names);
        el.className = String(el.className || "")
          .split(/\s+/)
          .filter((name) => name && !remove.has(name))
          .join(" ");
      },
      contains(name) {
        return String(el.className || "").split(/\s+/).includes(name);
      },
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = [...nodes];
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    click() {
      this.listeners.click?.();
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const classes = selector
        .split(".")
        .map((part) => part.trim())
        .filter(Boolean);
      const out = [];
      const visit = (node) => {
        if (!node || typeof node !== "object") return;
        const nodeClasses = String(node.className || "").split(/\s+/).filter(Boolean);
        if (classes.length && classes.every((cls) => nodeClasses.includes(cls))) out.push(node);
        for (const child of node.children || []) visit(child);
      };
      visit(this);
      return out;
    },
  };
  Object.defineProperty(el, "textContent", {
    get() {
      return [
        this._textContent,
        ...this.children.map((child) => (child && typeof child === "object" ? child.textContent : String(child))),
      ].join("");
    },
    set(value) {
      this._textContent = String(value);
    },
  });
  return el;
}

function installInteractiveWizardDom() {
  const body = makeInteractiveElement("div");
  body.id = "binderWizardBody";
  globalThis.document = {
    createElement: makeInteractiveElement,
    getElementById(id) {
      return id === "binderWizardBody" ? body : null;
    },
    querySelector(selector) {
      return body.querySelector(selector);
    },
  };
  return body;
}

async function loadModule() {
  if (!binderApi) {
    installBrowserStubs();
    importCase += 1;
    await import(`../../web/binder-layout-engine.js?case=${Date.now()}-${importCase}-engine`);
    await import(`../../web/binder-v2.js?case=${Date.now()}-${importCase}`);
    binderApi = globalThis.window.PokedexBinder._test;
  }
  return binderApi;
}

function makePokemon(count, region = "kanto") {
  return Array.from({ length: count }, (_, idx) => {
    const n = idx + 1;
    const number = String(n).padStart(4, "0");
    return {
      slug: `${number}-pokemon-${n}`,
      number,
      names: { fr: `Pokemon ${n}` },
      region,
    };
  });
}

test("binder family data preload predicates include regional family albums", async () => {
  const api = await loadModule();

  assert.equal(api.binderUsesEvolutionFamilies({ organization: "family" }), true);
  assert.equal(api.binderUsesEvolutionFamilies({ organization: "regional_family_album" }), true);
  assert.equal(api.binderUsesEvolutionFamilies({ organization: "national" }), false);
  assert.equal(api.configUsesEvolutionFamilies({ binders: [{ organization: "regional_family_album" }] }), true);
});

test("wizard draft prefill preserves regional family album organization", async () => {
  const api = await loadModule();
  const draft = api.draftFromConfigForTest(
    {
      binders: [
        {
          id: "grand",
          name: "Grand",
          organization: "regional_family_album",
          rows: 3,
          cols: 3,
          sheet_count: 42,
          form_rule_id: "wizard-forms-base_regional",
        },
      ],
      form_rules: [api.formRuleFromScope("base_regional")],
    },
    "grand",
  );

  assert.equal(draft.organization, "regional_family_album");
  assert.equal(draft.formatPreset, "large-ring-3x3");
  assert.equal(draft.formScope, "base_regional");
  assert.equal(draft.rows, 3);
  assert.equal(draft.cols, 3);

  const ordinaryThreeByThree = api.draftFromConfigForTest(
    {
      binders: [
        {
          id: "ordinary",
          name: "Ordinary",
          organization: "national",
          rows: 3,
          cols: 3,
          sheet_count: 42,
          form_rule_id: "wizard-forms-base_regional",
        },
      ],
      form_rules: [api.formRuleFromScope("base_regional")],
    },
    "ordinary",
  );

  assert.equal(ordinaryThreeByThree.organization, "national");
  assert.notEqual(ordinaryThreeByThree.formatPreset, "large-ring-3x3");
});

test("wizard exposes large ring option and summary copy", async () => {
  const api = await loadModule();

  let body = installInteractiveWizardDom();
  api.renderWizardStepForTest(0, {
    organization: "national",
    formScope: "full",
    formatPreset: "custom",
    rows: 4,
    cols: 4,
    sheetCount: 12,
  });
  const largeRingOrg = body
    .querySelectorAll(".wizard-org-card")
    .find((el) => el.dataset.org === "regional_family_album");

  assert.ok(largeRingOrg);
  largeRingOrg.click();
  assert.deepEqual(api.getWizardDraftForTest(), {
    name: "Principal",
    organization: "regional_family_album",
    formScope: "base_regional",
    formatPreset: "large-ring-3x3",
    rows: 3,
    cols: 3,
    sheetCount: 12,
    editBinderId: null,
  });

  body = installInteractiveWizardDom();
  api.renderWizardStepForTest(2, {
    organization: "national",
    formScope: "full",
    formatPreset: "custom",
    rows: 5,
    cols: 5,
    sheetCount: 20,
  });
  const largeRingFormat = body
    .querySelectorAll(".wizard-format-card")
    .find((el) => el.dataset.formatKey === "large-ring-3x3");

  assert.ok(largeRingFormat);
  largeRingFormat.click();
  assert.equal(api.readFormatSelectionForTest(), true);
  assert.equal(body.querySelector(".wizard-custom-panel").hidden, true);
  assert.equal(api.getWizardDraftForTest().organization, "regional_family_album");
  assert.equal(api.getWizardDraftForTest().formScope, "full");
  assert.equal(api.getWizardDraftForTest().formatPreset, "large-ring-3x3");
  assert.equal(api.getWizardDraftForTest().rows, 3);
  assert.equal(api.getWizardDraftForTest().cols, 3);

  body = installInteractiveWizardDom();
  api.renderWizardStepForTest(3, {
    organization: "regional_family_album",
    formScope: "base_regional",
    formatPreset: "large-ring-3x3",
    rows: 3,
    cols: 3,
    sheetCount: 42,
  });

  const recapText = body.querySelector(".wizard-recap").textContent;
  assert.match(recapText, /Grand classeur 3x3 : régions au recto, familles compactes/);
  assert.match(recapText, /3 × 3 auto \+ 10 feuillets libres/);
  assert.match(recapText, /Capacité calculée automatiquement \(\+ 10 feuillets libres\)/);
  assert.doesNotMatch(recapText, /42 feuillets/);
  assert.match(recapText, /Un seul grand classeur physique, organisé par régions internes\./);
});

test("wizard normal format selection leaves large ring organization", async () => {
  const api = await loadModule();

  const body = installInteractiveWizardDom();
  api.renderWizardStepForTest(2, {
    organization: "regional_family_album",
    formScope: "base_regional",
    formatPreset: "large-ring-3x3",
    rows: 3,
    cols: 3,
    sheetCount: 42,
  });
  const standardFormat = body
    .querySelectorAll(".wizard-format-card")
    .find((el) => el.dataset.formatKey === "3x3-10");

  assert.ok(standardFormat);
  standardFormat.click();
  assert.equal(api.readFormatSelectionForTest(), true);

  const draft = api.getWizardDraftForTest();
  assert.equal(draft.organization, "national");
  assert.equal(draft.formatPreset, "3x3-10");
  assert.equal(draft.rows, 3);
  assert.equal(draft.cols, 3);
  assert.equal(draft.sheetCount, 10);
});

test("wizard edit payload preserves regional family album organization", async () => {
  const api = await loadModule();
  const result = api.buildPersistEditPayloads(
    {
      editBinderId: "grand",
      name: "Grand",
      organization: "regional_family_album",
      formScope: "base_regional",
      rows: 3,
      cols: 3,
      sheetCount: 42,
    },
    {
      version: 1,
      convention: "sheet_recto_verso",
      binders: [
        {
          id: "grand",
          name: "Old",
          organization: "regional_family_album",
          rows: 3,
          cols: 3,
          sheet_count: 40,
          form_rule_id: "wizard-forms-base_regional",
        },
      ],
      form_rules: [api.formRuleFromScope("base_regional")],
    },
    { version: 1, by_binder: { grand: {} } },
  );

  assert.equal(result.configBody.binders[0].organization, "regional_family_album");
});

test("large ring binder edit recomputes sheet count from family layout", async () => {
  const api = await loadModule();
  api.setEvolutionFamilyData(null);
  globalThis.fetch = async (url) => {
    if (url === "/data/pokedex.json") {
      return {
        ok: true,
        async json() {
          return {
            meta: {
              regions: [
                { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
                { id: "johto", label_fr: "Johto", low: 152, high: 251 },
              ],
            },
            pokemon: [
              ...makePokemon(10, "kanto"),
              { slug: "0152-chikorita", number: "0152", region: "johto" },
            ],
          };
        },
      };
    }
    if (url === "/data/evolution-families.json") {
      return {
        ok: true,
        async json() {
          return {
            families: [
              { id: "0001-pokemon-1", layout_rows: [["0001-pokemon-1", "0002-pokemon-2", "0003-pokemon-3"]] },
              { id: "0152-chikorita", layout_rows: [["0152-chikorita"]] },
            ],
          };
        },
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const result = await api.buildPersistEditPayloadsFromDraft(
    {
      editBinderId: "grand",
      name: "Grand",
      organization: "regional_family_album",
      formScope: "base_regional",
      rows: 3,
      cols: 3,
      sheetCount: 1,
    },
    {
      version: 1,
      convention: "sheet_recto_verso",
      binders: [
        {
          id: "grand",
          name: "Old",
          organization: "national",
          region_scope: "kanto",
          region_id: "kanto",
          range_start: 18,
          range_limit: 18,
          rows: 3,
          cols: 3,
          sheet_count: 1,
          form_rule_id: "wizard-forms-base_regional",
        },
      ],
      form_rules: [api.formRuleFromScope("base_regional")],
    },
    { version: 1, by_binder: { grand: {} } },
  );

  assert.equal(result.configBody.binders[0].sheet_count, 12);
  assert.equal(result.configBody.binders[0].organization, "regional_family_album");
  assert.equal("region_scope" in result.configBody.binders[0], false);
  assert.equal("region_id" in result.configBody.binders[0], false);
  assert.equal("range_start" in result.configBody.binders[0], false);
  assert.equal("range_limit" in result.configBody.binders[0], false);
  assert.deepEqual(result.configBody.binders[0].layout_options, {
    region_break: "new_sheet",
    family_compact: true,
    auto_capacity: true,
    margin_sheets: 10,
  });
});

test("large ring binder edit rejects missing pokedex data before recomputing capacity", async () => {
  const api = await loadModule();
  api.setEvolutionFamilyData({ families: [{ id: "0001-bulbasaur" }] });
  globalThis.fetch = async (url) => {
    if (url === "/data/pokedex.json") return { ok: false };
    throw new Error(`unexpected fetch ${url}`);
  };

  await assert.rejects(
    () =>
      api.buildPersistEditPayloadsFromDraft(
        {
          editBinderId: "grand",
          name: "Grand",
          organization: "regional_family_album",
          formScope: "base_regional",
          rows: 3,
          cols: 3,
          sheetCount: 1,
        },
        {
          version: 1,
          convention: "sheet_recto_verso",
          binders: [{ id: "grand", organization: "regional_family_album", sheet_count: 1 }],
          form_rules: [api.formRuleFromScope("base_regional")],
        },
        { version: 1, by_binder: { grand: {} } },
      ),
    /large-ring-pokedex-data-unavailable/,
  );
});

test("wizard org selection preserves hidden regional family album edit drafts", async () => {
  const api = await loadModule();

  assert.equal(
    api.readOrgSelectionForDraftForTest({
      editBinderId: "grand",
      organization: "regional_family_album",
    }),
    "regional_family_album",
  );
});

test("large ring binder workspace creates one 3x3 regional family album with margin", async () => {
  const api = await loadModule();
  const defs = [
    { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
    { id: "johto", label_fr: "Johto", low: 152, high: 251 },
  ];
  const pokemon = [
    ...makePokemon(10, "kanto"),
    { slug: "0152-chikorita", number: "0152", region: "johto" },
  ];
  const families = {
    families: [
      { id: "0001-pokemon-1", layout_rows: [["0001-pokemon-1", "0002-pokemon-2", "0003-pokemon-3"]] },
      { id: "0152-chikorita", layout_rows: [["0152-chikorita"]] },
    ],
  };

  const result = api.buildLargeRingBinderWorkspace(
    {
      name: "Grand classeur",
      organization: "regional_family_album",
      formScope: "base_regional",
      rows: 3,
      cols: 3,
      sheetCount: 1,
    },
    defs,
    pokemon,
    families,
    "test",
  );

  assert.equal(result.configBody.binders.length, 1);
  assert.deepEqual(result.placementsBody.by_binder, { "classeur-test-grand-3x3": {} });
  assert.equal(result.configBody.binders[0].id, "classeur-test-grand-3x3");
  assert.equal(result.configBody.binders[0].name, "Grand classeur");
  assert.equal(result.configBody.binders[0].organization, "regional_family_album");
  assert.equal(result.configBody.binders[0].rows, 3);
  assert.equal(result.configBody.binders[0].cols, 3);
  assert.equal(result.configBody.binders[0].sheet_count, 12);
  assert.equal(result.configBody.binders[0].form_rule_id, "wizard-forms-base_regional");
  assert.deepEqual(result.configBody.binders[0].layout_options, {
    region_break: "new_sheet",
    family_compact: true,
    auto_capacity: true,
    margin_sheets: 10,
  });
});

test("autoSheetCountForLargeRing falls back from pokemon count when layout engine is unavailable", async () => {
  const api = await loadModule();
  const engine = globalThis.PokevaultBinderLayout;
  const originalComputeBinderSlots = engine.computeBinderSlots;
  engine.computeBinderSlots = undefined;

  try {
    const pokemon = Array.from({ length: 37 }, (_, idx) => ({
      slug: `${String(idx + 1).padStart(4, "0")}-pokemon-${idx + 1}`,
      number: String(idx + 1).padStart(4, "0"),
    }));

    assert.equal(api.autoSheetCountForLargeRing(pokemon, [], { families: [{ id: "f1" }] }), 13);
  } finally {
    engine.computeBinderSlots = originalComputeBinderSlots;
  }
});

test("hasEvolutionFamilyData rejects empty families", async () => {
  const api = await loadModule();

  assert.equal(api.hasEvolutionFamilyData({ families: [] }), false);
  assert.equal(api.hasEvolutionFamilyData({ families: [{ id: "0001-bulbasaur" }] }), true);
});

test("buildPersistNewPayloadsFromDraft dispatches the large ring binder mode", async () => {
  const api = await loadModule();
  globalThis.fetch = async (url) => {
    if (url === "/data/pokedex.json") {
      return {
        ok: true,
        async json() {
          return {
            meta: {
              regions: [
                { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
                { id: "johto", label_fr: "Johto", low: 152, high: 251 },
              ],
            },
            pokemon: [
              { slug: "0001-bulbasaur", number: "0001", region: "kanto" },
              { slug: "0152-chikorita", number: "0152", region: "johto" },
            ],
          };
        },
      };
    }
    if (url === "/data/evolution-families.json") {
      return {
        ok: true,
        async json() {
          return {
            families: [
              { id: "0001-bulbasaur", layout_rows: [["0001-bulbasaur"]] },
              { id: "0152-chikorita", layout_rows: [["0152-chikorita"]] },
            ],
          };
        },
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const result = await api.buildPersistNewPayloadsFromDraft({
    name: "Grand classeur",
    organization: "regional_family_album",
    formScope: "base_regional",
    rows: 3,
    cols: 3,
    sheetCount: 1,
  });

  assert.equal(result.configBody.binders.length, 1);
  assert.equal(result.configBody.binders[0].organization, "regional_family_album");
});

test("buildPersistNewPayloadsFromDraft rejects large ring binder without pokedex data", async () => {
  const api = await loadModule();
  api.setEvolutionFamilyData({ families: [{ id: "0001-bulbasaur" }] });
  globalThis.fetch = async (url) => {
    if (url === "/data/pokedex.json") return { ok: false };
    throw new Error(`unexpected fetch ${url}`);
  };

  await assert.rejects(
    () =>
      api.buildPersistNewPayloadsFromDraft({
        name: "Grand",
        organization: "regional_family_album",
        formScope: "base_regional",
        rows: 3,
        cols: 3,
        sheetCount: 1,
      }),
    /large-ring-pokedex-data-unavailable/,
  );
});

test("buildPersistNewPayloadsFromDraft rejects large ring binder without family data", async () => {
  const api = await loadModule();
  api.setEvolutionFamilyData(null);
  globalThis.fetch = async (url) => {
    if (url === "/data/pokedex.json") {
      return {
        ok: true,
        async json() {
          return {
            meta: { regions: [{ id: "kanto", low: 1, high: 151 }] },
            pokemon: [{ slug: "0001-bulbasaur", number: "0001", region: "kanto" }],
          };
        },
      };
    }
    if (url === "/data/evolution-families.json") return { ok: false };
    throw new Error(`unexpected fetch ${url}`);
  };

  await assert.rejects(
    () =>
      api.buildPersistNewPayloadsFromDraft({
        name: "Grand",
        organization: "regional_family_album",
        formScope: "base_regional",
        rows: 3,
        cols: 3,
        sheetCount: 1,
      }),
    /large-ring-family-data-unavailable/,
  );
});

test("persistWizardDraft reports family data errors before persisting large ring binders", async () => {
  const api = await loadModule();
  api.setEvolutionFamilyData(null);
  const originalGetElementById = globalThis.document.getElementById;
  const hint = { textContent: "", hidden: true };
  const calls = [];
  globalThis.document.getElementById = (id) => (id === "binderV2Hint" ? hint : null);
  globalThis.fetch = async (url, opts = {}) => {
    calls.push([url, opts.method || "GET"]);
    if (url === "/data/pokedex.json") {
      return {
        ok: true,
        async json() {
          return {
            meta: { regions: [{ id: "kanto", low: 1, high: 151 }] },
            pokemon: [{ slug: "0001-bulbasaur", number: "0001", region: "kanto" }],
          };
        },
      };
    }
    if (url === "/data/evolution-families.json") return { ok: false };
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const ok = await globalThis.window.PokedexBinder.persistWizardDraft({
      name: "Grand",
      organization: "regional_family_album",
      formScope: "base_regional",
      rows: 3,
      cols: 3,
      sheetCount: 1,
    });

    assert.equal(ok, false);
    assert.equal(hint.hidden, false);
    assert.match(hint.textContent, /familles d'évolution/);
    assert.deepEqual(calls, [
      ["/data/pokedex.json", "GET"],
      ["/data/evolution-families.json", "GET"],
    ]);
  } finally {
    globalThis.document.getElementById = originalGetElementById;
  }
});

test("persistWizardDraft reports pokedex data errors before persisting large ring binders", async () => {
  const api = await loadModule();
  api.setEvolutionFamilyData({ families: [{ id: "0001-bulbasaur" }] });
  const originalGetElementById = globalThis.document.getElementById;
  const hint = { textContent: "", hidden: true };
  const calls = [];
  globalThis.document.getElementById = (id) => (id === "binderV2Hint" ? hint : null);
  globalThis.fetch = async (url, opts = {}) => {
    calls.push([url, opts.method || "GET"]);
    if (url === "/data/pokedex.json") return { ok: false };
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const ok = await globalThis.window.PokedexBinder.persistWizardDraft({
      name: "Grand",
      organization: "regional_family_album",
      formScope: "base_regional",
      rows: 3,
      cols: 3,
      sheetCount: 1,
    });

    assert.equal(ok, false);
    assert.equal(hint.hidden, false);
    assert.match(hint.textContent, /Pokédex/);
    assert.deepEqual(calls, [["/data/pokedex.json", "GET"]]);
  } finally {
    globalThis.document.getElementById = originalGetElementById;
  }
});

test("regional binder builder keeps the default 3x3 ten-sheet Kanto binder together", async () => {
  const api = await loadModule();
  const defs = [{ id: "kanto", label_fr: "Kanto", low: 1, high: 151 }];
  const pokemon = makePokemon(151);

  const result = api.buildRegionalBinderWorkspace(
    {
      name: "Principal",
      organization: "by_region",
      formScope: "base_only",
      rows: 3,
      cols: 3,
      sheetCount: 10,
    },
    defs,
    pokemon,
    "test",
  );

  assert.equal(result.configBody.binders.length, 1);
  assert.equal(result.configBody.binders[0].name, "Kanto");
  assert.equal(result.configBody.binders[0].rows, 3);
  assert.equal(result.configBody.binders[0].cols, 3);
  assert.equal(result.configBody.binders[0].sheet_count, 10);
  assert.equal(result.configBody.binders[0].range_start, 0);
  assert.equal(result.configBody.binders[0].range_limit, 180);
});

test("regional binder builder splits regions that exceed the selected sheet capacity", async () => {
  const api = await loadModule();
  const defs = [{ id: "kanto", label_fr: "Kanto", low: 1, high: 151 }];
  const pokemon = makePokemon(17);

  const result = api.buildRegionalBinderWorkspace(
    {
      name: "Principal",
      organization: "by_region",
      formScope: "base_only",
      rows: 2,
      cols: 2,
      sheetCount: 1,
    },
    defs,
    pokemon,
    "test",
  );

  assert.deepEqual(
    result.configBody.binders.map((binder) => binder.name),
    ["Kanto 1", "Kanto 2", "Kanto 3"],
  );
  assert.deepEqual(
    result.configBody.binders.map((binder) => [binder.range_start, binder.range_limit]),
    [
      [0, 8],
      [8, 8],
      [16, 8],
    ],
  );
});

test("orderPokemonForBinder respects regional range chunks", async () => {
  const api = await loadModule();
  const defs = [{ id: "kanto", label_fr: "Kanto", low: 1, high: 151 }];
  const pokemon = makePokemon(10);

  const ordered = api.orderPokemonForBinder(
    {
      organization: "national",
      region_scope: "kanto",
      range_start: 8,
      range_limit: 8,
    },
    pokemon,
    defs,
  );

  assert.deepEqual(
    ordered.map((p) => p.slug),
    ["0009-pokemon-9", "0010-pokemon-10"],
  );
});

test("orderPokemonForBinder handles null binder with national order", async () => {
  const api = await loadModule();
  const pokemon = [makePokemon(1)[0], makePokemon(1, "johto")[0]];
  pokemon[0].slug = "0002-pokemon-2";
  pokemon[0].number = "0002";
  pokemon[1].slug = "0001-pokemon-1";
  pokemon[1].number = "0001";

  const ordered = api.orderPokemonForBinder(null, pokemon, []);

  assert.deepEqual(
    ordered.map((p) => p.slug),
    ["0001-pokemon-1", "0002-pokemon-2"],
  );
});

test("orderPokemonForBinder delegates non-null binders to the layout engine", async () => {
  const api = await loadModule();
  const engine = globalThis.window.PokevaultBinderLayout;
  const original = engine.orderPokemonForBinder;
  const binder = { id: "x" };
  const pokemon = makePokemon(1);
  const defs = [];
  let received = null;

  try {
    engine.orderPokemonForBinder = (args) => {
      received = args;
      return [{ slug: "sentinel" }];
    };

    const ordered = api.orderPokemonForBinder(binder, pokemon, defs);

    assert.deepEqual(ordered, [{ slug: "sentinel" }]);
    assert.equal(received.binder, binder);
    assert.equal(received.pokemon, pokemon);
    assert.equal(received.defs, defs);
  } finally {
    engine.orderPokemonForBinder = original;
  }
});

test("regional family album pool keeps base and regional forms for layout", async () => {
  const api = await loadModule();
  api.setEvolutionFamilyData({
    families: [
      { id: "0019-rattata", layout_rows: [["0019-rattata", "0019-rattata-alola"]] },
    ],
  });
  const rule = api.formRuleFromScope("base_regional");
  const pokemon = [
    { slug: "0019-rattata", number: "0019", region: "kanto", names: { fr: "Rattata" } },
    { slug: "0019-rattata-alola", number: "0019", region: "alola", form: "Forme d'Alola", names: { fr: "Rattata d'Alola" } },
  ];
  const pool = api.selectBinderPokemonPool(pokemon, rule);
  const ordered = api.orderPokemonForBinder(
    {
      id: "grand",
      organization: "regional_family_album",
      rows: 2,
      cols: 2,
      sheet_count: 2,
    },
    pool,
    [
      { id: "kanto", low: 1, high: 151 },
      { id: "alola", low: 722, high: 807 },
    ],
  );

  assert.deepEqual(
    pool.map((p) => p.slug),
    ["0019-rattata", "0019-rattata-alola"],
  );
  assert.deepEqual(
    ordered.map((p) => p?.slug || null),
    ["0019-rattata", null, null, null, null, null, null, null, "0019-rattata-alola", null],
  );
});

test("default workspace is only created for empty configs", async () => {
  const api = await loadModule();

  assert.equal(api.shouldEnsureDefaultWorkspace({ binders: [] }), true);
  assert.equal(api.shouldEnsureDefaultWorkspace(null), true);
  assert.equal(
    api.shouldEnsureDefaultWorkspace({
      binders: [{ id: "custom", rows: 2, cols: 2, sheet_count: 1 }],
    }),
    false,
  );
});

test("family binder ordering pads evolution rows with intentional holes", async () => {
  const api = await loadModule();
  api.setEvolutionFamilyData({
    families: [
      {
        id: "0133-eevee",
        layout_rows: [
          ["0133-eevee", "0134-vaporeon"],
          [null, "0135-jolteon"],
        ],
      },
    ],
  });
  const pokemon = [
    { slug: "0133-eevee", number: "0133", names: { fr: "Evoli" } },
    { slug: "0134-vaporeon", number: "0134", names: { fr: "Aquali" } },
    { slug: "0135-jolteon", number: "0135", names: { fr: "Voltali" } },
  ];

  const ordered = api.orderPokemonForBinder(
    {
      organization: "family",
      cols: 3,
      rows: 1,
      sheet_count: 10,
    },
    pokemon,
    [],
  );

  assert.equal(Boolean(globalThis.window.PokevaultBinderLayout), true);
  assert.deepEqual(
    ordered.map((p) => p?.slug || null),
    ["0133-eevee", "0134-vaporeon", null, null, "0135-jolteon", null],
  );
});

test("family binder workspace splits on family blocks without dropping holes", async () => {
  const api = await loadModule();
  const families = {
    families: [
      { id: "f1", layout_rows: [["0001-a", "0002-b", "0003-c"]] },
      { id: "f2", layout_rows: [["0004-d", "0005-e", "0006-f"]] },
      { id: "f3", layout_rows: [["0007-g", "0008-h", "0009-i"]] },
    ],
  };
  const pokemon = [
    "0001-a",
    "0002-b",
    "0003-c",
    "0004-d",
    "0005-e",
    "0006-f",
    "0007-g",
    "0008-h",
    "0009-i",
  ].map((slug, idx) => ({
    slug,
    number: String(idx + 1).padStart(4, "0"),
  }));

  const result = api.buildFamilyBinderWorkspace(
    {
      name: "Familles",
      organization: "family",
      formScope: "base_only",
      rows: 1,
      cols: 3,
      sheetCount: 1,
    },
    pokemon,
    families,
    "test",
  );

  assert.deepEqual(
    result.configBody.binders.map((binder) => [binder.name, binder.range_start, binder.range_limit]),
    [
      ["Familles 1", 0, 6],
      ["Familles 2", 6, 3],
    ],
  );
});

test("family binder workspace counts page-aware gaps in binder ranges", async () => {
  const api = await loadModule();
  const families = {
    families: [
      { id: "f1", layout_rows: [["0001-a", "0002-b", "0003-c"]] },
      {
        id: "f2",
        layout_rows: [
          ["0004-d", "0005-e", "0006-f"],
          ["0007-g", "0008-h", "0009-i"],
        ],
      },
    ],
  };
  const pokemon = [
    "0001-a",
    "0002-b",
    "0003-c",
    "0004-d",
    "0005-e",
    "0006-f",
    "0007-g",
    "0008-h",
    "0009-i",
  ].map((slug, idx) => ({
    slug,
    number: String(idx + 1).padStart(4, "0"),
  }));

  const result = api.buildFamilyBinderWorkspace(
    {
      name: "Familles",
      organization: "family",
      formScope: "base_only",
      rows: 2,
      cols: 3,
      sheetCount: 1,
    },
    pokemon,
    families,
    "test",
  );

  assert.deepEqual(
    result.configBody.binders.map((binder) => [binder.range_start, binder.range_limit]),
    [[0, 12]],
  );

  api.setEvolutionFamilyData(families);
  const ordered = api.orderPokemonForBinder(result.configBody.binders[0], pokemon, []);

  assert.deepEqual(
    ordered.map((p) => p?.slug || null),
    [
      "0001-a",
      "0002-b",
      "0003-c",
      null,
      null,
      null,
      "0004-d",
      "0005-e",
      "0006-f",
      "0007-g",
      "0008-h",
      "0009-i",
    ],
  );
});

test("family binder workspace keeps alignment empties inside compact family blocks", async () => {
  const api = await loadModule();
  const families = {
    families: [
      { id: "f1", layout_rows: [["0001-a", "0002-b", "0003-c"]] },
      {
        id: "f2",
        layout_rows: [
          ["0004-d"],
          ["0005-e", "0006-f", "0007-g"],
        ],
      },
    ],
  };
  const pokemon = [
    "0001-a",
    "0002-b",
    "0003-c",
    "0004-d",
    "0005-e",
    "0006-f",
    "0007-g",
  ].map((slug, idx) => ({
    slug,
    number: String(idx + 1).padStart(4, "0"),
  }));

  const result = api.buildFamilyBinderWorkspace(
    {
      name: "Familles",
      organization: "family",
      formScope: "base_only",
      rows: 1,
      cols: 3,
      sheetCount: 1,
    },
    pokemon,
    families,
    "test",
  );

  assert.deepEqual(
    result.configBody.binders.map((binder) => [binder.name, binder.range_start, binder.range_limit]),
    [
      ["Familles 1", 0, 3],
      ["Familles 2", 3, 6],
    ],
  );
});

test("binder wizard form rule labels follow English i18n when available", async () => {
  const api = await loadModule();
  globalThis.PokevaultI18n = {
    t(key) {
      return {
        "binder_wizard.form.base_only.title": "Main base only",
        "binder_wizard.form.base_regional.title": "Base + regional forms",
        "binder_wizard.form.full.title": "Complete named forms",
      }[key] || key;
    },
  };

  assert.equal(api.formRuleFromScope("base_only").label, "Main base only");
  assert.equal(api.formRuleFromScope("base_regional").label, "Base + regional forms");
  assert.equal(api.formRuleFromScope("full").label, "Complete named forms");
});
