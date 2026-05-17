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
    cloneNode(deep) {
      const clone = makeInteractiveElement(this.tagName);
      clone.className = this.className;
      clone.value = this.value;
      clone.type = this.type;
      clone.name = this.name;
      clone.checked = this.checked;
      clone.dataset = { ...this.dataset };
      if (deep) {
        for (const child of this.children) {
          if (child && typeof child.cloneNode === "function") {
            clone.append(child.cloneNode(true));
          } else {
            clone.append(child);
          }
        }
      }
      return clone;
    },
    click() {
      this.listeners.click?.();
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const out = [];
      const visit = (node) => {
        if (!node || typeof node !== "object") return;
        
        let match = true;
        
        // Simple class selector support
        if (selector.startsWith(".")) {
          const classes = selector.split(".").filter(Boolean);
          const nodeClasses = String(node.className || "").split(/\s+/).filter(Boolean);
          if (!classes.every(cls => nodeClasses.includes(cls))) match = false;
        } else if (selector.includes("[")) {
          // Attribute selector support: input[name="..."][value="..."]
          const tagMatch = selector.match(/^([a-z0-9]+)/i);
          if (tagMatch && node.tagName.toLowerCase() !== tagMatch[1].toLowerCase()) {
            match = false;
          } else {
            const attrMatches = selector.matchAll(/\[([a-z0-9_-]+)=["']?([^"']+)["']?\]/gi);
            for (const am of attrMatches) {
              const attr = am[1];
              const val = am[2];
              if (node[attr] !== val && node.dataset?.[attr] !== val) {
                match = false;
                break;
              }
            }
            if (match && selector.includes(":checked") && !node.checked) {
              match = false;
            }
          }
        } else {
          // Tag name only
          if (node.tagName.toLowerCase() !== selector.toLowerCase()) match = false;
        }

        if (match) out.push(node);
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
  const wrap = makeInteractiveElement("div");
  wrap.id = "binderWizardWrap";
  const settingsView = makeInteractiveElement("div");
  settingsView.id = "viewSettings";
  const statsMain = makeInteractiveElement("section");
  statsMain.className = "stats-main";
  settingsView.append(statsMain);
  settingsView.append(wrap);
  wrap.append(body);

  const template = makeInteractiveElement("div");
  template.id = "binderWizardOrgTemplates";
  const questions = makeInteractiveElement("div");
  questions.className = "wizard-org-questions";
  
  const mkRadio = (name, value) => {
    const el = makeInteractiveElement("input");
    el.type = "radio";
    el.name = name;
    el.value = value;
    return el;
  };

  questions.append(
    mkRadio("wizard_binder_type", "infinite"),
    mkRadio("wizard_binder_type", "finite_10"),
    mkRadio("wizard_binder_region_sep", "yes"),
    mkRadio("wizard_binder_region_sep", "no"),
    mkRadio("wizard_binder_family_group", "aligned"),
    mkRadio("wizard_binder_family_group", "compact")
  );
  template.append(questions);

  globalThis.document = {
    createElement: makeInteractiveElement,
    getElementById(id) {
      if (id === "binderWizardBody") return body;
      if (id === "binderWizardWrap") return wrap;
      if (id === "binderWizardOrgTemplates") return template;
      if (id === "viewSettings") return settingsView;
      return null;
    },
    querySelector(selector) {
      if (selector === "#viewSettings .stats-main") return statsMain;
      return body.querySelector(selector) || template.querySelector(selector) || settingsView.querySelector(selector);
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
          binder_type: "infinite",
          binder_region_sep: "yes",
          binder_family_group: "aligned",
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

  assert.equal(draft.binder_type, "infinite");
  assert.equal(draft.binder_region_sep, "yes");
  assert.equal(draft.binder_family_group, "aligned");
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
          binder_type: "finite_10",
          binder_region_sep: "no",
          binder_family_group: "compact",
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

  assert.equal(ordinaryThreeByThree.binder_region_sep, "no");
  assert.notEqual(ordinaryThreeByThree.formatPreset, "large-ring-3x3");
});

test("wizard draft prefill handles the new 3-option flags", async () => {
  const api = await loadModule();
  const draft = api.draftFromConfigForTest(
    {
      binders: [
        {
          id: "b1",
          binder_type: "infinite",
          binder_region_sep: "yes",
          binder_family_group: "aligned",
          organization: "regional_family_album",
          rows: 3,
          cols: 3,
          sheet_count: 10,
        },
      ],
      form_rules: [],
    },
    "b1",
  );

  assert.equal(draft.binder_type, "infinite");
  assert.equal(draft.binder_region_sep, "yes");
  assert.equal(draft.binder_family_group, "aligned");
});

test("wizard exposes large ring option and summary copy", async () => {
  const api = await loadModule();

  let body = installInteractiveWizardDom();
  api.renderWizardStepForTest(0, {
    binder_type: "finite_10",
    binder_region_sep: "no",
    binder_family_group: "compact",
    formScope: "base_regional",
    formatPreset: "custom",
    rows: 4,
    cols: 4,
    sheetCount: 12,
  });
  
  const typeInf = body.querySelector('input[name="wizard_binder_type"][value="infinite"]');
  const sepYes = body.querySelector('input[name="wizard_binder_region_sep"][value="yes"]');
  const groupAligned = body.querySelector('input[name="wizard_binder_family_group"][value="aligned"]');

  assert.ok(typeInf);
  assert.ok(sepYes);
  assert.ok(groupAligned);

  typeInf.checked = true;
  sepYes.checked = true;
  groupAligned.checked = true;

  // The draft isn't updated until validation (on Next)
  // But for the test we can just set the draft directly or mock the validation call
  api.renderWizardStepForTest(1, {
    binder_type: "infinite",
    binder_region_sep: "yes",
    binder_family_group: "aligned",
  });

  const largeRingForms = body.querySelectorAll(".wizard-form-card");
  assert.deepEqual(largeRingForms.map((el) => el.dataset.formScope), ["base_regional"]);
  assert.doesNotMatch(body.textContent, /Base seule/);

  body = installInteractiveWizardDom();
  api.renderWizardStepForTest(2, {
    binder_type: "infinite",
    binder_region_sep: "yes",
    binder_family_group: "aligned",
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

test("wizard edit payload preserves regional family album organization", async () => {
  const api = await loadModule();
  const result = api.buildPersistEditPayloads(
    {
      editBinderId: "grand",
      name: "Grand",
      binder_type: "infinite",
      binder_region_sep: "yes",
      binder_family_group: "aligned",
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
          binder_type: "infinite",
          binder_region_sep: "yes",
          binder_family_group: "aligned",
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
      binder_type: "infinite",
      binder_region_sep: "yes",
      binder_family_group: "aligned",
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
          binder_type: "finite_10",
          binder_region_sep: "no",
          binder_family_group: "compact",
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
          binder_type: "infinite",
          binder_region_sep: "yes",
          binder_family_group: "aligned",
          formScope: "base_regional",
          rows: 3,
          cols: 3,
          sheetCount: 1,
        },
        {
          version: 1,
          convention: "sheet_recto_verso",
          binders: [{ id: "grand", organization: "regional_family_album", binder_type: "infinite", binder_region_sep: "yes", binder_family_group: "aligned", sheet_count: 1 }],
          form_rules: [api.formRuleFromScope("base_regional")],
        },
        { version: 1, by_binder: { grand: {} } },
      ),
    /large-ring-pokedex-data-unavailable/,
  );
});

test("wizard org selection preserves hidden regional family album edit drafts", async () => {
  const api = await loadModule();
  installInteractiveWizardDom();
  const draft = {
    editBinderId: "grand",
    binder_type: "infinite",
    binder_region_sep: "yes",
    binder_family_group: "aligned",
  };

  const selected = api.readOrgSelectionForDraftForTest(draft);
  assert.equal(selected.type, "infinite");
  assert.equal(selected.sep, "yes");
  assert.equal(selected.group, "aligned");
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
      binder_type: "infinite",
      binder_region_sep: "yes",
      binder_family_group: "aligned",
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

test("buildLargeRingBinderWorkspace creates national-org binder when draft.binder_region_sep is no", async () => {
  const api = await loadModule();
  const draft = {
    name: "Mon classeur",
    binder_type: "infinite",
    binder_region_sep: "no",
    binder_family_group: "compact",
    formScope: "base_regional",
    rows: 3,
    cols: 3,
    sheetCount: 10,
  };
  const defs = [{ id: "kanto", low: 1, high: 151 }];
  const pokemon = [{ slug: "0001-bulbasaur", number: "#0001" }];
  const familyData = { families: [] };

  const result = api.buildLargeRingBinderWorkspace(draft, defs, pokemon, familyData, "test");
  const binder = result.configBody.binders[0];

  assert.equal(binder.organization, "national");
  assert.equal(binder.cols, 3);
  assert.equal(binder.rows, 3);
  assert.equal("layout_options" in binder, false, "national org must not carry layout_options");
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
    binder_type: "infinite",
    binder_region_sep: "yes",
    binder_family_group: "aligned",
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
        binder_type: "infinite",
        binder_region_sep: "yes",
        binder_family_group: "aligned",
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
        binder_type: "infinite",
        binder_region_sep: "yes",
        binder_family_group: "aligned",
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
      binder_type: "infinite",
      binder_region_sep: "yes",
      binder_family_group: "aligned",
      formScope: "base_regional",
      rows: 3,
      cols: 3,
      sheetCount: 1,
    });

    assert.equal(ok, false);
    assert.equal(hint.hidden, false);
    assert.match(hint.textContent, /familles d[’']évolution/);
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
      binder_type: "infinite",
      binder_region_sep: "yes",
      binder_family_group: "aligned",
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
      binder_type: "finite_10",
      binder_region_sep: "yes",
      binder_family_group: "compact",
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
      binder_type: "finite_10",
      binder_region_sep: "yes",
      binder_family_group: "compact",
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
      binder_type: "infinite",
      binder_region_sep: "yes",
      binder_family_group: "aligned",
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
    [
      "0019-rattata",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "0019-rattata-alola",
      null,
      null,
    ],
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
});
