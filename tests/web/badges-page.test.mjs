import assert from "node:assert/strict";
import { test } from "node:test";

class FakeElement {
  constructor() {
    this.children = [];
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }
}

async function loadModule(host) {
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById(id) {
      return id === "badgesBody" ? host : null;
    },
  };
  await import(`../../web/badges-page.js?case=${Date.now()}`);
  return globalThis.window.PokevaultBadgesPage;
}

test("start polls badges silently before rendering page gallery", async () => {
  const host = new FakeElement();
  const pollCalls = [];
  const renderHosts = [];
  globalThis.PokevaultBadges = {
    poll(options) {
      pollCalls.push(options);
      return Promise.resolve();
    },
    renderInto(target) {
      renderHosts.push(target);
    },
    subscribe() {},
  };

  const page = await loadModule(host);
  page.start();
  await Promise.resolve();

  assert.deepEqual(pollCalls, [{ silent: true }]);
  assert.ok(renderHosts.includes(host));
});
