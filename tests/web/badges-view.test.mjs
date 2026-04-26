import assert from "node:assert/strict";
import { test } from "node:test";

function installBrowserStubs() {
  globalThis.__POKEVAULT_BADGES_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.document = {
    readyState: "loading",
    addEventListener() {},
    createElement() {
      return {
        append() {},
        replaceChildren() {},
        setAttribute() {},
        classList: { add() {} },
        style: { setProperty() {} },
      };
    },
  };
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/badges-view.js?case=${Date.now()}`);
  return globalThis.window.PokevaultBadges._test;
}

test("nearestBadge chooses the locked badge closest to completion", async () => {
  const api = await loadModule();
  const nearest = api.nearestBadge({
    catalog: [
      { id: "first_catch", title: "Premier", unlocked: true, current: 1, target: 1, percent: 100 },
      { id: "century", title: "Centenaire", unlocked: false, current: 42, target: 100, percent: 42 },
      { id: "shiny_ten", title: "Chasseur", unlocked: false, current: 8, target: 10, percent: 80 },
    ],
  });

  assert.equal(nearest.id, "shiny_ten");
});

test("nearestBadge uses the smallest remaining count as tie-breaker", async () => {
  const api = await loadModule();
  const nearest = api.nearestBadge({
    catalog: [
      { id: "hundred_cards", title: "Cartes", unlocked: false, current: 50, target: 100, percent: 50 },
      { id: "shiny_ten", title: "Shiny", unlocked: false, current: 5, target: 10, percent: 50 },
    ],
  });

  assert.equal(nearest.id, "shiny_ten");
});
