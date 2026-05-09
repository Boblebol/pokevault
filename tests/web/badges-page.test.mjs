import assert from "node:assert/strict";
import { test } from "node:test";

let moduleCase = 0;

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
  moduleCase += 1;
  await import(`../../web/badges-page.js?case=${moduleCase}`);
  return globalThis.window.PokevaultBadgesPage;
}

test("start polls badges silently, renders the gallery, then re-renders without re-subscribing", async () => {
  const host = new FakeElement();
  const pollCalls = [];
  const renderHosts = [];
  const subscriptions = [];
  globalThis.PokevaultBadges = {
    poll(options) {
      pollCalls.push(options);
      return Promise.resolve();
    },
    renderInto(target) {
      renderHosts.push(target);
    },
    subscribe(fn) {
      subscriptions.push(fn);
    },
  };

  const page = await loadModule(host);
  page.start();
  await Promise.resolve();
  page.start();

  assert.deepEqual(pollCalls, [{ silent: true }]);
  assert.equal(subscriptions.length, 1);
  assert.ok(renderHosts.includes(host));
  assert.equal(renderHosts.at(-1), host);
});
