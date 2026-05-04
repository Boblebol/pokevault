/**
 * Pokevault — artwork switcher (roadmap F11).
 *
 * Provides a single place to resolve the best image for a Pokémon
 * tile + fallback chain. Modes:
 *
 *   - ``default`` — Sugimori/official artwork from ``data/images/``.
 *   - ``shiny``   — local ``data/images_shiny/<slug>.png`` first, then
 *     the PokéAPI CDN shiny artwork (no scrape required), finally the
 *     default sprite if both fail. To download shinies locally, run
 *     ``make fetch-shiny`` (uses the same PokéAPI source).
 *   - ``card``    — first user-owned card thumbnail from
 *     ``/api/cards`` (indexed by ``pokemon_slug``); falls back to
 *     default when no card is owned.
 *   - ``sprite_gen*`` — generation-specific sprites from the PokéAPI
 *     sprite CDN, falling back to the default artwork.
 *
 * Mode is persisted in ``localStorage['pokevault.ui.artwork']``.
 *
 * The module exposes ``window.PokevaultArtwork`` with:
 *   - ``resolve(p)`` → ``{ src, fallbacks }`` used by renderers.
 *   - ``resolveForMode(p, mode)`` → same resolver for a specific mode.
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
    { id: "sprite_gen1", label: "Sprite Gen 1" },
    { id: "sprite_gen2", label: "Sprite Gen 2" },
    { id: "sprite_gen3", label: "Sprite Gen 3" },
    { id: "sprite_gen4", label: "Sprite Gen 4" },
    { id: "sprite_gen5", label: "Sprite Gen 5" },
  ];
  const SPRITE_VERSION_PATHS = {
    sprite_gen1: "versions/generation-i/red-blue",
    sprite_gen2: "versions/generation-ii/crystal",
    sprite_gen3: "versions/generation-iii/emerald",
    sprite_gen4: "versions/generation-iv/platinum",
    sprite_gen5: "versions/generation-v/black-white",
  };

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

  function shinyCdnPath(p) {
    const slug = String(p?.slug || "");
    const m = slug.match(/^(\d{1,4})/);
    if (!m) return "";
    const natId = parseInt(m[1], 10);
    if (!Number.isFinite(natId) || natId <= 0) return "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${natId}.png`;
  }

  function nationalIdFromSlug(p) {
    const slug = String(p?.slug || "");
    const m = slug.match(/^(\d{1,4})/);
    if (!m) return 0;
    const natId = parseInt(m[1], 10);
    return Number.isFinite(natId) && natId > 0 ? natId : 0;
  }

  function generationSpritePath(p, mode) {
    const versionPath = SPRITE_VERSION_PATHS[mode];
    const natId = nationalIdFromSlug(p);
    if (!versionPath || !natId) return "";
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${versionPath}/${natId}.png`;
  }

  function cardArt(p) {
    const slug = String(p?.slug || "");
    if (!slug) return "";
    return cardByslug.get(slug) || "";
  }

  function resolveForMode(p, mode = currentMode) {
    const selected = isValid(mode) ? mode : DEFAULT_MODE;
    const def = normalizeDefault(p);
    if (selected === "shiny") {
      const local = shinyPath(p);
      const cdn = shinyCdnPath(p);
      const chain = [local, cdn, def].filter(
        (url, idx, arr) => url && arr.indexOf(url) === idx,
      );
      return { src: chain[0] || def, fallbacks: chain.slice(1) };
    }
    if (selected === "card") {
      const ca = cardArt(p);
      return { src: ca || def, fallbacks: ca && def !== ca ? [def] : [] };
    }
    if (SPRITE_VERSION_PATHS[selected]) {
      const sprite = generationSpritePath(p, selected);
      const chain = [sprite, def].filter(
        (url, idx, arr) => url && arr.indexOf(url) === idx,
      );
      return { src: chain[0] || def, fallbacks: chain.slice(1) };
    }
    return { src: def, fallbacks: [] };
  }

  function resolve(p) {
    return resolveForMode(p, currentMode);
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
    const onError = () => {
      const next = queue.shift();
      if (!next) {
        img.removeEventListener("error", onError);
        return;
      }
      if (img.src !== next) img.src = next;
    };
    img.addEventListener("error", onError, { passive: true });
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
    resolveForMode,
    attach,
    setMode,
    subscribe,
    refreshCards,
  };
})();
