import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;
let trainerApi = null;

function installBrowserStubs() {
  globalThis.__POKEVAULT_TRAINERS_TESTS__ = true;
  globalThis.window = globalThis;
  delete globalThis.PokevaultTrainerContacts;
  globalThis.document = {
    addEventListener() {},
    dispatchEvent() {},
    getElementById() {
      return null;
    },
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
}

async function loadModule() {
  if (!trainerApi) {
    installBrowserStubs();
    importCase += 1;
    await import(`../../web/trainer-contacts.js?case=${Date.now()}-${importCase}`);
    trainerApi = globalThis.window.PokevaultTrainerContacts._test;
  }
  return trainerApi;
}

test("normalizeBook keeps own card and contacts keyed by trainer id", async () => {
  const api = await loadModule();
  const book = api.normalizeBook({
    own_card: { trainer_id: "trainer-me", display_name: "Me", updated_at: "2026-04-30T10:00:00+00:00" },
    contacts: {
      alex: {
        card: {
          trainer_id: "alex",
          display_name: "Alex",
          wants: ["0025-pikachu"],
          updated_at: "2026-04-30T10:00:00+00:00",
        },
        private_note: "trade",
        first_received_at: "2026-04-30T11:00:00+00:00",
        last_received_at: "2026-04-30T11:00:00+00:00",
      },
      bad: { card: { trainer_id: "", display_name: "" } },
    },
  });

  assert.equal(book.own_card.display_name, "Me");
  assert.deepEqual(Object.keys(book.contacts), ["alex"]);
  assert.equal(book.contacts.alex.card.wants[0], "0025-pikachu");
});

test("cardFromForm trims optional lists and contact link values", async () => {
  const api = await loadModule();
  const card = api.cardFromForm({
    trainer_id: "trainer-123",
    display_name: " Alex ",
    favorite_region: "kanto",
    favorite_pokemon_slug: " 0025-pikachu ",
    public_note: " hello ",
    contact_kind: "discord",
    contact_label: " Discord ",
    contact_value: " alex#0001 ",
    wants: "0001-bulbasaur\n\n0004-charmander",
    for_trade: "0007-squirtle",
  });

  assert.equal(card.display_name, "Alex");
  assert.equal(card.favorite_pokemon_slug, "0025-pikachu");
  assert.deepEqual(card.wants, ["0001-bulbasaur", "0004-charmander"]);
  assert.deepEqual(card.for_trade, ["0007-squirtle"]);
  assert.equal(card.contact_links[0].value, "alex#0001");
});
