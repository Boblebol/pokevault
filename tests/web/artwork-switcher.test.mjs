import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;
let apiPromise = null;

function installBrowserStubs() {
  globalThis.window = globalThis;
  globalThis.document = {
    addEventListener() {},
  };
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  };
  globalThis.fetch = async (url) => {
    throw new Error(`unexpected fetch ${url}`);
  };
}

async function loadModule() {
  if (!apiPromise) {
    installBrowserStubs();
    importCase += 1;
    apiPromise = import(`../../web/artwork-switcher.js?case=${Date.now()}-${importCase}`)
      .then(() => globalThis.window.PokevaultArtwork);
  }
  return apiPromise;
}

test("artwork switcher resolves default official artwork", async () => {
  const api = await loadModule();
  const resolved = api.resolve({
    slug: "0001-bulbasaur",
    image: "/data/images/0001-bulbasaur.png",
  });

  assert.equal(resolved.src, "/data/images/0001-bulbasaur.png");
  assert.deepEqual(resolved.fallbacks, []);
});

test("artwork switcher handles external URLs", async () => {
  const api = await loadModule();
  const resolved = api.resolve({
    slug: "external",
    image: "https://example.com/sprite.png",
  });

  assert.equal(resolved.src, "https://example.com/sprite.png");
});
