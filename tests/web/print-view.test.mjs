import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

function createFakeElement(tagName = "div") {
  const el = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    className: "",
    dataset: {},
    style: {
      props: {},
      setProperty(name, value) {
        this.props[name] = value;
      },
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
    addEventListener() {},
  };
  el.classList = {
    add(...classes) {
      const current = new Set(el.className.split(/\s+/).filter(Boolean));
      for (const cls of classes) current.add(cls);
      el.className = [...current].join(" ");
    },
  };
  return el;
}

function createFakeDocument() {
  return {
    addEventListener() {},
    createElement: createFakeElement,
    createDocumentFragment: () => createFakeElement("#fragment"),
    getElementById() {
      return null;
    },
  };
}

async function loadModule({ resetArtwork = true } = {}) {
  globalThis.__POKEVAULT_PRINT_TESTS__ = true;
  globalThis.window = globalThis;
  if (resetArtwork) delete globalThis.PokevaultArtwork;
  delete globalThis.PokevaultI18n;
  globalThis.document = createFakeDocument();
  importCase += 1;
  await import(`../../web/print-view.js?case=${Date.now()}-${importCase}`);
  return globalThis.window.PokedexPrint._test;
}

function bulbasaur() {
  return {
    slug: "0001-bulbasaur",
    number: "0001",
    image: "data/images/0001-bulbasaur.png",
    names: { fr: "Bulbizarre", en: "Bulbasaur" },
  };
}

function placeholderSlots(pokemon = bulbasaur()) {
  return [
    {
      binderId: "kanto",
      binderName: "Kanto",
      page: 1,
      sheet: 1,
      face: "R",
      slot: 1,
      row: 1,
      col: 1,
      pokemon,
      emptyKind: null,
      familyId: "0001-bulbasaur",
    },
    {
      binderId: "kanto",
      binderName: "Kanto",
      page: 1,
      sheet: 1,
      face: "R",
      slot: 2,
      row: 1,
      col: 2,
      pokemon: null,
      emptyKind: "family_reserved",
      familyId: "0001-bulbasaur",
    },
  ];
}

test("print view formats English summary labels through i18n", async () => {
  const api = await loadModule();
  globalThis.PokevaultI18n = {
    t(key, params = {}) {
      const messages = {
        "print.summary.entries": "{count} entries",
        "print.subtitle.caught": "{caught}/{total} caught ({pct}%)",
        "print.footer": "pokevault · {date} · checked = caught · empty = missing",
      };
      return (messages[key] || key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name]));
    },
  };

  assert.equal(api.formatEntrySummary(12), "12 entries");
  assert.equal(api.formatPrintSubtitle(4, 10), "4/10 caught (40%)");
  assert.equal(api.formatPrintFooter("2026-05-02", false), "pokevault · 2026-05-02 · checked = caught · empty = missing");
});

test("placeholder section keeps pokemon and family reserved slots", async () => {
  const api = await loadModule();
  const pokemon = bulbasaur();

  const section = api.buildPlaceholderSection(
    { id: "kanto", name: "Kanto", rows: 1, cols: 2 },
    placeholderSlots(pokemon),
    {},
    "all",
    "",
  );

  assert.equal(section.pages.length, 1);
  assert.equal(section.pages[0].slots[0].title, "Bulbizarre");
  assert.equal(section.pages[0].slots[0].subtitle, "Bulbasaur");
  assert.equal(section.pages[0].slots[1].emptyKind, "family_reserved");
});

test("placeholder section drops reserved-only pages after a search miss", async () => {
  const api = await loadModule();

  const section = api.buildPlaceholderSection(
    { id: "kanto", name: "Kanto", rows: 1, cols: 2 },
    placeholderSlots(),
    {},
    "all",
    "missingno",
  );

  assert.equal(section.pages.length, 0);
});

test("placeholder section keeps reserved slots on pages with a search match", async () => {
  const api = await loadModule();

  const section = api.buildPlaceholderSection(
    { id: "kanto", name: "Kanto", rows: 1, cols: 2 },
    placeholderSlots(),
    {},
    "all",
    "bulba",
  );

  assert.equal(section.pages.length, 1);
  assert.deepEqual(
    section.pages[0].slots.map((slot) => slot.emptyKind),
    [null, "family_reserved"],
  );
});

test("print artwork default mode ignores the global artwork resolver", async () => {
  const api = await loadModule();
  globalThis.PokevaultArtwork = {
    mode: "shiny",
    resolve() {
      return { src: "/global-mode-image.png", fallbacks: [] };
    },
  };

  api.setPrintArtworkMode("default");
  const resolved = api.resolvePrintArtwork(bulbasaur());

  assert.deepEqual(resolved, {
    src: "/data/images/0001-bulbasaur.png",
    fallbacks: [],
  });
});

test("print artwork shiny mode builds a local and CDN fallback chain", async () => {
  const api = await loadModule();
  globalThis.PokevaultArtwork = {
    mode: "default",
    resolve() {
      return { src: "/global-mode-image.png", fallbacks: [] };
    },
  };

  api.setPrintArtworkMode("shiny");
  const resolved = api.resolvePrintArtwork(bulbasaur());

  assert.deepEqual(resolved, {
    src: "/data/images_shiny/0001-bulbasaur.png",
    fallbacks: [
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/1.png",
      "/data/images/0001-bulbasaur.png",
    ],
  });
});

test("placeholder card images load eagerly for print", async () => {
  const api = await loadModule();
  api.setPrintArtworkMode("default");

  const card = api.buildPlaceholderCardElement({
    ...placeholderSlots()[0],
    title: "Bulbizarre",
    subtitle: "Bulbasaur",
    number: "#1",
    status: "Missing",
    caught: false,
  });
  const img = card.children.find((child) => child.tagName === "IMG");

  assert.equal(img.loading, "eager");
  assert.equal(img.decoding, "sync");
});

test("placeholder card omits image when artwork resolution has no source", async () => {
  const api = await loadModule();
  api.setPrintArtworkMode("default");
  const pokemon = {
    ...bulbasaur(),
    image: "",
  };

  const card = api.buildPlaceholderCardElement({
    ...placeholderSlots(pokemon)[0],
    title: "Bulbizarre",
    subtitle: "Bulbasaur",
    number: "#1",
    status: "Missing",
    caught: false,
  });

  assert.equal(card.children.some((child) => child.tagName === "IMG"), false);
});

test("print card artwork mode uses real artwork-switcher card thumbnails without changing global mode", async () => {
  globalThis.window = globalThis;
  globalThis.document = createFakeDocument();
  const storage = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return storage.get(key) || null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };
  globalThis.fetch = async (url) => {
    assert.equal(url, "/api/cards");
    return {
      ok: true,
      async json() {
        return { cards: [{ pokemon_slug: "0001-bulbasaur", image_url: "/cards/bulba.png" }] };
      },
    };
  };

  importCase += 1;
  await import(`../../web/artwork-switcher.js?case=${Date.now()}-${importCase}`);
  await globalThis.PokevaultArtwork.refreshCards();
  globalThis.PokevaultArtwork.setMode("default");

  const api = await loadModule({ resetArtwork: false });
  api.setPrintArtworkMode("card");
  const resolved = api.resolvePrintArtwork(bulbasaur());

  assert.equal(globalThis.PokevaultArtwork.mode, "default");
  assert.equal(resolved.src, "/cards/bulba.png");
  assert.deepEqual(resolved.fallbacks, ["/data/images/0001-bulbasaur.png"]);
});
