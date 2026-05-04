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
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { cards: [] };
    },
  });
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

test("artwork switcher exposes generation sprite modes", async () => {
  const api = await loadModule();

  assert.deepEqual(
    api.modes.map((mode) => mode.id).filter((id) => id.startsWith("sprite_gen")),
    ["sprite_gen1", "sprite_gen2", "sprite_gen3", "sprite_gen4", "sprite_gen5"],
  );
});

test("resolveForMode uses generation sprite before official artwork fallback", async () => {
  const api = await loadModule();
  const resolved = api.resolveForMode(
    {
      slug: "0001-bulbasaur",
      image: "/data/images/0001-bulbasaur.png",
    },
    "sprite_gen2",
  );

  assert.equal(
    resolved.src,
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ii/crystal/1.png",
  );
  assert.deepEqual(resolved.fallbacks, ["/data/images/0001-bulbasaur.png"]);
});
