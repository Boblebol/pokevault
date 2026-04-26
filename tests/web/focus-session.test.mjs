import assert from "node:assert/strict";
import { test } from "node:test";

function installBrowserStubs() {
  const storage = new Map();
  globalThis.__POKEVAULT_FOCUS_TESTS__ = true;
  globalThis.window = globalThis;
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
  globalThis.document = {
    readyState: "complete",
    addEventListener() {},
    getElementById() {
      return null;
    },
    createElement() {
      return {
        append() {},
        appendChild() {},
        addEventListener() {},
        setAttribute() {},
        classList: { add() {}, remove() {}, toggle() {} },
        dataset: {},
        style: { setProperty() {} },
      };
    },
  };
  globalThis.location = { hash: "#/stats" };
  globalThis.history = { replaceState() {} };
  return storage;
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/recommendations.js?case=${Date.now()}`);
  await import(`../../web/focus-session.js?case=${Date.now()}`);
  return globalThis.window.PokevaultFocus._test;
}

test("buildSessionPlan picks the closest completable region", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "001-a", number: "#001", region: "kanto", names: { fr: "A" } },
    { slug: "002-b", number: "#002", region: "kanto", names: { fr: "B" } },
    { slug: "152-c", number: "#152", region: "johto", names: { fr: "C" } },
    { slug: "153-d", number: "#153", region: "johto", names: { fr: "D" } },
    { slug: "154-e", number: "#154", region: "johto", names: { fr: "E" } },
  ];
  const caught = { "001-a": true, "152-c": true, "153-d": true };
  const regions = [
    { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
    { id: "johto", label_fr: "Johto", low: 152, high: 251 },
  ];

  const plan = api.buildSessionPlan(pool, caught, regions);

  assert.equal(plan.targetRegion, "johto");
  assert.equal(plan.targetLabel, "Johto");
  assert.deepEqual(plan.slugs, ["154-e"]);
  assert.match(plan.reason, /proche/);
});

test("syncSessionCompletion keeps only caught targets as completed", async () => {
  const api = await loadModule();
  const session = {
    version: 1,
    startedAt: "2026-04-26T12:00:00.000Z",
    targetRegion: "kanto",
    targetLabel: "Kanto",
    reason: "Kanto est proche.",
    slugs: ["001-a", "002-b", "003-c"],
    completed: ["003-c"],
  };

  const next = api.syncSessionCompletion(session, { "001-a": true, "003-c": false });

  assert.deepEqual(next.completed, ["001-a"]);
  assert.equal(next.done, 1);
  assert.equal(next.total, 3);
});
