/**
 * Pokevault — artwork switcher (roadmap F11).
 *
 * Provides a single place to resolve the best image for a Pokémon
 * tile + fallback chain. Three v1 modes:
 *
 *   - ``default`` — Sugimori/official artwork from ``data/images/``.
 *   - ``shiny``   — ``data/images_shiny/<slug>.png`` (falls back to
 *     default if the scrape hasn't produced the file yet).
 *   - ``card``    — first user-owned card thumbnail from
 *     ``/api/cards`` (indexed by ``pokemon_slug``); falls back to
 *     default when no card is owned.
 *
 * Mode is persisted in ``localStorage['pokevault.ui.artwork']``.
 *
 * The module exposes ``window.PokevaultArtwork`` with:
 *   - ``resolve(p)`` → ``{ src, fallbacks }`` used by renderers.
 *   - ``mode`` / ``setMode(id)`` / ``subscribe(fn)``.
 *   - ``refreshCards()`` — re-index card thumbnails (called by the
 *     drawer after create/delete via ``pokevault:cards-changed``).
 */
(function initArtwork() {
  "use strict";

  const STORAGE_KEY = "pokevault.ui.artwork";
  const DEFAULT_MODE = "default";
  const MODES = [
    { id: "default", label: "Sugimori" },
    { id: "shiny", label: "Shiny (fallback si absent)" },
    { id: "card", label: "Première carte TCG" },
  ];

  function readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function writeStored(id) {
    try {
      if (id && id !== DEFAULT_MODE) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore quota / private mode */
    }
  }

  function isValid(id) {
    return MODES.some((m) => m.id === id);
  }

  let currentMode = isValid(readStored()) ? readStored() : DEFAULT_MODE;
  const listeners = new Set();
  const cardByslug = new Map();

  function normalizeDefault(p) {
    const raw = String(p?.image || "");
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.startsWith("/") ? raw : `/${raw}`;
  }

  function shinyPath(p) {
    const slug = String(p?.slug || "");
    if (!slug) return "";
    return `/data/images_shiny/${encodeURIComponent(slug)}.png`;
  }

  function cardArt(p) {
    const slug = String(p?.slug || "");
    if (!slug) return "";
    return cardByslug.get(slug) || "";
  }

  function resolve(p) {
    const def = normalizeDefault(p);
    if (currentMode === "shiny") {
      const shiny = shinyPath(p);
      return { src: shiny || def, fallbacks: shiny && def !== shiny ? [def] : [] };
    }
    if (currentMode === "card") {
      const ca = cardArt(p);
      return { src: ca || def, fallbacks: ca && def !== ca ? [def] : [] };
    }
    return { src: def, fallbacks: [] };
  }

  async function refreshCards() {
    try {
      const r = await fetch("/api/cards");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json();
      const list = Array.isArray(body?.cards) ? body.cards : [];
      cardByslug.clear();
      for (const c of list) {
        const slug = String(c?.pokemon_slug || "");
        const img = String(c?.image_url || "");
        if (slug && img && !cardByslug.has(slug)) {
          cardByslug.set(slug, img);
        }
      }
    } catch (err) {
      console.error("artwork: card refresh failed", err);
    }
    notify();
  }

  function notify() {
    for (const fn of listeners) {
      try {
        fn(currentMode);
      } catch (err) {
        console.error("artwork: listener failed", err);
      }
    }
  }

  function setMode(id) {
    const next = isValid(id) ? id : DEFAULT_MODE;
    if (next === currentMode) return currentMode;
    currentMode = next;
    writeStored(next);
    notify();
    return currentMode;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /**
   * Bind the fallback chain onto an <img> element. Useful for
   * synchronous rendering code: ``attach(img, resolved)``.
   */
  function attach(img, resolved) {
    if (!img || !resolved) return;
    const queue = Array.isArray(resolved.fallbacks)
      ? resolved.fallbacks.slice()
      : [];
    img.addEventListener(
      "error",
      () => {
        const next = queue.shift();
        if (next && img.src !== next) img.src = next;
      },
      { passive: true },
    );
    img.src = resolved.src;
  }

  document.addEventListener("pokevault:cards-changed", () => {
    void refreshCards();
  });
  void refreshCards();

  window.PokevaultArtwork = {
    get mode() {
      return currentMode;
    },
    get modes() {
      return MODES.slice();
    },
    resolve,
    attach,
    setMode,
    subscribe,
    refreshCards,
  };
})();
