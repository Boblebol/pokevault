import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;
let currentLocale = "fr";

async function loadModule(locale = "fr") {
  currentLocale = locale;
  globalThis.window = globalThis;
  globalThis.PokevaultI18n = {
    getLocale() {
      return currentLocale;
    },
  };
  if (!globalThis.window.PokevaultEmptyStates) {
    importCase += 1;
    await import(`../../web/empty-states.js?case=${Date.now()}-${importCase}`);
  }
  return globalThis.window.PokevaultEmptyStates;
}

test("empty state copy follows the active locale with French fallback", async () => {
  const fr = await loadModule("fr");

  assert.equal(fr.get("listNoMatch").title, "Aucun Pokémon ne répond à cet appel.");

  const en = await loadModule("en");

  assert.equal(en.get("listNoMatch").title, "No Pokemon answers that call.");
  assert.equal(en.get("unknown").title, "Nothing to show here.");
});
