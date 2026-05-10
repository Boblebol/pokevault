/**
 * Shared capture-scope rules for collection targets.
 *
 * The raw Pokédex may contain many visual/gameplay forms. Collection progress
 * only tracks base Pokémon and true regional forms.
 */
(function initPokemonCaptureScope() {
  "use strict";

  const REGIONAL_FORM_IDS = new Set(["alola", "galar", "hisui", "paldea"]);

  function normText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, "'");
  }

  function isMegaFormPokemon(pokemon) {
    const form = normText(pokemon?.form);
    const slug = normText(pokemon?.slug);
    return /\bmega\b/.test(form) || slug.includes("-mega-") || /-mega(-x|-y)?$/.test(slug);
  }

  function isGigamaxPokemon(pokemon) {
    const form = normText(pokemon?.form);
    const slug = normText(pokemon?.slug);
    return form.includes("gigamax") ||
      form.includes("g-max") ||
      slug.includes("gmax") ||
      slug.includes("gigantamax");
  }

  function isRegionalFormPokemon(pokemon) {
    if (isMegaFormPokemon(pokemon) || isGigamaxPokemon(pokemon)) return false;
    const form = normText(pokemon?.form);
    const slug = normText(pokemon?.slug);
    if (/\bd'?alola\b/.test(form)) return true;
    if (/\bde\s+galar\b/.test(form) || form.includes("galar")) return true;
    if (form.includes("hisui") || form.includes("hisu")) return true;
    if (form.includes("paldea")) return true;
    return /(^|-)(alola|galar|hisui|paldea)(-|$)/.test(slug) ||
      slug.includes("alolan") ||
      slug.includes("galarian") ||
      slug.includes("hisuian");
  }

  function isBasePokemonEntry(pokemon) {
    return !String(pokemon?.form || "").trim();
  }

  function isCapturablePokemonEntry(pokemon) {
    if (!pokemon || typeof pokemon !== "object") return false;
    return isBasePokemonEntry(pokemon) || isRegionalFormPokemon(pokemon);
  }

  function capturablePokemonEntries(pokemon = []) {
    return Array.isArray(pokemon) ? pokemon.filter(isCapturablePokemonEntry) : [];
  }

  const api = {
    REGIONAL_FORM_IDS,
    capturablePokemonEntries,
    isBasePokemonEntry,
    isCapturablePokemonEntry,
    isGigamaxPokemon,
    isMegaFormPokemon,
    isRegionalFormPokemon,
  };
  if (window.__POKEVAULT_CAPTURE_SCOPE_TESTS__) api._test = api;
  window.PokevaultCaptureScope = api;
})();
