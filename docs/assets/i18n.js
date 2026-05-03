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
      "landing.hero.shot_alt": "Grille de collection Pokevault avec progression et cartes Pokemon",
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
      "landing.feature.pokedex.text": "Cherche, Capturé et Double restent centrés sur chaque Pokémon pour garder l’objectif simple : compléter ton Pokédex.",
      "landing.feature.trainers.title": "Rencontres Dresseur",
      "landing.feature.trainers.text": "Importe la carte locale d’un autre Dresseur, puis laisse Vu chez et Match révéler les échanges possibles.",
      "landing.feature.binders.title": "Pensé classeurs",
      "landing.feature.binders.text": "Modélise tes classeurs physiques, le défaut 3×3 · 10 feuillets, les familles d’évolution, les grilles custom et les checklists imprimables.",
      "landing.feature.local.title": "Échanges locaux",
      "landing.feature.local.text": "Exporte tes Cartes Dresseur à la main avec liens de contact optionnels, importe celles qu’on t’envoie dans un carnet consultable et garde tout en local-first.",
      "landing.screens.kicker": "Captures",
      "landing.screens.title": "Un espace pour parcourir, ranger et mesurer ta progression.",
      "landing.screens.binder_alt": "Vue classeur avec navigation de coffres et grille de cartes",
      "landing.screens.binder_caption": "Vue classeur pour planifier ta collection physique page par page.",
      "landing.screens.stats_alt": "Vue statistiques avec métriques de complétion et cartes de progression",
      "landing.screens.stats_caption": "Vue statistiques avec progression régionale, badges et prochaines actions.",
      "landing.quick.kicker": "Démarrage rapide",
      "landing.quick.title": "Lance-le en local en quelques commandes.",
      "landing.quick.copy": "Copier",
      "landing.quick.copied": "Copié",
      "landing.quick.install": "Lire le guide d’installation",
      "landing.quick.readme": "Ouvrir le README",
      "landing.footer.status": "Pokevault v1.2.0 · MIT. Local-first par design.",
      "landing.footer.contribute": "Contribuer",
      "landing.footer.security": "Sécurité",
      "landing.footer.changelog": "Changelog",
      "landing.footer.portfolio": "Portfolio"
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
      "landing.hero.shot_alt": "Pokevault collection grid with progress rail and Pokemon cards",
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
      "landing.feature.pokedex.text": "Wanted, Caught and Double stay centered on each Pokemon entry so the main goal stays simple: complete your Pokedex.",
      "landing.feature.trainers.title": "Trainer encounters",
      "landing.feature.trainers.text": "Meet other Trainers by importing their local card, then let Vu chez and Match reveal possible exchanges.",
      "landing.feature.binders.title": "Binder-aware",
      "landing.feature.binders.text": "Model physical binders, 3×3 · 10 feuillets defaults, family layouts, custom grids and printable checklists.",
      "landing.feature.local.title": "Local exchanges",
      "landing.feature.local.text": "Export Trainer Cards manually with optional contact links, import received cards into a searchable contact book and keep every file local-first.",
      "landing.screens.kicker": "Screenshots",
      "landing.screens.title": "One workspace for browsing, organizing and measuring progress.",
      "landing.screens.binder_alt": "Binder view with vault navigation and binder grid",
      "landing.screens.binder_caption": "Binder view for page-by-page physical collection planning.",
      "landing.screens.stats_alt": "Statistics view with completion metrics and progress cards",
      "landing.screens.stats_caption": "Statistics view with regional progress, badges and next actions.",
      "landing.quick.kicker": "Quick start",
      "landing.quick.title": "Run it locally in a few commands.",
      "landing.quick.copy": "Copy",
      "landing.quick.copied": "Copied",
      "landing.quick.install": "Read install guide",
      "landing.quick.readme": "Open README",
      "landing.footer.status": "Pokevault v1.2.0 · MIT licensed. Local-first by design.",
      "landing.footer.contribute": "Contribute",
      "landing.footer.security": "Security",
      "landing.footer.changelog": "Changelog",
      "landing.footer.portfolio": "Portfolio"
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
