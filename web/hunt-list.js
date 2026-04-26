/**
 * Pokevault — local-first hunt list client.
 */
(function initHuntList() {
  "use strict";

  const API_HUNTS = "/api/hunts";
  let cachedState = { version: 1, hunts: {} };
  let inflight = null;
  let hasLoaded = false;
  const listeners = new Set();

  function normalizeEntry(raw) {
    if (!raw || typeof raw !== "object" || raw.wanted === false) return null;
    return {
      wanted: true,
      priority: raw.priority === "high" ? "high" : "normal",
      note: typeof raw.note === "string" ? raw.note : "",
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
    };
  }

  function normalizeState(raw) {
    const out = { version: 1, hunts: {} };
    const hunts = raw && typeof raw.hunts === "object" ? raw.hunts : {};
    for (const [slug, entryRaw] of Object.entries(hunts)) {
      const key = String(slug || "").trim();
      if (!key) continue;
      const entry = normalizeEntry(entryRaw);
      if (entry) out.hunts[key] = entry;
    }
    return out;
  }

  function notify() {
    for (const fn of listeners) {
      try {
        fn(cachedState);
      } catch (err) {
        console.error("hunts: listener failed", err);
      }
    }
    try {
      document.dispatchEvent(new CustomEvent("pokevault:hunts-changed", { detail: cachedState }));
    } catch {
      /* best effort */
    }
  }

  async function fetchState() {
    const r = await fetch(API_HUNTS);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return normalizeState(await r.json());
  }

  async function ensureLoaded({ force = false } = {}) {
    if (inflight) return inflight;
    if (!force && hasLoaded) return cachedState;
    inflight = (async () => {
      try {
        cachedState = await fetchState();
        hasLoaded = true;
        notify();
      } catch (err) {
        console.error("hunts: load failed", err);
      } finally {
        inflight = null;
      }
      return cachedState;
    })();
    return inflight;
  }

  async function patch(slug, body) {
    const key = String(slug || "").trim();
    if (!key) return cachedState;
    const payload = {
      wanted: body?.wanted !== false,
      priority: body?.priority === "high" ? "high" : "normal",
      note: typeof body?.note === "string" ? body.note : "",
    };
    const r = await fetch(`${API_HUNTS}/${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    cachedState = normalizeState(await r.json());
    hasLoaded = true;
    notify();
    return cachedState;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    try {
      fn(cachedState);
    } catch (err) {
      console.error("hunts: immediate listener failed", err);
    }
    return () => listeners.delete(fn);
  }

  function isWanted(slug) {
    return Boolean(cachedState.hunts[String(slug || "")]?.wanted);
  }

  function priority(slug) {
    return cachedState.hunts[String(slug || "")]?.priority || "normal";
  }

  function entry(slug) {
    return cachedState.hunts[String(slug || "")] || null;
  }

  const api = {
    ensureLoaded,
    patch,
    subscribe,
    isWanted,
    priority,
    entry,
    get state() {
      return cachedState;
    },
  };

  if (window.__POKEVAULT_HUNTS_TESTS__) {
    api._test = { normalizeEntry, normalizeState };
  }

  window.PokevaultHunts = api;

  if (!window.__POKEVAULT_HUNTS_TESTS__) {
    void ensureLoaded();
  }
})();
