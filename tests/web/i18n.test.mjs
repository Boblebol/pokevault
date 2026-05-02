import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    if (force) {
      this.values.add(name);
    } else {
      this.values.delete(name);
    }
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(attrs = {}) {
    this.attrs = { ...attrs };
    this.textContent = "";
    this.value = "";
    this.classList = new FakeClassList();
  }

  getAttribute(name) {
    return this.attrs[name] || "";
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  addEventListener(type, handler) {
    this.handler = { type, handler };
  }
}

function installBrowserStubs(initialStorage = {}) {
  const storage = new Map(Object.entries(initialStorage));
  const textNode = new FakeElement({ "data-i18n": "app.nav.settings" });
  const placeholderNode = new FakeElement({ "data-i18n-placeholder": "app.search.placeholder" });
  const ariaNode = new FakeElement({ "data-i18n-aria-label": "app.nav.main" });
  const frButton = new FakeElement({ "data-i18n-locale": "fr" });
  const enButton = new FakeElement({ "data-i18n-locale": "en" });

  globalThis.window = globalThis;
  globalThis.localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
  };
  globalThis.document = {
    readyState: "loading",
    documentElement: { lang: "" },
    addEventListener() {},
    querySelectorAll(selector) {
      if (selector === "[data-i18n]") return [textNode];
      if (selector === "[data-i18n-placeholder]") return [placeholderNode];
      if (selector === "[data-i18n-aria-label]") return [ariaNode];
      if (selector === "[data-i18n-locale]") return [frButton, enButton];
      return [];
    },
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.dispatchEvent = () => true;
  return { storage, textNode, placeholderNode, ariaNode, frButton, enButton };
}

async function loadI18n(initialStorage) {
  const stubs = installBrowserStubs(initialStorage);
  if (!globalThis.window.PokevaultI18n) {
    importCase += 1;
    await import(`../../web/i18n.js?case=${Date.now()}-${importCase}`);
  }
  return { api: globalThis.window.PokevaultI18n, ...stubs };
}

test("defaults to French and falls back to French for missing English keys", async () => {
  const { api } = await loadI18n();

  assert.equal(api.getLocale(), "fr");
  assert.equal(api.t("app.nav.settings"), "Réglages");
  assert.equal(api.t("missing.key"), "missing.key");
  assert.equal(api.t("app.nav.settings", {}, "en"), "Settings");
});

test("persists English locale, interpolates values and hydrates DOM attributes", async () => {
  const { api, storage, textNode, placeholderNode, ariaNode, frButton, enButton } = await loadI18n({
    pokevault_locale: "en",
  });

  api.applyTranslations();

  assert.equal(api.getLocale(), "en");
  assert.equal(globalThis.document.documentElement.lang, "en");
  assert.equal(textNode.textContent, "Settings");
  assert.equal(placeholderNode.getAttribute("placeholder"), "Search by name or number...");
  assert.equal(ariaNode.getAttribute("aria-label"), "Main navigation");
  assert.equal(frButton.getAttribute("aria-pressed"), "false");
  assert.equal(enButton.getAttribute("aria-pressed"), "true");
  assert.equal(enButton.classList.contains("is-active"), true);
  assert.equal(api.t("app.sync.pending", { count: 3 }), "3 change(s) waiting to sync...");

  api.setLocale("fr");

  assert.equal(storage.get("pokevault_locale"), "fr");
  assert.equal(textNode.textContent, "Réglages");
});
