import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

function installBrowserStubs() {
  globalThis.__POKEVAULT_APP_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.location = { hash: "#/settings" };
  globalThis.history = { replaceState() {} };
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  globalThis.document = {
    title: "",
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
  };
  globalThis.addEventListener = () => {};
}

async function loadModule() {
  installBrowserStubs();
  importCase += 1;
  await import(`../../web/app.js?case=${Date.now()}-${importCase}`);
  return globalThis.window.PokedexCollection._test;
}

test("shouldDimCardForHighlight keeps tradeable doubles visible", async () => {
  const api = await loadModule();

  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: true, duplicate: false }),
    true,
  );
  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: true, duplicate: true }),
    false,
  );
  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: false, duplicate: true }),
    false,
  );
  assert.equal(
    api.shouldDimCardForHighlight("missing", { caught: false, duplicate: false }),
    true,
  );
});
