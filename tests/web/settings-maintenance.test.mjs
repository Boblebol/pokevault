import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.events = {};
    this.style = {};
    this.value = "";
  }

  append(...nodes) {
    this.children.push(...nodes.filter(Boolean));
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  addEventListener(type, handler) {
    this.events[type] = handler;
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }
}

function installBrowserStubs(hash = "#/docs") {
  const elements = new Map();
  const ids = [
    "settingsDimSelect",
    "settingsMaintenanceStatus",
    "settingsMaintenanceHint",
    "settingsMaintenanceRefreshBtn",
    "settingsDataResetBtn",
  ];
  for (const id of ids) elements.set(id, new FakeElement(id));

  globalThis.__POKEVAULT_APP_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.location = { hash, reload() {} };
  globalThis.history = { replaceState() {} };
  globalThis.document = {
    title: "",
    body: new FakeElement("body"),
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
  };
  globalThis.addEventListener = () => {};
  globalThis.setTimeout = (handler) => {
    if (typeof handler === "function") handler();
    return 0;
  };
  globalThis.localStorage = {
    removed: [],
    getItem() {
      return null;
    },
    setItem() {},
    removeItem(key) {
      this.removed.push(key);
    },
  };
  return elements;
}

async function loadModule(hash) {
  const elements = installBrowserStubs(hash);
  importCase += 1;
  await import(`../../web/app.js?case=${Date.now()}-${importCase}`);
  return { elements, api: globalThis.window.PokedexCollection._test };
}

test("settings maintenance actions refresh references and reset local data", async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options.method || "GET"]);
    if (url === "/api/data/status") {
      return {
        ok: true,
        json: async () => ({
          files: [
            { name: "pokedex.json", kind: "reference", present: true },
            { name: "collection-progress.json", kind: "local_state", present: true },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({ ok: true, changed: ["pokedex.json"] }),
    };
  };
  globalThis.confirm = () => true;
  let reloaded = false;

  const { elements, api } = await loadModule();
  globalThis.location.reload = () => {
    reloaded = true;
  };
  await api.setupSettingsMaintenanceActions();

  assert.match(elements.get("settingsMaintenanceStatus").textContent, /1 référence/);
  assert.match(elements.get("settingsMaintenanceStatus").textContent, /1 donnée locale/);

  await elements.get("settingsMaintenanceRefreshBtn").events.click();
  await elements.get("settingsDataResetBtn").events.click();

  assert.deepEqual(calls.map((call) => call[0]), [
    "/api/data/status",
    "/api/data/refresh",
    "/api/data/status",
    "/api/data/reset-local",
  ]);
  assert.ok(globalThis.localStorage.removed.includes("pokedexDimMode"));
  assert.equal(reloaded, true);
});

test("settings route wires maintenance without visiting the collection first", async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push([url, options.method || "GET"]);
    if (url === "/api/health") {
      return { ok: true, json: async () => ({ api_version: "1.7.0" }) };
    }
    return {
      ok: true,
      json: async () => ({
        files: [{ name: "pokedex.json", kind: "reference", present: true }],
      }),
    };
  };

  const { elements } = await loadModule("#/settings");
  globalThis.window.applyPokedexAppRoute();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(elements.get("settingsMaintenanceRefreshBtn").dataset.wired, "1");
  assert.match(elements.get("settingsMaintenanceStatus").textContent, /1 référence/);
  assert.ok(calls.some((call) => call[0] === "/api/data/status"));
});
