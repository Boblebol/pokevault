import assert from "node:assert/strict";
import { test } from "node:test";

async function loadModule() {
  globalThis.__POKEVAULT_BINDER_SHELL_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById() {
      return null;
    },
  };
  await import(`../../web/binder-collection-view.js?case=${Date.now()}`);
  return globalThis.window.PokedexBinderShell._test;
}

test("binder shell formats physical binder labels through i18n", async () => {
  const api = await loadModule();
  globalThis.PokevaultI18n = {
    t(key, params = {}) {
      const messages = {
        "binder_shell.format": "Format {rows}×{cols} · {sheets} sheets · {capacity} slots.",
        "binder_shell.face.recto": "Front",
        "binder_shell.face.verso": "Back",
        "binder_shell.page_label": "Page {page} (sheet {sheet}/{sheets} {face})",
      };
      return (messages[key] || key).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(params[name]));
    },
  };

  assert.equal(
    api.binderFormatText({ rows: 2, cols: 2, sheet_count: 5 }),
    "Format 2×2 · 5 sheets · 40 slots.",
  );
  assert.deepEqual(api.faceLabels({ sheet_count: 5 }, 0, 2), [
    "Page 1 (sheet 1/5 Front)",
    "Page 2 (sheet 1/5 Back)",
  ]);
});
