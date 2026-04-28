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

test("rankTargets promotes high-priority hunt targets", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "001-a", number: "#001", region: "kanto", names: { fr: "A" } },
    { slug: "002-b", number: "#002", region: "kanto", names: { fr: "B" } },
    { slug: "003-c", number: "#003", region: "kanto", names: { fr: "C" } },
  ];
  const statusMap = {
    "001-a": { state: "seen", shiny: false },
  };
  const huntMap = {
    "003-c": { wanted: true, priority: "high", note: "" },
  };

  const result = api.rankTargets({ pool, caughtMap: {}, statusMap, huntMap, regionDefinitions: [], limit: 3 });

  assert.deepEqual(result.rows.map((p) => p.slug), ["003-c", "001-a", "002-b"]);
  assert.match(result.reason, /recherche prioritaire/);
});

test("buildNextActions ranks seen targets before active-region misses", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "001-a", number: "#001", region: "kanto", names: { fr: "A" } },
    { slug: "002-b", number: "#002", region: "kanto", names: { fr: "B" } },
    { slug: "003-c", number: "#003", region: "kanto", names: { fr: "C" } },
    { slug: "152-d", number: "#152", region: "johto", names: { fr: "D" } },
    { slug: "153-e", number: "#153", region: "johto", names: { fr: "E" } },
  ];
  const caughtMap = {
    "001-a": true,
    "153-e": true,
  };
  const statusMap = {
    "003-c": { state: "seen", shiny: false },
  };
  const regions = [
    { id: "kanto", label_fr: "Kanto", low: 1, high: 151 },
    { id: "johto", label_fr: "Johto", low: 152, high: 251 },
  ];

  const actions = api.buildNextActions({
    pool,
    caughtMap,
    statusMap,
    regionDefinitions: regions,
    activeRegionId: "johto",
    limit: 3,
  });

  assert.deepEqual(actions.map((action) => action.slug), ["003-c", "152-d", "002-b"]);
  assert.equal(actions[0].kind, "seen");
  assert.match(actions[0].reason, /Vu/);
  assert.equal(actions[1].kind, "active_region");
  assert.match(actions[1].reason, /Johto/);
});

test("buildNextActions keeps stable tie-breakers for equal candidates", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "025-z", number: "#025", region: "kanto", names: { fr: "Z" } },
    { slug: "025-a", number: "#025", region: "kanto", names: { fr: "A" } },
    { slug: "024-b", number: "#024", region: "kanto", names: { fr: "B" } },
  ];

  const actions = api.buildNextActions({
    pool,
    regionDefinitions: [{ id: "kanto", label_fr: "Kanto", low: 1, high: 151 }],
    limit: 3,
  });

  assert.deepEqual(actions.map((action) => action.slug), ["024-b", "025-a", "025-z"]);
});

test("buildNextActions does not promote Pokemon because a card exists", async () => {
  const api = await loadModule();
  const pool = [
    { slug: "001-card-owned", number: "#001", region: "kanto", names: { fr: "Carte" } },
    { slug: "002-seen", number: "#002", region: "kanto", names: { fr: "Vu" } },
  ];
  const statusMap = {
    "002-seen": { state: "seen", shiny: false },
  };

  const actions = api.buildNextActions({
    pool,
    statusMap,
    cardMap: { "001-card-owned": [{ id: "card-1" }] },
    limit: 2,
  });

  assert.deepEqual(actions.map((action) => action.slug), ["002-seen", "001-card-owned"]);
  assert.notEqual(actions[0].slug, "001-card-owned");
});
