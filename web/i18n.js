(function initPokevaultI18n() {
  "use strict";

  const STORAGE_KEY = "pokevault_locale";
  const DEFAULT_LOCALE = "fr";
  const SUPPORTED = new Set(["fr", "en"]);
  const listeners = new Set();

  let messages = { fr: {}, en: {} };
  let initialized = false;

  function getLocale() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED.has(stored)) return stored;
    } catch {
      /* ignore */
    }
    const nav = (navigator.language || "").split("-")[0];
    return SUPPORTED.has(nav) ? nav : DEFAULT_LOCALE;
  }

  function setLocale(l) {
    if (!SUPPORTED.has(l)) return;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    applyTranslations();
    for (const fn of listeners) {
      try {
        fn(l);
      } catch {
        /* ignore */
      }
    }
  }

  function subscribeLocale(fn) {
    if (typeof fn === "function") listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function normalizeLocale(l) {
    return SUPPORTED.has(l) ? l : getLocale();
  }

  function interpolate(text, params) {
    return String(text).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => {
      const val = params[name];
      return val !== undefined ? String(val) : `{${name}}`;
    });
  }

  function t(key, params = {}, locale = null) {
    const l = normalizeLocale(locale);
    const dict = messages[l] || messages[DEFAULT_LOCALE] || {};
    const raw = dict[key];
    if (raw === undefined) return key;
    return interpolate(raw, params);
  }

  function translateElement(el) {
    if (!el) return;
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);

    const phKey = el.getAttribute("data-i18n-placeholder");
    if (phKey) el.setAttribute("placeholder", t(phKey));

    const ariaKey = el.getAttribute("data-i18n-aria-label");
    if (ariaKey) el.setAttribute("aria-label", t(ariaKey));

    const titleKey = el.getAttribute("data-i18n-title");
    if (titleKey) el.setAttribute("title", t(titleKey));
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n], [data-i18n-placeholder], [data-i18n-aria-label], [data-i18n-title]").forEach(translateElement);
  }

  function loadMessages(data) {
    if (!data || typeof data !== "object") return;
    messages = data;
    initialized = true;
    boot();
  }

  function wireLocaleButtons() {
    document.querySelectorAll?.("[data-i18n-locale]").forEach((button) => {
      if (button.dataset?.i18nWired) return;
      if (button.dataset) button.dataset.i18nWired = "1";
      button.addEventListener?.("click", () => setLocale(button.getAttribute("data-i18n-locale")));
    });
  }

  function boot() {
    wireLocaleButtons();
    applyTranslations();
  }

  window.PokevaultI18n = {
    getLocale,
    setLocale,
    subscribeLocale,
    loadMessages,
    t,
    applyTranslations,
    translateElement,
    _test: { messages, normalizeLocale, interpolate }
  };

  if (initialized) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }
})();
