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

test("shouldDimCardForHighlight dims doubles as captured cards", async () => {
  const api = await loadModule();

  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: true, duplicate: false }),
    true,
  );
  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: true, duplicate: true }),
    true,
  );
  assert.equal(
    api.shouldDimCardForHighlight("caught", { caught: false, duplicate: false }),
    false,
  );
  assert.equal(
    api.shouldDimCardForHighlight("missing", { caught: false, duplicate: false }),
    true,
  );
  assert.equal(
    api.shouldDimCardForHighlight("missing", { caught: true, duplicate: true }),
    false,
  );
});

test("backup import accepts schema versions emitted by the backend", async () => {
  const api = await loadModule();

  assert.equal(api.isSupportedBackupSchemaVersion(1), true);
  assert.equal(api.isSupportedBackupSchemaVersion(2), true);
  assert.equal(api.isSupportedBackupSchemaVersion(3), true);
  assert.equal(api.isSupportedBackupSchemaVersion(99), false);
});
