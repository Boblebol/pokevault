import assert from "node:assert/strict";
import { test } from "node:test";

const STORAGE_KEY = "pokevault.ui.profile";
let importCase = 0;
let onboardingApi = null;

function installBrowserStubs() {
  const storage = new Map();
  globalThis.__POKEVAULT_ONBOARDING_TESTS__ = true;
  globalThis.window = globalThis;
  delete globalThis.PokevaultOnboarding;
  delete globalThis.PokedexCollection;
  delete globalThis.PokevaultFilters;
  globalThis.localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };
  globalThis.location = { hash: "#/liste" };
  globalThis.history = {
    replaceState(_state, _title, next) {
      globalThis.location.hash = next;
    },
  };
  globalThis.document = {
    readyState: "loading",
    addEventListener() {},
    getElementById() {
      return null;
    },
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.dispatchEvent = () => true;
  return storage;
}

async function loadModule() {
  const storage = installBrowserStubs();
  if (!onboardingApi) {
    importCase += 1;
    await import(`../../web/onboarding.js?case=${Date.now()}-${importCase}`);
    onboardingApi = globalThis.window.PokevaultOnboarding._test;
  }
  return { api: onboardingApi, storage };
}

test("writeProfile persists Pokedex-first onboarding choices", async () => {
  const { api, storage } = await loadModule();

  const saved = api.writeProfile({
    goal: "complete_pokedex",
    favorite_region: "johto",
    tracking_mode: "advanced",
    skipped: false,
  });

  const raw = JSON.parse(storage.get(STORAGE_KEY));

  assert.equal(saved.version, 2);
  assert.equal(saved.goal, "complete_pokedex");
  assert.equal(saved.favorite_region, "johto");
  assert.equal(saved.tracking_mode, "advanced");
  assert.equal(saved.card_layer, "addon_later");
  assert.match(saved.completed_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(raw.profile, undefined);
  assert.equal(raw.goal, "complete_pokedex");
  assert.equal(raw.favorite_region, "johto");
});

test("readProfile migrates legacy collector profiles to the Pokedex-first shape", async () => {
  const { api, storage } = await loadModule();
  storage.set(STORAGE_KEY, JSON.stringify({
    version: 1,
    profile: "card",
    form_scope: "base_only",
    dim_mode: "missing",
    completed_at: "2026-04-26T12:00:00.000Z",
    skipped: false,
  }));

  const profile = api.readProfile();

  assert.deepEqual({
    version: profile.version,
    goal: profile.goal,
    favorite_region: profile.favorite_region,
    tracking_mode: profile.tracking_mode,
    card_layer: profile.card_layer,
    skipped: profile.skipped,
  }, {
    version: 2,
    goal: "complete_pokedex",
    favorite_region: "all",
    tracking_mode: "advanced",
    card_layer: "addon_later",
    skipped: false,
  });
});

test("applyPreferences guides the first collection view from region and mode", async () => {
  const { api, storage } = await loadModule();
  let dimMode = null;
  globalThis.PokedexCollection = {
    setDimMode(mode) {
      dimMode = mode;
    },
  };
  globalThis.PokevaultFilters = {
    buildFilterHash(current, filters) {
      assert.equal(current, "#/liste");
      assert.equal(filters.status, "all");
      assert.equal(filters.region, "kanto");
      assert.equal(filters.forms, "base_regional");
      assert.equal(filters.type, "all");
      return "#/liste?region=kanto&forms=base_regional";
    },
  };

  api.applyPreferences({
    goal: "complete_pokedex",
    favorite_region: "kanto",
    tracking_mode: "simple",
    card_layer: "addon_later",
  });

  assert.equal(storage.get("pokedexFormFilter"), "base_regional");
  assert.equal(storage.get("pokedexPreferredRegion"), "kanto");
  assert.equal(dimMode, "caught");
  assert.equal(globalThis.location.hash, "#/liste?region=kanto&forms=base_regional");
});

test("skipped onboarding stays dismissed until the user replays it", async () => {
  const { api } = await loadModule();

  assert.equal(api.shouldOpen(null), true);
  assert.equal(api.shouldOpen({ completed_at: "2026-04-26T12:00:00.000Z", skipped: false }), false);
  assert.equal(api.shouldOpen({ completed_at: null, skipped: true }), false);
});

test("settings profile summary follows English i18n labels", async () => {
  const { api } = await loadModule();
  globalThis.PokevaultI18n = {
    t(key, params = {}) {
      const messages = {
        "onboarding.profile.undefined": "Profile: undefined — replay onboarding to customize.",
        "onboarding.profile.summary": "Profile: Complete my Pokedex · {region} · {mode} · cards as add-on.",
        "onboarding.mode.simple": "simple mode",
        "onboarding.mode.advanced": "advanced mode",
      };
      return (messages[key] || key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name]));
    },
  };

  assert.equal(api.formatSettingsProfileLabel(null), "Profile: undefined — replay onboarding to customize.");
  assert.equal(
    api.formatSettingsProfileLabel({ favorite_region: "kanto", tracking_mode: "advanced", skipped: false }),
    "Profile: Complete my Pokedex · Kanto · advanced mode · cards as add-on.",
  );
});
