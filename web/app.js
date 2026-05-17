/**
 * Collection — liste et classeurs partagent la même progression (slug → attrapé).
 * Routage : #/liste et #/classeur.
 */

const API_PROGRESS = "/api/progress";
const API_HEALTH = "/api/health";
const API_DATA = "/api/data";
const API_BUNDLE = "/api/bundle";
const APP_VERSION = "1.7.0";
const PROGRESS_QUEUE_KEY = "pokedex_progress_queue";
const FORM_FILTER_STORAGE_KEY = "pokedexFormFilter";
const TYPE_FILTER_STORAGE_KEY = "pokedexTypeFilter";

const APP_FALLBACK_I18N = {
  "app.sync.progress_unavailable": "Progression fichier indisponible — lance « make dev » depuis la racine du projet.",
  "app.sync.pending": "{count} modification(s) en attente de synchro…",
  "app.sync.offline": "Hors ligne ou serveur indisponible — synchro différée.",
  "app.sync.exchange_failed": "Action d'échange non synchronisée : {message}.",
  "app.filters.all_regions": "Toutes les régions",
  "app.filters.all_types": "Tous les types",
  "app.narrative.clear": "Tout réinitialiser",
  "app.health.checking": "Application {version} · API vérification...",
  "app.health.status_checking": "État API : vérification...",
  "app.health.version_ok": "Application {version} · {apiStatus}",
  "app.health.status_ok": "État API : ok",
  "app.health.version_unavailable": "Application {version} · API indisponible",
  "app.health.status_error": "État API : erreur de connexion",
  "app.export.success": "Export : {caught} attrapés, {binders} classeurs.",
  "app.export.failed": "Échec export : {message}",
  "app.import.required": "Champs requis manquants",
  "app.import.unsupported": "Version de schéma non supportée",
  "app.import.preview": "{caught} attrapés, {binders} classeurs — export du {date}. Cela remplacera les données actuelles.",
  "app.import.invalid": "Fichier invalide: {message}",
  "app.import.success": "Import : {caught} attrapés, {binders} classeurs. Rechargement…",
  "app.import.failed": "Échec import : {message}",
  "app.settings.maintenance_status": "{references} · {local}",
  "app.settings.reference_file": "référence",
  "app.settings.reference_files": "références",
  "app.settings.local_file": "donnée locale",
  "app.settings.local_files": "données locales",
  "app.settings.maintenance_status_error": "Maintenance indisponible.",
  "app.settings.reset_confirm": "Supprimer progression, classeurs, contacts et préférences locales ? Les fichiers de référence seront conservés.",
  "app.settings.maintenance_refresh_success": "Références rafraîchies : {count}.",
  "app.settings.maintenance_refresh_empty": "Références déjà à jour.",
  "app.settings.maintenance_refresh_failed": "Échec du rafraîchissement : {message}",
  "app.settings.maintenance_reset_success": "Données locales supprimées : {count}. Rechargement...",
  "app.settings.maintenance_reset_failed": "Échec de suppression : {message}",
  "app.date.unknown": "inconnue",
  "app.list.silent": "Le Pokédex reste silencieux sur ce périmètre.",
  "app.list.display": "Affichage : 1-{end} sur {total} entrées filtrées · {pct}% capturées dans cette vue.",
  "app.list.end": "Fin de la liste — {total} entrées affichées.",
  "app.list.no_filter": "Aucun Pokémon ne correspond à ce filtre.",
  "app.card.unknown": "Inconnu",
  "app.card.region_form": "{region} · forme",
  "app.card.state_caught": ", attrapé",
  "app.card.state_seen": ", vu chez un dresseur",
  "app.card.state_missing": ", recherché ou manquant",
  "app.card.seen_contact": ", vu chez {count} contact",
  "app.card.action_caught": "Capturé",
  "app.card.seen_badge": "Vu chez {count}",
  "app.card.details": "Fiche",
  "app.card.open": "Ouvrir la fiche de {name}",
  "app.nav.docs": "Docs",
  "app.title.settings": "pokevault — Réglages",
};

function t(key, params = {}) {
  const raw = window.PokevaultI18n?.t?.(key, params) || APP_FALLBACK_I18N[key] || key;
  return String(raw).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
  ));
}

let allPokemon = [];
/**
 * Source of truth for the enriched Pokédex status (F03).
 * Keys are Pokémon slugs. Absence means `not_met`.
 * @type {Record<string, { state: "seen" | "caught"; seen_at?: string | null }>}
 */
let statusMap = Object.create(null);
/** Derived mirror kept in sync with `statusMap` for legacy consumers. */
let caughtMap = Object.create(null);
/** @type {Record<string, { text: string; updated_at?: string | null }>} */
let noteMap = Object.create(null);
let hideCaught = false;
let hideMissing = false;
let regionFilter = "all";
let searchQuery = "";
let totalCount = 0;
/** @type {"all" | "base_only" | "base_regional" | "regional_only"} */
let formFilterMode = "all";
let typeFilter = "all";
/** Multi-select narrative filter (F05) — set of tag ids. */
let narrativeTagFilter = new Set();
/** @type {Record<string, string[]>} */
let narrativeTagsByNumber = Object.create(null);
/** @type {Record<string, string>} */
let narrativeTagLabels = Object.create(null);
/** @type {string[]} */
let narrativeTagOrder = [];
const LIST_PAGE_SIZE = 48;
let displayedCount = LIST_PAGE_SIZE;
/** @type {IntersectionObserver | null} */
let listScrollObserver = null;
/** @type {{ id: string; label_fr: string; low: number; high: number }[]} */
let regionDefinitions = [];

let collectionBootstrapPromise = null;
const caughtUiListeners = new Set();

const DIM_STORAGE_KEY = "pokedexDimMode";
const CLIENT_STATE_STORAGE_KEYS = [
  DIM_STORAGE_KEY,
  FORM_FILTER_STORAGE_KEY,
  TYPE_FILTER_STORAGE_KEY,
  PROGRESS_QUEUE_KEY,
  "pokevault.ui.profile",
  "pokevault.ui.artwork",
  "pokedexPreferredRegion",
  "pokedexBinderWizardDismissed",
  "pokevault_locale",
];
const dimUiListeners = new Set();

/**
 * @returns {"caught" | "missing"}
 */
function getDimMode() {
  try {
    const v = localStorage.getItem(DIM_STORAGE_KEY);
    return v === "missing" ? "missing" : "caught";
  } catch {
    return "caught";
  }
}

/**
 * @param {"caught" | "missing"} mode
 */
function setDimMode(mode) {
  const m = mode === "missing" ? "missing" : "caught";
  try {
    localStorage.setItem(DIM_STORAGE_KEY, m);
  } catch {
    /* private mode */
  }
  for (const id of ["collectionDimSelect", "binderDimSelect"]) {
    const el = document.getElementById(id);
    if (el) el.value = m;
  }
  for (const cb of dimUiListeners) {
    try {
      cb(m);
    } catch {
      /* ignore */
    }
  }
}

function subscribeDimMode(cb) {
  dimUiListeners.add(cb);
  return () => dimUiListeners.delete(cb);
}

function wireDimModeSelectsOnce() {
  for (const id of ["collectionDimSelect", "binderDimSelect"]) {
    const sel = document.getElementById(id);
    if (!sel || sel.dataset.dimWired) continue;
    sel.dataset.dimWired = "1";
    sel.value = getDimMode();
    sel.addEventListener("change", () => setDimMode(sel.value === "missing" ? "missing" : "caught"));
  }
}

async function loadBundle() {
  try {
    const res = await fetch(API_BUNDLE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bundle = await res.json();
    
    // 1. I18n
    if (bundle.i18n && window.PokevaultI18n) {
      window.PokevaultI18n.loadMessages(bundle.i18n);
    }
    
    // 2. Pokedex & Tags
    if (bundle.pokedex) {
      allPokemon = Array.isArray(bundle.pokedex.pokemon) ? bundle.pokedex.pokemon : [];
      regionDefinitions = Array.isArray(bundle.pokedex.meta?.regions) ? bundle.pokedex.meta.regions : [];
      totalCount = bundle.pokedex.meta?.total ?? allPokemon.length;
      
      // Narrative Tags
      const tags = bundle.narrative_tags || {};
      const rawLabels = tags.labels && typeof tags.labels === "object" ? tags.labels : {};
      narrativeTagLabels = Object.create(null);
      narrativeTagOrder = [];
      for (const [id, label] of Object.entries(rawLabels)) {
        narrativeTagLabels[id] = label;
        narrativeTagOrder.push(id);
      }
      const rawTags = tags.tags_by_number && typeof tags.tags_by_number === "object" ? tags.tags_by_number : {};
      narrativeTagsByNumber = Object.create(null);
      for (const [num, ts] of Object.entries(rawTags)) {
        narrativeTagsByNumber[num] = ts;
      }
    }
    
    // 3. Game Pokedexes
    if (bundle.game_pokedexes && window.PokevaultPokemonModal) {
      window.PokevaultPokemonModal.setData(bundle.game_pokedexes);
    }
    
    // 4. Badges
    if (bundle.badges && window.PokevaultBadges) {
      window.PokevaultBadges.setData(bundle.badges);
    }
    
    // 5. Evolution Families
    if (bundle.evolution_families) {
      window.PokevaultEvolutionFamilies = bundle.evolution_families;
    }

    return true;
  } catch (err) {
    console.error("Failed to load data bundle", err);
    return false;
  }
}

async function getCollectionBootstrap() {
  if (collectionBootstrapPromise) return collectionBootstrapPromise;
  collectionBootstrapPromise = (async () => {
    await loadBundle();

    let progress = { caught: {}, statuses: {}, notes: {} };
    try {
      progress = await fetchProgressFile();
    } catch {
      const hint = document.getElementById("syncHint");
      if (hint) {
        hint.textContent = t("app.sync.progress_unavailable");
        hint.hidden = false;
      }
    }
    hydrateProgressMaps(progress);
    
    fillRegionSelect();
    fillTypeSelect();
    renderRegionChips();
    renderNarrativeChips();
    
    return allPokemon;
  })();
  return collectionBootstrapPromise;
}

function fillRegionSelect() {
  const sel = document.getElementById("regionFilter");
  if (!sel) return;
  sel.replaceChildren();
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = t("app.filters.all_regions");
  sel.append(optAll);
  for (const reg of regionDefinitions) {
    const opt = document.createElement("option");
    opt.value = reg.id;
    opt.textContent = reg.label_fr;
    sel.append(opt);
  }
}

function fillTypeSelect() {
  const sel = document.getElementById("typeFilter");
  if (!sel) return;
  const types = new Set();
  for (const p of allPokemon) {
    if (Array.isArray(p.types)) {
      for (const ty of p.types) if (ty) types.add(ty);
    }
  }
  sel.replaceChildren();
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = t("app.filters.all_types");
  sel.append(optAll);
  for (const ty of Array.from(types).sort()) {
    const opt = document.createElement("option");
    opt.value = ty;
    opt.textContent = ty;
    sel.append(opt);
  }
}

function renderRegionChips() {
  const host = document.getElementById("regionChips");
  if (!host) return;
  host.replaceChildren();
  const btnAll = document.createElement("button");
  btnAll.type = "button";
  btnAll.className = `region-chip ${regionFilter === "all" ? "is-active" : ""}`;
  btnAll.dataset.region = "all";
  btnAll.textContent = t("app.filters.all_regions");
  host.append(btnAll);
  for (const reg of regionDefinitions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `region-chip ${regionFilter === reg.id ? "is-active" : ""}`;
    btn.dataset.region = reg.id;
    btn.textContent = reg.label_fr;
    host.append(btn);
  }
}

function renderNarrativeChips() {
  const host = document.getElementById("narrativeChips");
  if (!host) return;
  host.replaceChildren();
  for (const id of narrativeTagOrder) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `region-chip region-chip--narrative ${narrativeTagFilter.has(id) ? "is-active" : ""}`;
    btn.dataset.tag = id;
    btn.textContent = narrativeTagLabels[id];
    host.append(btn);
  }
}

function pokemonKey(p) {
  return p.slug || "";
}

function nationalNum(p) {
  const raw = String(p.number || "").replace("#", "").strip();
  return Number.parseInt(raw.replace(/^0+/, "") || "0", 10);
}

function effectiveRegion(p) {
  return p.region || p.region_dex || "";
}

function matchesFilter(p) {
  const k = pokemonKey(p);
  const status = window.PokevaultFilters?.statusForPokemon?.(k, caughtMap, statusMap) || {
    state: caughtMap[k] ? "caught" : "not_met",
  };
  const got = status.state === "caught";
  if (hideCaught && got) return false;
  if (hideMissing && !got) return false;
  return true;
}

function matchesSearch(p, q) {
  const qn = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!qn) return true;
  const num = String(p.number || "").replace(/^#/, "").replace(/^0+/, "");
  const form = p.form || "";
  const names = p.names || {};
  const types = Array.isArray(p.types) ? p.types : [];
  const fields = [
    String(p.number || ""),
    num,
    form,
    names.fr,
    names.en,
    names.ja,
    p.slug,
    ...types,
  ].filter(Boolean).map(s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  return fields.some(f => f.includes(qn));
}

function matchesRegion(p) {
  if (regionFilter === "all") return true;
  return effectiveRegion(p) === regionFilter;
}

function matchesType(p) {
  if (typeFilter === "all") return true;
  return Array.isArray(p.types) && p.types.includes(typeFilter);
}

function matchesNarrativeTags(p) {
  if (!narrativeTagFilter.size) return true;
  const tags = narrativeTagsByNumber[String(nationalNum(p))] || [];
  for (const active of narrativeTagFilter) {
    if (tags.includes(active)) return true;
  }
  return false;
}

function matchesFormScope(p) {
  if (formFilterMode === "all") return true;
  const B = window.PokedexBinder;
  if (!B) return true;
  const rule = B.formRuleFromScope(formFilterMode);
  return B.matchesFormRule(p, rule);
}

function visibleList() {
  return allPokemon.filter(
    (p) =>
      matchesSearch(p, searchQuery) &&
      matchesFilter(p) &&
      matchesRegion(p) &&
      matchesType(p) &&
      matchesNarrativeTags(p) &&
      matchesFormScope(p)
  );
}

function slicedVisibleList() {
  const full = visibleList();
  const total = full.length;
  const end = Math.min(displayedCount, total);
  return {
    full,
    pageItems: full.slice(0, end),
    total,
    end,
  };
}

function resetDisplayedCount() {
  displayedCount = LIST_PAGE_SIZE;
  const end = document.getElementById("listScrollEnd");
  if (end) end.hidden = true;
}

function updateListDisplayInfo({ end, total }) {
  const el = document.getElementById("listDisplayInfo");
  if (!el) return;
  const pct = total ? Math.round((end / total) * 100) : 0;
  el.textContent = t("app.list.display", { end, total, pct });
}

function showDexError(grid) {
  grid.replaceChildren();
  const ES = window.PokevaultEmptyStates;
  if (ES?.render) {
    ES.render(grid, "listLoadError");
  }
}

function createPokemonCard(p) {
  const card = document.createElement("article");
  card.className = "pokemon-card";
  const k = pokemonKey(p);
  const status = statusMap[k] || { state: "not_met" };
  const got = status.state === "caught";
  if (got) card.classList.add("is-caught");

  const top = document.createElement("div");
  top.className = "pokemon-card-top";

  const num = document.createElement("span");
  num.className = "pokemon-number";
  num.textContent = p.number;

  const artwork = document.createElement("div");
  artwork.className = "pokemon-artwork";
  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = "";
  if (window.PokevaultArtwork) {
    window.PokevaultArtwork.attach(img, window.PokevaultArtwork.resolve(p));
  } else {
    img.src = p.image || "";
  }
  artwork.append(img);

  const name = document.createElement("h2");
  name.className = "pokemon-name";
  name.textContent = p.names?.fr || p.names?.en || p.slug;

  card.append(top, artwork, name);

  card.addEventListener("click", () => {
    if (window.PokevaultPokemonModal) {
      window.PokevaultPokemonModal.open(p.slug);
    }
  });

  return card;
}

function render() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  const sliced = slicedVisibleList();
  const list = sliced.pageItems;

  const scrollY = window.scrollY;
  const currentHeight = grid.offsetHeight;
  grid.style.minHeight = `${currentHeight}px`;

  grid.replaceChildren();
  if (!sliced.total) {
    grid.style.minHeight = "";
    const ES = window.PokevaultEmptyStates;
    if (ES?.render) {
      ES.render(grid, "listNoMatch");
    }
    updateListDisplayInfo({ end: 0, total: 0 });
    return;
  }

  const frag = document.createDocumentFragment();
  for (const p of list) frag.append(createPokemonCard(p));
  grid.append(frag);

  grid.style.minHeight = "";
  if (window.scrollY !== scrollY) {
    window.scrollTo(0, scrollY);
  }

  updateListDisplayInfo({ end: sliced.end, total: sliced.total });
}

async function fetchProgressFile() {
  const res = await fetch(API_PROGRESS);
  if (!res.ok) throw new Error("progress");
  return res.json();
}

function hydrateProgressMaps(progress) {
  statusMap = Object.create(null);
  caughtMap = Object.create(null);
  noteMap = Object.create(null);
  if (progress.statuses) {
    for (const [k, s] of Object.entries(progress.statuses)) {
      statusMap[k] = s;
      if (s.state === "caught") caughtMap[k] = true;
    }
  }
  if (progress.notes) noteMap = progress.notes;
}

function setupInfiniteScroll() {
  const sentinel = document.getElementById("listScrollSentinel");
  if (!sentinel) return;
  listScrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      const current = visibleList().length;
      if (displayedCount < current) {
        displayedCount += LIST_PAGE_SIZE;
        render();
      } else {
        const end = document.getElementById("listScrollEnd");
        if (end && current > 0) {
          end.textContent = t("app.list.end", { total: current });
          end.hidden = false;
        }
      }
    }
  }, { rootMargin: "400px" });
  listScrollObserver.observe(sentinel);
}

function setupSearch() {
  const input = document.getElementById("search");
  if (!input) return;
  input.addEventListener("input", () => {
    searchQuery = input.value;
    resetDisplayedCount();
    render();
  });
}

function setupFilters() {
  const buttons = document.querySelectorAll("#viewListe .filter-btn[data-filter]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.filter;
      if (f === "hide_caught") hideCaught = !hideCaught;
      if (f === "hide_missing") hideMissing = !hideMissing;
      
      btn.classList.toggle("is-active", f === "hide_caught" ? hideCaught : hideMissing);
      btn.setAttribute("aria-pressed", String(btn.classList.contains("is-active")));
      
      resetDisplayedCount();
      render();
    });
  });

  const regSel = document.getElementById("regionFilter");
  if (regSel) {
    regSel.addEventListener("change", () => {
      regionFilter = regSel.value;
      renderRegionChips();
      resetDisplayedCount();
      render();
    });
  }

  const hostChips = document.getElementById("regionChips");
  if (hostChips) {
    hostChips.addEventListener("click", (e) => {
      const btn = e.target.closest(".region-chip");
      if (!btn || !btn.dataset.region) return;
      regionFilter = btn.dataset.region;
      if (regSel) regSel.value = regionFilter;
      renderRegionChips();
      resetDisplayedCount();
      render();
    });
  }
}

async function setPokemonOwnershipState(slug, nextState) {
  const res = await fetch(`${API_PROGRESS}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, state: nextState }),
  });
  if (res.ok) {
    const progress = await fetchProgressFile();
    hydrateProgressMaps(progress);
    render();
    for (const l of caughtUiListeners) l();
  }
}

window.PokedexCollection = {
  get allPokemon() { return allPokemon; },
  getStatus(slug) { return statusMap[slug] || { state: "not_met" }; },
  subscribeCaught(l) { caughtUiListeners.add(l); return () => caughtUiListeners.delete(l); },
  setPokemonOwnershipState,
  ensureLoaded: async () => { if (!collectionBootstrapPromise) await getCollectionBootstrap(); },
};

function currentViewFromHash() {
  const h = window.location.hash || "#/liste";
  if (h.startsWith("#/classeur")) return "classeur";
  if (h.startsWith("#/badges")) return "badges";
  if (h.startsWith("#/stats")) return "stats";
  if (h.startsWith("#/dresseurs")) return "trainers";
  if (h.startsWith("#/docs")) return "docs";
  if (h.startsWith("#/settings")) return "settings";
  return "liste";
}

function applyAppRoute() {
  const view = currentViewFromHash();
  const views = ["viewListe", "viewBadges", "viewStats", "viewClasseur", "viewDresseurs", "viewDocs", "viewSettings"];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = (id !== `view${view.charAt(0).toUpperCase()}${view.slice(1)}`);
  });
  
  if (view === "badges" && window.PokevaultBadges) window.PokevaultBadges.setData(); // Force re-render with local data
}

window.addEventListener("hashchange", applyAppRoute);

void (async () => {
  await getCollectionBootstrap();
  setupSearch();
  setupFilters();
  setupInfiniteScroll();
  applyAppRoute();
})();
