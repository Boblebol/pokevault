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
