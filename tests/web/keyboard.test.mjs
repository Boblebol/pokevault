import assert from "node:assert/strict";
import { test } from "node:test";

let importCase = 0;

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.value = "dracau";
    this.tagName = "INPUT";
    this.selected = false;
  }

  focus() {
    globalThis.document.activeElement = this;
  }

  select() {
    this.selected = true;
  }
}

async function installKeyboard() {
  const handlers = {};
  const search = new FakeElement("search");
  globalThis.window = globalThis;
  globalThis.location = { hash: "#/stats" };
  globalThis.sessionStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  globalThis.document = {
    activeElement: null,
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    getElementById(id) {
      if (id === "search") return search;
      if (id === "grid") {
        return {
          querySelectorAll() {
            return [];
          },
        };
      }
      return null;
    },
  };

  importCase += 1;
  await import(`../../web/keyboard.js?case=${Date.now()}-${importCase}`);
  return { handlers, search };
}

test("Cmd/Ctrl+K opens collection search from any app view", async () => {
  const { handlers, search } = await installKeyboard();
  let prevented = false;

  handlers.keydown({
    key: "k",
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    target: { tagName: "BODY" },
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(globalThis.location.hash, "#/liste");
  assert.equal(globalThis.document.activeElement, search);
  assert.equal(search.selected, true);
});
