import assert from "node:assert/strict";
import { test } from "node:test";

async function loadModule() {
  globalThis.__POKEVAULT_PRINT_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById() {
      return null;
    },
  };
  await import(`../../web/print-view.js?case=${Date.now()}`);
  return globalThis.window.PokedexPrint._test;
}

test("print view formats English summary labels through i18n", async () => {
  const api = await loadModule();
  globalThis.PokevaultI18n = {
    t(key, params = {}) {
      const messages = {
        "print.summary.entries": "{count} entries",
        "print.subtitle.caught": "{caught}/{total} caught ({pct}%)",
        "print.footer": "pokevault · {date} · checked = caught · empty = missing",
      };
      return (messages[key] || key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name]));
    },
  };

  assert.equal(api.formatEntrySummary(12), "12 entries");
  assert.equal(api.formatPrintSubtitle(4, 10), "4/10 caught (40%)");
  assert.equal(api.formatPrintFooter("2026-05-02", false), "pokevault · 2026-05-02 · checked = caught · empty = missing");
});
