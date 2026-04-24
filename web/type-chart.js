/**
 * Pokevault — type effectiveness matrix (roadmap F10).
 *
 * French type names match the Pokédex data produced by
 * ``pokedex/scraper.py``. The matrix encodes how effective an
 * **attacking** type is against a **defending** type, using the
 * standard Generation VI+ multipliers (0, 0.5, 1, 2).
 *
 * Public API lives on ``window.PokevaultTypeChart``:
 * - ``multiplier(attacker, defender)`` → number (0, 0.5, 1, 2).
 * - ``computeWeaknesses(defTypes)`` → ordered list of objects
 *   ``{ type, mult }`` summing all effectivenesses of a dual-type
 *   Pokémon, sorted by multiplier (highest first) then alphabetically.
 */
(function initTypeChart() {
  "use strict";

  const TYPES = [
    "Normal",
    "Feu",
    "Eau",
    "Plante",
    "Électrik",
    "Glace",
    "Combat",
    "Poison",
    "Sol",
    "Vol",
    "Psy",
    "Insecte",
    "Roche",
    "Spectre",
    "Dragon",
    "Ténèbres",
    "Acier",
    "Fée",
  ];

  // For brevity the matrix is coded as { attacker: { defender: mult, ... }, ... }
  // Only non-1× relationships are stored; anything absent defaults to 1.
  const RAW = {
    Normal: { Roche: 0.5, Spectre: 0, Acier: 0.5 },
    Feu: { Feu: 0.5, Eau: 0.5, Plante: 2, Glace: 2, Insecte: 2, Roche: 0.5, Dragon: 0.5, Acier: 2 },
    Eau: { Feu: 2, Eau: 0.5, Plante: 0.5, Sol: 2, Roche: 2, Dragon: 0.5 },
    Plante: {
      Feu: 0.5,
      Eau: 2,
      Plante: 0.5,
      Poison: 0.5,
      Sol: 2,
      Vol: 0.5,
      Insecte: 0.5,
      Roche: 2,
      Dragon: 0.5,
      Acier: 0.5,
    },
    Électrik: { Eau: 2, Plante: 0.5, Électrik: 0.5, Sol: 0, Vol: 2, Dragon: 0.5 },
    Glace: {
      Feu: 0.5,
      Eau: 0.5,
      Plante: 2,
      Glace: 0.5,
      Sol: 2,
      Vol: 2,
      Dragon: 2,
      Acier: 0.5,
    },
    Combat: {
      Normal: 2,
      Glace: 2,
      Poison: 0.5,
      Vol: 0.5,
      Psy: 0.5,
      Insecte: 0.5,
      Roche: 2,
      Spectre: 0,
      Ténèbres: 2,
      Acier: 2,
      Fée: 0.5,
    },
    Poison: {
      Plante: 2,
      Poison: 0.5,
      Sol: 0.5,
      Roche: 0.5,
      Spectre: 0.5,
      Acier: 0,
      Fée: 2,
    },
    Sol: {
      Feu: 2,
      Plante: 0.5,
      Électrik: 2,
      Poison: 2,
      Vol: 0,
      Insecte: 0.5,
      Roche: 2,
      Acier: 2,
    },
    Vol: {
      Plante: 2,
      Électrik: 0.5,
      Combat: 2,
      Insecte: 2,
      Roche: 0.5,
      Acier: 0.5,
    },
    Psy: { Combat: 2, Poison: 2, Psy: 0.5, Ténèbres: 0, Acier: 0.5 },
    Insecte: {
      Feu: 0.5,
      Plante: 2,
      Combat: 0.5,
      Poison: 0.5,
      Vol: 0.5,
      Psy: 2,
      Spectre: 0.5,
      Ténèbres: 2,
      Acier: 0.5,
      Fée: 0.5,
    },
    Roche: {
      Feu: 2,
      Glace: 2,
      Combat: 0.5,
      Sol: 0.5,
      Vol: 2,
      Insecte: 2,
      Acier: 0.5,
    },
    Spectre: {
      Normal: 0,
      Psy: 2,
      Spectre: 2,
      Ténèbres: 0.5,
    },
    Dragon: { Dragon: 2, Acier: 0.5, Fée: 0 },
    Ténèbres: {
      Combat: 0.5,
      Psy: 2,
      Spectre: 2,
      Ténèbres: 0.5,
      Fée: 0.5,
    },
    Acier: {
      Feu: 0.5,
      Eau: 0.5,
      Électrik: 0.5,
      Glace: 2,
      Roche: 2,
      Acier: 0.5,
      Fée: 2,
    },
    Fée: {
      Feu: 0.5,
      Combat: 2,
      Poison: 0.5,
      Dragon: 2,
      Ténèbres: 2,
      Acier: 0.5,
    },
  };

  function multiplier(attacker, defender) {
    const row = RAW[attacker];
    if (!row) return 1;
    const v = row[defender];
    return v === undefined ? 1 : v;
  }

  /**
   * Returns the combined multiplier taken by a Pokémon with `defTypes`
   * when attacked with `attacker`. Multi-type Pokémon compound via
   * multiplication (e.g. Plante/Sol vs. Glace = 2 × 2 = 4).
   *
   * @param {string} attacker
   * @param {string[]} defTypes
   */
  function combinedMultiplier(attacker, defTypes) {
    let total = 1;
    for (const t of defTypes || []) {
      total *= multiplier(attacker, t);
    }
    return total;
  }

  /**
   * Sorted effectiveness chart of how every attacking type hits a
   * defender with `defTypes`. Only buckets that differ from 1× are
   * returned to keep the UI concise.
   *
   * @param {string[]} defTypes
   * @returns {{type: string, mult: number}[]}
   */
  function computeWeaknesses(defTypes) {
    if (!defTypes || !defTypes.length) return [];
    const rows = TYPES.map((t) => ({
      type: t,
      mult: combinedMultiplier(t, defTypes),
    }));
    return rows
      .filter((r) => r.mult !== 1)
      .sort((a, b) => b.mult - a.mult || a.type.localeCompare(b.type));
  }

  window.PokevaultTypeChart = {
    TYPES,
    multiplier,
    combinedMultiplier,
    computeWeaknesses,
  };
})();
