(function initPokevaultDocsI18n() {
  "use strict";

  var STORAGE_KEY = "pokevault_locale";
  var DEFAULT_LOCALE = "fr";
  var SUPPORTED = { fr: true, en: true };

  var messages = {
    fr: {
      "meta.title": "Pokevault - Le Pokédex des vrais échanges",
      "meta.description": "Pokevault est le Pokédex local-first des collectionneurs qui préfèrent les vrais échanges au cloud.",
      "nav.main": "Navigation principale",
      "nav.features": "Fonctions",
      "nav.install": "Installer",
      "nav.architecture": "Architecture",
      "nav.roadmap": "Roadmap",
      "nav.contribute": "Contribuer",
      "nav.language": "Langue",
      "landing.hero.shot_label": "Capture de la vue collection Pokevault",
      "landing.hero.shot_alt": "Grille de collection Pokevault avec progression Pokemon",
      "landing.hero.kicker": "pokevault",
      "landing.hero.title": "Le Pokédex des collectionneurs qui préfèrent les vrais échanges au cloud.",
      "landing.hero.lead": "Complète ton Pokédex, organise tes classeurs et échange des cartes Dresseur à l’ancienne : par fichier, sans compte, sans serveur, chacun avec son carnet local. Comme avant : on complète, on compare, on échange. Sauf que cette fois, tout reste chez toi.",
      "landing.hero.primary": "Lancer en local",
      "landing.hero.features": "Voir les fonctions",
      "landing.hero.source": "Voir le code",
      "landing.metric.entries": "entrées Pokédex de référence, formes incluses",
      "landing.metric.coverage": "couverture de lignes requise côté tracker",
      "landing.metric.accounts": "compte ou base hébergée requis",
      "landing.why.kicker": "Pourquoi ça existe",
      "landing.why.title": "Un carnet local pour l’ancienne boucle d’aventure.",
      "landing.why.text": "Pokevault garde le plaisir de remplir un Pokédex route après route : marquer ce que tu as trouvé, garder tes notes, comparer avec les Dresseurs rencontrés et conserver chaque fichier sur ta machine.",
      "landing.feature.pokedex.title": "Pokédex d’abord",
      "landing.feature.pokedex.text": "Capturé, Double, Relâcher 1 et Relâcher restent centrés sur chaque Pokémon; tout ce qui manque est simplement implicite.",
      "landing.feature.trainers.title": "Rencontres Dresseur",
      "landing.feature.trainers.text": "Importe la carte locale d’un autre Dresseur, puis laisse Vu chez signaler les doublons qui te manquent.",
      "landing.feature.binders.title": "Pensé classeurs",
      "landing.feature.binders.text": "Modélise tes classeurs physiques, le défaut 3×3 · 10 feuillets, les familles d’évolution, les grilles custom et les checklists imprimables.",
      "landing.feature.local.title": "Échanges locaux",
      "landing.feature.local.text": "Exporte tes Cartes Dresseur à la main avec liens de contact optionnels, importe celles qu’on t’envoie dans un carnet consultable et garde tout en local-first.",
      "landing.screens.kicker": "Captures",
      "landing.screens.title": "Un espace pour parcourir, ranger et mesurer ta progression.",
      "landing.screens.binder_alt": "Vue classeur avec navigation de coffres et grille de cartes",
      "landing.screens.binder_caption": "Vue classeur pour planifier ta collection physique page par page.",
      "landing.screens.stats_alt": "Vue statistiques avec métriques de complétion et cartes de progression",
      "landing.screens.stats_caption": "Vue statistiques avec progression régionale, types et badges.",
      "landing.quick.kicker": "Démarrage rapide",
      "landing.quick.title": "Lance-le en local en quelques commandes.",
      "landing.quick.copy": "Copier",
      "landing.quick.copied": "Copié",
      "landing.quick.install": "Lire le guide d’installation",
      "landing.quick.readme": "Ouvrir le README",
      "landing.footer.status": "Pokevault v1.6.3 · MIT. Local-first par design.",
      "landing.footer.contribute": "Contribuer",
      "landing.footer.security": "Sécurité",
      "landing.footer.changelog": "Changelog",
      "landing.footer.portfolio": "Portfolio",
      "features.hero.kicker": "Surface produit",
      "features.hero.title": "Fonctionnalités",
      "features.hero.text": "Pokevault part du Pokédex, puis ajoute les classeurs, les Cartes Dresseur locales, les badges et les données local-first. La documentation produit complète existe aussi dans l'app locale à #/docs. FR: documentation publique en français.",
      "features.collection.title": "Espace Collection",
      "features.collection.text": "Parcours le Pokédex National avec régions, tags narratifs, recherche floue, raccourcis clavier et actions Capturé, Double et Relâcher sur une progression JSON locale.",
      "features.fiches.title": "Modale Pokémon",
      "features.fiches.text": "Ouvre une seule modale pour l'identité, l'artwork, Capturé/Double/Relâcher, les formes liées, notes, types et apparitions dans les Pokédex des jeux via data/game-pokedexes.json.",
      "features.cards.title": "Apparitions Pokédex des jeux",
      "features.cards.text": "Consulte les définitions de Pokédex régionaux où un Pokémon apparaît, depuis un fichier local compact qui peut grandir sans nouvel état utilisateur.",
      "features.binders.title": "Planificateur de classeurs physiques",
      "features.binders.text": "Crée des classeurs locaux avec défaut 3×3 · 10 feuillets, sprites depuis Réglages > Images / sprites, familles compactes comme Spoink / Groret / Spinda et alignement strict. Grand classeur 3×3 pour un gros classeur à anneaux : feuillets 3×3 recto-verso, régions au recto d'un nouveau feuillet, familles compactes par région, formes régionales dans la région de leur forme et capacité auto avec 10 feuillets libres.",
      "features.trainers.title": "Trainer Cards",
      "features.trainers.text": "Crée une carte locale avec contacts optionnels, export fichier, import de Dresseurs reçus et carnet local qui partage uniquement tes doublons.",
      "features.badges.title": "Badges",
      "features.badges.text": "Débloque les badges Souvenirs de Kanto pour Rouge/Bleu champions d'arene, Conseil 4 et rival teams, Or/Argent pour Johto, Kanto, Peter et Silver, puis équipes de base sans remakes de Rubis/Saphir, Diamant/Perle, Noir/Blanc, Noir 2/Blanc 2, X/Y, Soleil/Lune, Epee/Bouclier et Ecarlate/Violet. La badge gallery garde les sealed badges jusqu'au déblocage et reste séparée des statistiques de collection.",
      "features.stats.title": "Statistiques",
      "features.stats.text": "Suis la progression Pokédex globale, régionale et par type sur une page dédiée aux chiffres de collection.",
      "features.data.title": "Données local-first",
      "features.data.text": "Garde un seul état local dans des fichiers JSON lisibles, puis exporte ou importe toute la collection comme sauvegarde versionnée.",
      "features.tour.title": "Tour produit",
      "features.tour.text": "Démarre avec un parcours en cinq étapes qui explique Capturé, Double, Dresseurs, imports manuels et fichiers locaux.",
      "features.docs.title": "App documentation",
      "features.docs.text": "Ouvre #/docs dans l'app locale pour le guide produit bilingue complet: installation, workflows, fichiers locaux, Trainer Cards, badges, raccourcis et API.",
      "features.api.title": "API REST locale",
      "features.api.text": "Utilise FastAPI local pour progression, badges, dresseurs, classeurs, export, import et données statiques des Pokédex des jeux.",
      "features.stance.kicker": "Position Pokédex-first",
      "features.stance.title": "Les fiches Pokémon restent centrées sur la capture.",
      "features.stance.text": "La version 1.6.3 garde la complétion en premier: la capture, les doublons, les filtres et les fiches Pokémon privilégient le statut Pokédex.",
      "features.actions.install": "Installer en local",
      "features.actions.trainers": "Lire le guide Cartes Dresseur",
      "features.actions.postponed": "Lire le backlog repoussé"
    },
    en: {
      "meta.title": "Pokevault - The Pokedex for real trades",
      "meta.description": "Pokevault is the local-first Pokedex for collectors who prefer real trades to the cloud.",
      "nav.main": "Main navigation",
      "nav.features": "Features",
      "nav.install": "Install",
      "nav.architecture": "Architecture",
      "nav.roadmap": "Roadmap",
      "nav.contribute": "Contribute",
      "nav.language": "Language",
      "landing.hero.shot_label": "Pokevault collection view screenshot",
      "landing.hero.shot_alt": "Pokevault collection grid with progress rail",
      "landing.hero.kicker": "pokevault",
      "landing.hero.title": "The collector Pokédex for people who prefer real trades to the cloud.",
      "landing.hero.lead": "Complete your Pokedex, organize your binders and trade Trainer Cards the old way: by file, without accounts, without servers, each person keeping their own local notebook. Like before: you complete, compare and trade. This time, everything stays with you.",
      "landing.hero.primary": "Start locally",
      "landing.hero.features": "Explore features",
      "landing.hero.source": "View source",
      "landing.metric.entries": "reference Pokedex entries including forms",
      "landing.metric.coverage": "required tracker backend line coverage",
      "landing.metric.accounts": "accounts or hosted databases required",
      "landing.why.kicker": "Why it exists",
      "landing.why.title": "A local notebook for the old adventure loop.",
      "landing.why.text": "Pokevault keeps the feeling of filling a Pokedex route after route: mark what you found, keep notes, compare with Trainers you meet, and keep every file on your machine.",
      "landing.feature.pokedex.title": "Pokedex-first",
      "landing.feature.pokedex.text": "Caught, Double and Release stay centered on each Pokemon entry; everything missing is implicit.",
      "landing.feature.trainers.title": "Trainer encounters",
      "landing.feature.trainers.text": "Meet other Trainers by importing their local card, then let Vu chez point out duplicates you still need.",
      "landing.feature.binders.title": "Binder-aware",
      "landing.feature.binders.text": "Model physical binders, 3×3 · 10 sheets defaults, family layouts, custom grids and printable checklists.",
      "landing.feature.local.title": "Local exchanges",
      "landing.feature.local.text": "Export Trainer Cards manually with optional contact links, import received cards into a searchable contact book and keep every file local-first.",
      "landing.screens.kicker": "Screenshots",
      "landing.screens.title": "One workspace for browsing, organizing and measuring progress.",
      "landing.screens.binder_alt": "Binder view with vault navigation and binder grid",
      "landing.screens.binder_caption": "Binder view for page-by-page physical collection planning.",
      "landing.screens.stats_alt": "Statistics view with completion metrics and progress cards",
      "landing.screens.stats_caption": "Statistics view with regional, type and collection progress.",
      "landing.quick.kicker": "Quick start",
      "landing.quick.title": "Run it locally in a few commands.",
      "landing.quick.copy": "Copy",
      "landing.quick.copied": "Copied",
      "landing.quick.install": "Read install guide",
      "landing.quick.readme": "Open README",
      "landing.footer.status": "Pokevault v1.6.3 · MIT licensed. Local-first by design.",
      "landing.footer.contribute": "Contribute",
      "landing.footer.security": "Security",
      "landing.footer.changelog": "Changelog",
      "landing.footer.portfolio": "Portfolio",
      "features.hero.kicker": "Product surface",
      "features.hero.title": "Features",
      "features.hero.text": "Pokevault starts with the Pokedex, then adds binders, local Trainer Cards, badges and local-first data workflows. Complete product documentation also lives inside the local app at #/docs. EN: public documentation in English.",
      "features.collection.title": "Collection workspace",
      "features.collection.text": "Browse the National Pokedex with region chips, narrative tags, fuzzy search, keyboard shortcuts and compact Caught, Double and Release actions backed by local progress JSON.",
      "features.fiches.title": "Pokemon modal",
      "features.fiches.text": "Open one modal for identity, artwork, Caught/Double/Release actions, linked forms, personal notes, types and game Pokedex appearances from data/game-pokedexes.json.",
      "features.cards.title": "Game Pokedex appearances",
      "features.cards.text": "See which regional game Pokedex definitions reference a Pokemon, starting from a compact local data file that can grow without new user state.",
      "features.binders.title": "Physical binder planner",
      "features.binders.text": "Create local binders with a 3×3 · 10 sheets default, sprites from Settings > Images / sprites, compact family rows such as Spoink / Grumpig / Spinda, and strict row alignment. Large 3×3 ring binder mode for one physical binder: 3×3 front/back sheets, region sections start on a new sheet front (recto), families stay compact per region, regional forms stay in their form region and auto capacity includes 10 spare sheets.",
      "features.trainers.title": "Trainer Cards",
      "features.trainers.text": "Create a local card with optional contacts, file export, received Trainer import and a local contact book that shares only duplicates.",
      "features.badges.title": "Badges",
      "features.badges.text": "Unlock Souvenirs de Kanto badges for Rouge/Bleu champions d'arene, Conseil 4 and rival teams, Or/Argent for Johto, Kanto, Peter and Silver, then base-version teams sans remakes from Rubis/Saphir, Diamant/Perle, Noir/Blanc, Noir 2/Blanc 2, X/Y, Soleil/Lune, Epee/Bouclier and Ecarlate/Violet. The badge gallery keeps sealed badges until unlock and stays separate from collection statistics.",
      "features.stats.title": "Stats",
      "features.stats.text": "Track global, regional and type Pokedex progress on a page dedicated to collection numbers.",
      "features.data.title": "Local-first data",
      "features.data.text": "Keep one local collection state in readable JSON files, then export or import the full collection as a versioned backup.",
      "features.tour.title": "Product tour",
      "features.tour.text": "Start with a compact five-step tour explaining Caught, Double, Trainers, manual imports and local files.",
      "features.docs.title": "App documentation",
      "features.docs.text": "Open #/docs in the local app for the complete bilingual product guide: setup, workflows, local files, Trainer Cards, badges, shortcuts and API.",
      "features.api.title": "Local REST API",
      "features.api.text": "Use the local FastAPI surface for progress, badges, trainers, binders, export, import and static game Pokedex data.",
      "features.stance.kicker": "Pokedex-first stance",
      "features.stance.title": "Pokemon entries stay centered on capture.",
      "features.stance.text": "Version 1.6.3 keeps completion workflows first: capture, duplicates, filters and Pokemon fiches prioritize Pokedex status.",
      "features.actions.install": "Install locally",
      "features.actions.trainers": "Read Trainer Cards guide",
      "features.actions.postponed": "Read postponed backlog"
    }
  };

  function normalizeLocale(locale) {
    return SUPPORTED[locale] ? locale : DEFAULT_LOCALE;
  }

  function getStoredLocale() {
    try {
      return normalizeLocale(localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE);
    } catch {
      return DEFAULT_LOCALE;
    }
  }

  function storeLocale(locale) {
    try {
      localStorage.setItem(STORAGE_KEY, normalizeLocale(locale));
    } catch {
      /* private mode */
    }
  }

  function t(key, locale) {
    var lang = normalizeLocale(locale || getStoredLocale());
    return (messages[lang] && messages[lang][key]) || messages.fr[key] || key;
  }

  function setText(selector, key, locale) {
    document.querySelectorAll(selector).forEach(function (node) {
      node.textContent = t(key, locale);
    });
  }

  function applyTranslations(locale) {
    var lang = normalizeLocale(locale || getStoredLocale());
    document.documentElement.lang = lang;
    if (document.documentElement.getAttribute("data-i18n-document") === "landing") {
      document.title = t("meta.title", lang);
      var metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) metaDescription.setAttribute("content", t("meta.description", lang));
    }

    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.getAttribute("data-i18n") || "", lang);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (node) {
      node.setAttribute("alt", t(node.getAttribute("data-i18n-alt") || "", lang));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (node) {
      node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria-label") || "", lang));
    });
    document.querySelectorAll("[data-i18n-locale]").forEach(function (button) {
      var active = button.getAttribute("data-i18n-locale") === lang;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("is-active", active);
    });
    setText("[data-copy]", "landing.quick.copy", lang);
  }

  function setLocale(locale) {
    var lang = normalizeLocale(locale);
    storeLocale(lang);
    applyTranslations(lang);
  }

  function wireLocaleSwitch() {
    document.querySelectorAll("[data-i18n-locale]").forEach(function (button) {
      button.addEventListener("click", function () {
        setLocale(button.getAttribute("data-i18n-locale") || DEFAULT_LOCALE);
      });
    });
  }

  function boot() {
    wireLocaleSwitch();
    applyTranslations();
  }

  window.PokevaultDocsI18n = {
    getLocale: getStoredLocale,
    setLocale: setLocale,
    t: t,
    applyTranslations: applyTranslations
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
