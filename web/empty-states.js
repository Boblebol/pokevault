/**
 * Narrative empty states (F07) — centralized copy and renderer for every
 * Pokédex-flavoured "nothing here" message. Each variant returns a block of
 * {title, body, hint?} strings; `renderEmptyState(host, variant)` paints
 * them into a consistent `.empty-state` container.
 *
 * All strings are localized FR first, with EN kept in sync for future i18n.
 */

const COPY = {
  fr: {
    dexError: {
      title: "Le Professeur a égaré ton Pokédex.",
      body:
        "Les données de référence (data/pokedex.json) n'ont pas pu être chargées.",
      hint: "Relance le serveur à la racine du projet avec make dev.",
    },
    listNoMatch: {
      title: "Aucun Pokémon ne répond à cet appel.",
      body:
        "Essaie un autre numéro, un autre nom ou élargis tes filtres — " +
        "il y a forcément un spécimen qui t'attend.",
    },
    listCollectionEmpty: {
      title: "Ton Pokédex est vide.",
      body:
        "Le Professeur t'attend à Bourg Palette. Capture ton premier " +
        "Pokémon pour démarrer l'aventure.",
    },
    listAllCaught: {
      title: "Tu as capturé tout ce qui entre dans ces filtres.",
      body:
        "Retire le filtre \u00ab manquants \u00bb pour admirer ta collection, " +
        "ou pars chasser une autre région.",
    },
    printEmpty: {
      title: "Rien à imprimer dans ce périmètre.",
      body:
        "Ajuste le filtre attrapés / manquants ou sélectionne un autre " +
        "classeur — le carnet de chasse a besoin d'au moins une entrée.",
    },
    statsEmpty: {
      title: "Tes statistiques attendent leur premier capteur.",
      body:
        "Marque au moins un Pokémon comme attrapé pour que le " +
        "Professeur puisse tracer tes progrès.",
    },
    binderInit: {
      title: "Tes classeurs se préparent.",
      body:
        "Les pages 3×3 par région sont en cours d'initialisation. Si rien " +
        "ne bouge, vérifie que l'API est joignable.",
    },
  },
  en: {
    dexError: {
      title: "The Professor misplaced your Pokedex.",
      body: "Reference data (data/pokedex.json) could not be loaded.",
      hint: "Restart the server from the project root with make dev.",
    },
    listNoMatch: {
      title: "No Pokemon answers that call.",
      body:
        "Try another number, another name or wider filters — " +
        "there is always a specimen waiting somewhere.",
    },
    listCollectionEmpty: {
      title: "Your Pokedex is empty.",
      body:
        "The Professor is waiting in Pallet Town. Catch your first " +
        "Pokemon to start the adventure.",
    },
    listAllCaught: {
      title: "You caught everything in these filters.",
      body:
        "Remove the missing filter to admire your collection, " +
        "or try another region.",
    },
    printEmpty: {
      title: "Nothing to print in this scope.",
      body:
        "Adjust the caught / missing filter or select another binder — " +
        "the field notebook needs at least one entry.",
    },
    statsEmpty: {
      title: "Your stats are waiting for a first capture.",
      body:
        "Mark at least one Pokemon as caught so the Professor can " +
        "track your progress.",
    },
    binderInit: {
      title: "Your binders are getting ready.",
      body:
        "3×3 pages by region are being initialized. If nothing changes, " +
        "check that the API is reachable.",
    },
  },
};

/**
 * @typedef {Object} EmptyCopy
 * @property {string} title
 * @property {string} body
 * @property {string} [hint]
 */

/**
 * @param {string} variant  key of COPY.fr
 * @param {Record<string, string>} [_vars]  reserved for future interpolation
 * @returns {EmptyCopy}
 */
function getEmptyCopy(variant, _vars) {
  const locale = window.PokevaultI18n?.getLocale?.() === "en" ? "en" : "fr";
  const copy = COPY[locale]?.[variant] || COPY.fr[variant];
  if (!copy) {
    return locale === "en"
      ? { title: "Nothing to show here.", body: "Adjust your filters or reload the page." }
      : { title: "Rien à afficher ici.", body: "Ajuste tes filtres ou recharge la page." };
  }
  return copy;
}

/**
 * Paints an empty-state block into `host`, replacing any existing content.
 * Uses the shared `.empty-state` class plus a narrative modifier.
 *
 * @param {HTMLElement | null} host
 * @param {string} variant
 * @param {Record<string, string>} [vars]
 * @returns {HTMLElement | null}
 */
function renderEmptyState(host, variant, vars) {
  if (!host) return null;
  const copy = getEmptyCopy(variant, vars);
  const wrap = document.createElement("div");
  wrap.className = "empty-state empty-state--narrative";
  wrap.setAttribute("role", "status");

  const title = document.createElement("p");
  title.className = "empty-state__title";
  title.textContent = copy.title;
  wrap.append(title);

  const body = document.createElement("p");
  body.className = "empty-state__body";
  body.textContent = copy.body;
  wrap.append(body);

  if (copy.hint) {
    const hint = document.createElement("p");
    hint.className = "empty-state__hint";
    hint.textContent = copy.hint;
    wrap.append(hint);
  }
  return wrap;
}

/**
 * Convenience: returns the flat title (short one-liner) for compact host
 * surfaces such as the list footer banner.
 *
 * @param {string} variant
 * @returns {string}
 */
function emptyStateTitle(variant) {
  return getEmptyCopy(variant).title;
}

window.PokevaultEmptyStates = {
  get: getEmptyCopy,
  render: renderEmptyState,
  title: emptyStateTitle,
};
