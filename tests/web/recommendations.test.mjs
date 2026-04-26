import assert from "node:assert/strict";
import { test } from "node:test";

function installBrowserStubs() {
  globalThis.__POKEVAULT_RECOMMENDATIONS_TESTS__ = true;
  globalThis.window = globalThis;
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/recommendations.js?case=${Date.now()}`);
  return globalThis.window.PokevaultRecommendations._test;
}

test("rankTargets chooses the closest completable region", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "001-a", number: "#001", region: "kanto", names: { fr: "A" } },
    { slug: "002-b", number: "#002", region: "kanto", names: { fr: "B" } },
    { slug: "003-c", number: "#003", region: "kanto", names: { fr: "C" } },
    { slug: "152-d", number: "#152", region: "johto", names: { fr: "D" } },
    { slug: "153-e", number: "#153", region: "johto", names: { fr: "E" } },
    { slug: "154-f", number: "#154", region: "johto", names: { fr: "F" } },
  ];
  const caughtMap = {
    "001-a": true,
    "152-d": true,
    "153-e": true,
  };
  const regions = [
    { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
    { id: "johto", label_fr: "Johto", low: 152, high: 251 },
  ];

  const result = api.rankTargets({ pool, caughtMap, regionDefinitions: regions, limit: 6 });

  assert.equal(result.targetRegionId, "johto");
  assert.equal(result.targetRegion, "Johto");
  assert.deepEqual(result.rows.map((p) => p.slug), ["154-f"]);
  assert.match(result.reason, /Johto/);
  assert.match(result.reason, /proche/);
});

test("rankTargets sorts seen-but-not-caught targets before never-seen targets", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "001-a", number: "#001", region: "kanto", names: { fr: "A" } },
    { slug: "002-b", number: "#002", region: "kanto", names: { fr: "B" } },
    { slug: "003-c", number: "#003", region: "kanto", names: { fr: "C" } },
  ];
  const statusMap = {
    "003-c": { state: "seen", shiny: false },
  };

  const result = api.rankTargets({ pool, caughtMap: {}, statusMap, regionDefinitions: [], limit: 3 });

  assert.deepEqual(result.rows.map((p) => p.slug), ["003-c", "001-a", "002-b"]);
  assert.match(result.reason, /apercu/);
});
