import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;
let trainerApi = null;

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.className = "";
    this.innerHTML = "";
    this.dataset = {};
    this.hidden = false;
    this.textContent = "";
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

function installBrowserStubs() {
  globalThis.__POKEVAULT_TRAINERS_TESTS__ = true;
  globalThis.window = globalThis;
  delete globalThis.PokevaultTrainerContacts;
  globalThis.document = {
    addEventListener() {},
    dispatchEvent() {},
    createElement(tagName) {
      return new FakeElement(tagName);
    },
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

test("cardFromForm keeps multiple shareable contact links", async () => {
  const api = await loadModule();
  const card = api.cardFromForm({
    trainer_id: "trainer-123",
    display_name: "Alex",
    contact_kind_0: "instagram",
    contact_value_0: " @alex_cards ",
    contact_kind_1: "facebook",
    contact_value_1: "alex.cards",
    contact_kind_2: "phone",
    contact_value_2: " +33 6 12 34 56 78 ",
  });

  assert.deepEqual(card.contact_links, [
    { kind: "instagram", label: "Instagram", value: "@alex_cards" },
    { kind: "facebook", label: "Facebook", value: "alex.cards" },
    { kind: "phone", label: "Téléphone", value: "+33 6 12 34 56 78" },
  ]);
});

test("filterContacts matches local book fields and keeps display-name order", async () => {
  const api = await loadModule();
  const contacts = {
    misty: {
      card: {
        trainer_id: "misty",
        display_name: "Misty",
        favorite_region: "Kanto",
        favorite_pokemon_slug: "0121-starmie",
        public_note: "Water trades",
        contact_links: [{ kind: "discord", label: "Discord", value: "misty#0001" }],
        wants: ["0054-psyduck"],
        for_trade: ["0118-goldeen"],
        updated_at: "2026-04-30T10:00:00+00:00",
      },
      private_note: "met at local league",
      first_received_at: "2026-04-30T11:00:00+00:00",
      last_received_at: "2026-04-30T11:00:00+00:00",
    },
    brock: {
      card: {
        trainer_id: "brock",
        display_name: "Brock",
        favorite_region: "Kanto",
        favorite_pokemon_slug: "0095-onix",
        public_note: "Rock cards",
        contact_links: [],
        wants: ["0074-geodude"],
        for_trade: [],
        updated_at: "2026-04-30T10:00:00+00:00",
      },
      private_note: "",
      first_received_at: "2026-04-30T12:00:00+00:00",
      last_received_at: "2026-04-30T12:00:00+00:00",
    },
  };

  assert.deepEqual(
    api.filterContacts(contacts, "kanto").map((contact) => contact.card.display_name),
    ["Brock", "Misty"],
  );
  assert.deepEqual(
    api.filterContacts(contacts, "psyduck").map((contact) => contact.card.display_name),
    ["Misty"],
  );
  assert.deepEqual(
    api.filterContacts(contacts, "local league").map((contact) => contact.card.display_name),
    ["Misty"],
  );
});

test("renderContact exposes trade lists, private note controls, and delete action", async () => {
  const api = await loadModule();
  const article = api.renderContact({
    card: {
      trainer_id: "misty-123",
      display_name: "Misty",
      favorite_region: "Kanto",
      favorite_pokemon_slug: "0121-starmie",
      public_note: "Water trades",
      contact_links: [{ kind: "discord", label: "Discord", value: "misty#0001" }],
      wants: ["0054-psyduck"],
      for_trade: ["0118-goldeen"],
      updated_at: "2026-04-30T10:00:00+00:00",
    },
    private_note: "Bring sleeves",
    first_received_at: "2026-04-30T11:00:00+00:00",
    last_received_at: "2026-04-30T11:00:00+00:00",
  });

  assert.match(article.innerHTML, /Cherche/);
  assert.match(article.innerHTML, /0054-psyduck/);
  assert.match(article.innerHTML, /Echange/);
  assert.match(article.innerHTML, /0118-goldeen/);
  assert.match(article.innerHTML, /data-trainer-note-form/);
  assert.match(article.innerHTML, /Bring sleeves/);
  assert.match(article.innerHTML, /data-trainer-delete/);
});

test("renderContact exposes social contact links as clickable actions", async () => {
  const api = await loadModule();
  const article = api.renderContact({
    card: {
      trainer_id: "misty-123",
      display_name: "Misty",
      contact_links: [
        { kind: "instagram", label: "Instagram", value: "@misty_cards" },
        { kind: "phone", label: "Téléphone", value: "+33 6 12 34 56 78" },
      ],
      wants: [],
      for_trade: [],
      updated_at: "2026-04-30T10:00:00+00:00",
    },
    private_note: "",
    first_received_at: "2026-04-30T11:00:00+00:00",
    last_received_at: "2026-04-30T11:00:00+00:00",
  });

  assert.match(article.innerHTML, /href="https:\/\/instagram\.com\/misty_cards"/);
  assert.match(article.innerHTML, /href="tel:\+33612345678"/);
});

test("note requests trim private notes and target the trainer note endpoint", async () => {
  const api = await loadModule();
  const request = api.notePatchRequest("misty/123", "  Bring sleeves  ");

  assert.equal(request.url, "/api/trainers/misty%2F123/note");
  assert.equal(request.init.method, "PATCH");
  assert.equal(request.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.init.body), { note: "Bring sleeves" });
});

test("delete requests target the trainer contact endpoint", async () => {
  const api = await loadModule();
  const request = api.deleteContactRequest("misty/123");

  assert.equal(request.url, "/api/trainers/misty%2F123");
  assert.deepEqual(request.init, { method: "DELETE" });
});

test("shouldDeleteContact delegates the final decision to browser confirmation", async () => {
  const api = await loadModule();
  const calls = [];

  assert.equal(api.shouldDeleteContact("Misty", (message) => {
    calls.push(message);
    return false;
  }), false);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /Misty/);
});

test("ensureOk reports failed API responses", async () => {
  const api = await loadModule();

  await assert.rejects(api.ensureOk({ ok: false, status: 503 }), /HTTP 503/);
});

test("validateTrainerCard explains required display name before API calls", async () => {
  const api = await loadModule();
  const card = api.cardFromForm({
    trainer_id: "trainer-123",
    display_name: "   ",
  });

  assert.equal(api.validateTrainerCard(card), "Ajoute un pseudo dresseur avant d'enregistrer.");
});

test("validateTrainerCard explains stable id length before API calls", async () => {
  const api = await loadModule();
  const card = api.cardFromForm({
    trainer_id: "abc",
    display_name: "Alex",
  });

  assert.equal(
    api.validateTrainerCard(card),
    "Garde un identifiant stable d'au moins 8 caractères.",
  );
});

test("validateTrainerCard accepts a complete local card", async () => {
  const api = await loadModule();
  const card = api.cardFromForm({
    trainer_id: "trainer-123",
    display_name: "Alex",
  });

  assert.equal(api.validateTrainerCard(card), "");
});

test("updateCardListMembership toggles wants and trades without duplicates", async () => {
  const api = await loadModule();
  const card = api.normalizeCard({
    trainer_id: "trainer-123",
    display_name: "Alex",
    wants: ["0001-bulbasaur"],
    for_trade: ["0004-charmander"],
    updated_at: "2026-04-30T10:00:00+00:00",
  });

  const wanted = api.updateCardListMembership(card, "wants", "0001-bulbasaur", true);
  assert.deepEqual(wanted.wants, ["0001-bulbasaur"]);

  const removed = api.updateCardListMembership(wanted, "wants", "0001-bulbasaur", false);
  assert.deepEqual(removed.wants, []);

  const traded = api.updateCardListMembership(removed, "for_trade", "0007-squirtle", true);
  assert.deepEqual(traded.for_trade, ["0004-charmander", "0007-squirtle"]);
});

test("defaultOwnCard creates a valid local card for low-friction chips", async () => {
  const api = await loadModule();
  const card = api.defaultOwnCard(() => "trainer-generated");

  assert.equal(card.trainer_id, "trainer-generated");
  assert.equal(card.display_name, "Dresseur local");
  assert.equal(api.validateTrainerCard(card), "");
});

test("contactsTrading and tradeSummary find imported exchange opportunities", async () => {
  const api = await loadModule();
  const book = api.normalizeBook({
    own_card: {
      trainer_id: "trainer-me",
      display_name: "Me",
      wants: ["0130-gyarados"],
      for_trade: ["0001-bulbasaur"],
      updated_at: "2026-04-30T10:00:00+00:00",
    },
    contacts: {
      misty: {
        card: {
          trainer_id: "misty",
          display_name: "Misty",
          wants: ["0001-bulbasaur"],
          for_trade: ["0130-gyarados"],
          updated_at: "2026-04-30T10:00:00+00:00",
        },
        first_received_at: "2026-04-30T11:00:00+00:00",
        last_received_at: "2026-04-30T11:00:00+00:00",
      },
      brock: {
        card: {
          trainer_id: "brock",
          display_name: "Brock",
          wants: [],
          for_trade: ["0095-onix"],
          updated_at: "2026-04-30T10:00:00+00:00",
        },
        first_received_at: "2026-04-30T11:00:00+00:00",
        last_received_at: "2026-04-30T11:00:00+00:00",
      },
    },
  });

  assert.deepEqual(api.contactsTrading(book, "0130-gyarados").map((c) => c.card.display_name), ["Misty"]);
  assert.deepEqual(api.contactsWanting(book, "0001-bulbasaur").map((c) => c.card.display_name), ["Misty"]);
  assert.deepEqual(api.tradeSummary(book, "0130-gyarados"), {
    availableFrom: ["Misty"],
    wantedBy: [],
    matchCount: 1,
    canHelpCount: 0,
  });
});
