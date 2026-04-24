/**
 * Pokevault — regional themes (roadmap F13).
 *
 * Simple theme switcher applied via ``document.documentElement.dataset.theme``.
 * Persisted in ``localStorage['pokevault.ui.theme']``.
 *
 * The four v1 skins derive from the existing CSS custom properties
 * exposed in ``:root`` (``--bg``, ``--card``, ``--accent``, ``--text``,
 * ``--muted``). Concrete overrides live in ``web/styles.css`` under
 * ``html[data-theme="…"]`` selectors.
 */
(function initThemes() {
  "use strict";

  const STORAGE_KEY = "pokevault.ui.theme";
  const DEFAULT_THEME = "default";
  const THEMES = [
    { id: "default", label: "Vault (défaut)" },
    { id: "kanto", label: "Kanto (retro)" },
    { id: "hoenn", label: "Hoenn (océan)" },
    { id: "paldea", label: "Paldea (terracotta)" },
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
      if (id && id !== DEFAULT_THEME) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore quota / private mode errors */
    }
  }

  function isValid(id) {
    return THEMES.some((t) => t.id === id);
  }

  function apply(id) {
    const target = isValid(id) ? id : DEFAULT_THEME;
    const html = document.documentElement;
    if (target === DEFAULT_THEME) {
      delete html.dataset.theme;
    } else {
      html.dataset.theme = target;
    }
    return target;
  }

  let currentTheme = apply(readStored() || DEFAULT_THEME);
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) {
      try {
        fn(currentTheme);
      } catch (err) {
        console.error("themes: listener failed", err);
      }
    }
  }

  function set(id) {
    const next = isValid(id) ? id : DEFAULT_THEME;
    if (next === currentTheme) return currentTheme;
    currentTheme = apply(next);
    writeStored(next);
    notify();
    return currentTheme;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  window.PokevaultThemes = {
    get current() {
      return currentTheme;
    },
    get list() {
      return THEMES.slice();
    },
    apply,
    set,
    subscribe,
  };
})();
