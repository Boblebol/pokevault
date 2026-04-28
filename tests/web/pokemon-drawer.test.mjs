import assert from "node:assert/strict";
import { test } from "node:test";

function installBrowserStubs() {
  globalThis.__POKEVAULT_DRAWER_TESTS__ = true;
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.location = { hash: "" };
  globalThis.history = { replaceState() {} };
  globalThis.document = {
    activeElement: null,
    addEventListener() {},
    dispatchEvent() {},
    getElementById() {
      return null;
    },
    createElement() {
      return {
        append() {},
        addEventListener() {},
        classList: { add() {}, remove() {} },
        dataset: {},
        replaceChildren() {},
        setAttribute() {},
      };
    },
  };
}

async function loadModule() {
  installBrowserStubs();
  await import(`../../web/pokemon-drawer.js?case=${Date.now()}`);
  return globalThis.window.PokevaultDrawer._test;
}

test("payloadFromFormData includes selected TCG metadata", async () => {
  const api = await loadModule();
  const fd = new FormData();
  fd.set("set_id", " sv1 ");
  fd.set("num", " 25 ");
  fd.set("variant", " Common ");
  fd.set("lang", " fr ");
  fd.set("condition", "near_mint");
  fd.set("qty", "2");
  fd.set("note", " promo ");
  fd.set("image_url", " https://images.example/sv1-25_hires.png ");
  fd.set("tcg_api_id", " sv1-25 ");

  assert.deepEqual(api.payloadFromFormData(fd, "0025-pikachu"), {
    pokemon_slug: "0025-pikachu",
    set_id: "sv1",
    num: "25",
    variant: "Common",
    lang: "fr",
    condition: "near_mint",
    qty: 2,
    acquired_at: null,
    note: "promo",
    image_url: "https://images.example/sv1-25_hires.png",
    tcg_api_id: "sv1-25",
  });
});

test("applyTcgCardToForm prefills local card fields", async () => {
  const api = await loadModule();
  const form = {
    elements: {
      tcg_api_id: { value: "" },
      set_id: { value: "" },
      num: { value: "" },
      variant: { value: "" },
      image_url: { value: "" },
    },
  };

  api.applyTcgCardToForm(form, {
    id: "base1-4",
    set_id: "base1",
    number: "4",
    rarity: "Rare Holo",
    small_image_url: "https://images.example/base1-4.png",
    large_image_url: "https://images.example/base1-4_hires.png",
  });

  assert.equal(form.elements.tcg_api_id.value, "base1-4");
  assert.equal(form.elements.set_id.value, "base1");
  assert.equal(form.elements.num.value, "4");
  assert.equal(form.elements.variant.value, "Rare Holo");
  assert.equal(form.elements.image_url.value, "https://images.example/base1-4_hires.png");
});
