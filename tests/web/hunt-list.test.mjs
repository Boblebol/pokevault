import assert from "node:assert/strict";
import { test } from "node:test";

function installBrowserStubs() {
  globalThis.__POKEVAULT_HUNTS_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.document = {
    addEventListener() {},
    dispatchEvent() {},
  };
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/hunt-list.js?case=${Date.now()}`);
  return globalThis.window.PokevaultHunts._test;
}

test("normalizeState keeps only wanted hunt entries", async () => {
  const api = await loadModule();
  const state = api.normalizeState({
    hunts: {
      "0025-pikachu": { wanted: true, priority: "high", note: "Holo" },
      "0001-bulbasaur": { wanted: false, priority: "normal", note: "" },
      "bad": "x",
    },
  });

  assert.deepEqual(Object.keys(state.hunts), ["0025-pikachu"]);
  assert.equal(state.hunts["0025-pikachu"].priority, "high");
  assert.equal(state.hunts["0025-pikachu"].note, "Holo");
});

