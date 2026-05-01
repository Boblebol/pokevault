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
