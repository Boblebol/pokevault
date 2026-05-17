/**
 * Collection — liste et classeurs partagent la même progression (slug → attrapé).
 * Routage : #/liste et #/classeur.
 */

const API_PROGRESS = "/api/progress";
const API_HEALTH = "/api/health";
const API_DATA = "/api/data";
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

async function getCollectionBootstrap() {
  if (collectionBootstrapPromise) return collectionBootstrapPromise;
  collectionBootstrapPromise = (async () => {
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

    const dexRes = await fetch("/data/pokedex.json");
    const grid = document.getElementById("grid");
    if (!dexRes.ok) {
      if (grid) showDexError(grid);
      throw new Error("dex");
    }
    const dex = await dexRes.json();
    allPokemon = Array.isArray(dex) ? dex : dex.pokemon || [];
    totalCount = dex.meta?.total ?? allPokemon.length;
    regionDefinitions = Array.isArray(dex.meta?.regions) ? dex.meta.regions : [];
    await loadNarrativeTags();
    fillRegionSelect();
    fillTypeSelect();
    const pending = loadProgressQueue();
    if (pending.length > 0) {
      const hint = document.getElementById("syncHint");
      if (hint) {
        hint.textContent = t("app.sync.pending", { count: pending.length });
        hint.hidden = false;
      }
    }
    return true;
  })().catch((err) => {
    collectionBootstrapPromise = null;
    throw err;
  });
  return collectionBootstrapPromise;
}

function loadProgressQueue() {
  try {
    const raw = localStorage.getItem(PROGRESS_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProgressQueue(q) {
  try {
    localStorage.setItem(PROGRESS_QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* private mode */
  }
}

async function flushOfflineProgressQueue() {
  const hint = document.getElementById("syncHint");
  const q = loadProgressQueue();
  let rest = q;
  while (rest.length > 0) {
    const item = rest[0];
    try {
      const res = await fetch(endpointForQueueItem(item), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyForQueueItem(item)),
      });
      if (!res.ok) throw new Error(String(res.status));
      rest = rest.slice(1);
      saveProgressQueue(rest);
    } catch {
      if (hint && rest.length > 0) {
        hint.textContent = t("app.sync.pending", { count: rest.length });
        hint.hidden = false;
      }
      return;
    }
  }
  if (hint) hint.hidden = true;
}

function endpointForQueueItem(item) {
  if (item && item.kind === "status") return `${API_PROGRESS}/status`;
  if (item && item.kind === "note") return `${API_PROGRESS}/notes`;
  return API_PROGRESS;
}

function bodyForQueueItem(item) {
  if (item && item.kind === "status") {
    return { slug: item.slug, state: item.state };
  }
  if (item && item.kind === "note") {
    return { slug: item.slug, note: String(item.note || "") };
  }
  return { slug: item.slug, caught: Boolean(item.caught) };
}

async function persistStatusPatch(slug, state) {
  const hint = document.getElementById("syncHint");
  try {
    const res = await fetch(`${API_PROGRESS}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, state }),
    });
    if (!res.ok) throw new Error(String(res.status));
    await flushOfflineProgressQueue();
    if (hint) hint.hidden = true;
  } catch {
    const q = loadProgressQueue();
    q.push({ kind: "status", slug, state, ts: Date.now() });
    saveProgressQueue(q);
    if (hint) {
      hint.textContent = t("app.sync.offline");
      hint.hidden = false;
    }
  }
}

async function persistNotePatch(slug, note) {
  const hint = document.getElementById("syncHint");
  const text = normalizeNoteText(note);
  try {
    const res = await fetch(`${API_PROGRESS}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, note: text }),
    });
    if (!res.ok) throw new Error(String(res.status));
    await flushOfflineProgressQueue();
    if (hint) hint.hidden = true;
  } catch {
    const q = loadProgressQueue();
    q.push({ kind: "note", slug, note: text, ts: Date.now() });
    saveProgressQueue(q);
    if (hint) {
      hint.textContent = t("app.sync.offline");
      hint.hidden = false;
    }
  }
}

/**
 * @param {{ caught?: Record<string, unknown>; statuses?: Record<string, unknown>; notes?: Record<string, unknown> }} payload
 */
function hydrateProgressMaps(payload) {
  statusMap = Object.create(null);
  caughtMap = Object.create(null);
  noteMap = Object.create(null);
  const notes = payload && typeof payload.notes === "object" ? payload.notes : null;
  if (notes) {
    for (const [slug, raw] of Object.entries(notes)) {
      if (!slug || !raw || typeof raw !== "object") continue;
      const text = normalizeNoteText(raw.text);
      if (!text) continue;
      const updatedAt = typeof raw.updated_at === "string" ? raw.updated_at : null;
      noteMap[slug] = { text, updated_at: updatedAt };
    }
  }
  const statuses = payload && typeof payload.statuses === "object" ? payload.statuses : null;
  if (statuses) {
    for (const [slug, raw] of Object.entries(statuses)) {
      if (!slug || !raw || typeof raw !== "object") continue;
      const state = raw.state === "seen" || raw.state === "caught" ? raw.state : null;
      if (!state) continue;
      const seenAt = typeof raw.seen_at === "string" ? raw.seen_at : null;
      statusMap[slug] = { state, seen_at: seenAt };
      if (state === "caught") caughtMap[slug] = true;
    }
    return;
  }
  const rawCaught = payload && typeof payload.caught === "object" ? payload.caught : {};
  for (const [k, v] of Object.entries(rawCaught)) {
    if (!v) continue;
    statusMap[k] = { state: "caught", seen_at: null };
    caughtMap[k] = true;
  }
}

/** @returns {{ state: "not_met" | "seen" | "caught" }} */
function getStatus(slug) {
  const s = statusMap[slug];
  if (!s) return { state: "not_met" };
  return { state: s.state };
}

function normalizeNoteText(value) {
  return String(value || "").trim().slice(0, 500);
}

function getNote(slug) {
  return noteMap[String(slug || "")]?.text || "";
}

function setNote(slug, note) {
  const key = String(slug || "").trim();
  if (!key) return Promise.resolve();
  const text = normalizeNoteText(note);
  if (text) {
    noteMap[key] = { text, updated_at: new Date().toISOString() };
  } else {
    delete noteMap[key];
  }
  return persistNotePatch(key, text);
}

/**
 * Persists a status change for a slug and broadcasts to listeners.
 * Passing `state: "not_met"` removes the entry.
 *
 * @param {string} slug
 * @param {"not_met" | "seen" | "caught"} state
 */
function setStatus(slug, state) {
  if (!slug) return;
  if (state === "not_met") {
    delete statusMap[slug];
    delete caughtMap[slug];
  } else {
    const prev = statusMap[slug];
    const seenAt = prev?.seen_at || new Date().toISOString();
    statusMap[slug] = { state, seen_at: seenAt };
    if (state === "caught") caughtMap[slug] = true;
    else delete caughtMap[slug];
  }
  void persistStatusPatch(slug, state);
  for (const cb of caughtUiListeners) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Backward-compatible shortcut entry point.
 * Plain `c` toggles `Capturé`; Shift+C toggles `Plusieurs exemplaires`.
 *
 * @param {string} slug
 * @param {{ shift?: boolean }} [opts]
 */
function cycleStatusBySlug(slug, opts) {
  if (!slug) return;
  cycleOwnershipBySlug(slug, opts);
}

/** Legacy helper kept for binder/stats: toggles the `caught` bit only. */
function toggleCaughtBySlug(slug) {
  if (!slug) return;
  const current = getStatus(slug);
  if (current.state === "caught") {
    setStatus(slug, "not_met");
  } else {
    setStatus(slug, "caught");
  }
}

function emptyTradeSummary() {
  return { availableFrom: [], wantedBy: [], matchCount: 0, canHelpCount: 0 };
}

function tradeSummaryForSlug(slug) {
  try {
    return window.PokevaultTrainerContacts?.tradeSummary?.(slug) || emptyTradeSummary();
  } catch {
    return emptyTradeSummary();
  }
}

function ownershipStateForSlug(slug) {
  const key = String(slug || "").trim();
  const fiche = window.PokevaultPokemonFiche;
  if (fiche?.ownershipStateFromSources) {
    return fiche.ownershipStateFromSources(key, {
      status: getStatus(key),
      ownCard: window.PokevaultTrainerContacts?.getOwnCard?.() || null,
    });
  }
  const status = getStatus(key);
  return { caught: status.state === "caught", duplicate: false };
}

function shouldDimCardForHighlight(mode, ownership) {
  const caught = Boolean(ownership?.caught);
  return mode === "missing" ? !caught : caught;
}

function showOwnershipSyncError(err) {
  const hint = document.getElementById("syncHint");
  if (hint) {
    hint.textContent = t("app.sync.exchange_failed", { message: err?.message || err || "erreur inconnue" });
    hint.hidden = false;
  }
}

async function setPokemonOwnershipState(slug, nextState) {
  const key = String(slug || "").trim();
  if (!key) return;
  const tasks = [];

  if (nextState === "add") {
    const isFirst = !ownershipStateForSlug(key).caught;
    setStatus(key, "caught");
    if (!isFirst) {
      tasks.push(window.PokevaultTrainerContacts?.adjustOwnListCount?.(key, "for_trade", 1));
    }
  } else if (nextState === "remove") {
    setStatus(key, "caught");
    tasks.push(window.PokevaultTrainerContacts?.adjustOwnListCount?.(key, "for_trade", -1));
  } else if (nextState === "release_all") {
    setStatus(key, "not_met");
    tasks.push(window.PokevaultTrainerContacts?.clearOwnListMembership?.(key, "for_trade"));
  }

  try {
    await Promise.all(tasks);
  } catch (err) {
    console.error("ownership update failed", err);
    showOwnershipSyncError(err);
  } finally {
    resetDisplayedCount();
    render();
  }
}

function cycleOwnershipBySlug(slug, opts) {
  if (!slug) return;
  const current = ownershipStateForSlug(slug);
  const shift = Boolean(opts?.shift);
  // Plain click: Capture -> Release (all)
  // Shift+click: Add -> Remove
  let next = "add";
  if (shift) {
    next = current.count > 1 ? "remove" : "add";
  } else {
    next = current.caught ? "release_all" : "add";
  }
  void setPokemonOwnershipState(slug, next);
}

function availableTypeIds() {
  const ids = new Set();
  for (const p of allPokemon) {
    for (const t of p.types || []) {
      if (t) ids.add(String(t));
    }
  }
  return [...ids];
}

function currentFilterState() {
  return {
    hideCaught,
    hideMissing,
    region: regionFilter,
    forms: formFilterMode,
    type: typeFilter,
    tags: [...narrativeTagFilter],
  };
}

function filterHashOptions() {
  return {
    regionIds: regionDefinitions.map((r) => String(r.id)),
    typeIds: availableTypeIds(),
    tagIds: narrativeTagOrder,
  };
}

function writeFiltersToHash() {
  const next = window.PokevaultFilters?.buildFilterHash?.(
    location.hash || "#/liste",
    currentFilterState(),
    filterHashOptions(),
  );
  if (next && location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

function readFiltersFromHash() {
  return window.PokevaultFilters?.parseFilterHash?.(
    location.hash || "#/liste",
    filterHashOptions(),
  )?.filters || currentFilterState();
}

function applyFilterState(filters) {
  const clean = window.PokevaultFilters?.normalizeFilterState?.(
    filters || {},
    filterHashOptions(),
  ) || filters || {};
  hideCaught = clean.hideCaught === true;
  hideMissing = clean.hideMissing === true;
  regionFilter = clean.region || "all";
  formFilterMode = clean.forms || "all";
  typeFilter = clean.type || "all";
  narrativeTagFilter = new Set(clean.tags || []);
}

function syncFilterControlsFromState() {
  const regionSel = document.getElementById("regionFilter");
  if (regionSel) regionSel.value = regionFilter;
  const typeSel = document.getElementById("typeFilter");
  if (typeSel) typeSel.value = typeFilter;
  const formSel = document.getElementById("formFilter");
  if (formSel) formSel.value = formFilterMode;
  syncQuickFilterButtons();
  syncRegionChipsActive();
  renderNarrativeChips();
}

window.PokedexCollection = {
  ensureLoaded: () => getCollectionBootstrap(),
  get caughtMap() {
    return caughtMap;
  },
  get allPokemon() {
    return allPokemon;
  },
  get regionDefinitions() {
    return regionDefinitions;
  },
  subscribeCaught(cb) {
    caughtUiListeners.add(cb);
    return () => caughtUiListeners.delete(cb);
  },
  toggleCaughtBySlug,
  getStatus,
  setStatus,
  getNote,
  setNote,
  matchesSearch,
  cycleStatusBySlug,
  cycleOwnershipBySlug,
  ownershipStateForSlug,
  setPokemonOwnershipState,
  tradeSummaryForSlug,
  get statusMap() {
    return statusMap;
  },
  get noteMap() {
    return noteMap;
  },
  getDimMode,
  setDimMode,
  subscribeDimMode,
  wireDimModeSelectsOnce,
};
window.PokevaultMeta = { version: APP_VERSION };

function appVersionLabel() {
  return `v${APP_VERSION}`;
}

function paintVersionLabels() {
  const topBadge = document.getElementById("appVersionBadge");
  if (topBadge) topBadge.textContent = appVersionLabel();
  const footerLabel = document.getElementById("footerVersionLabel");
  if (footerLabel) footerLabel.textContent = appVersionLabel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", paintVersionLabels, { once: true });
} else {
  paintVersionLabels();
}

function pokemonKey(p) {
  return p.slug;
}

function displayNumber(num) {
  const n = String(num || "").replace(/^#/, "");
  const stripped = n.replace(/^0+/, "") || "0";
  return `#${stripped}`;
}

function displayName(p) {
  const n = p.names || {};
  return n.fr || n.en || n.ja || p.slug || "?";
}

function normalizePath(img) {
  if (!img) return null;
  const s = String(img).replace(/^\.\//, "");
  if (s.startsWith("http")) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

function nationalNum(p) {
  const s = String(p.number || "").replace(/^#/, "").replace(/^0+/, "") || "0";
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function inferRegionFromNumber(n, defs) {
  for (const r of defs) {
    if (r.low <= n && n <= r.high) return r.id;
  }
  return "unknown";
}

function effectiveRegion(p) {
  if (p.region) return p.region;
  return inferRegionFromNumber(nationalNum(p), regionDefinitions);
}

async function fetchProgressFile() {
  const res = await fetch(API_PROGRESS);
  if (!res.ok) throw new Error(`progress ${res.status}`);
  const data = await res.json();
  return {
    caught: data && typeof data.caught === "object" ? data.caught : {},
    statuses: data && typeof data.statuses === "object" ? data.statuses : {},
  };
}

function normalizeSearchToken(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Levenshtein distance with an early-exit upper bound. Returns `maxDist + 1`
 * as soon as the minimum possible distance exceeds `maxDist`.
 */
function levenshtein(a, b, maxDist) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  if (Math.abs(m - n) > maxDist) return maxDist + 1;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Diacritic-insensitive + fuzzy (Levenshtein ≤ 2) per-word match.
 * Also matches on the national number and on type names (kept as-is for
 * queries like "feu" or "psy").
 */
function matchesSearch(p, q) {
  const qn = normalizeSearchToken(q);
  if (!qn) return true;
  const num = String(p.number || "").replace(/^#/, "").replace(/^0+/, "");
  const form = p.form || "";
  const names = p.names || {};
  const types = Array.isArray(p.types) ? p.types : [];
  const fieldsRaw = [
    String(p.number || ""),
    num,
    form,
    names.fr,
    names.en,
    names.ja,
    p.slug,
    ...types,
  ].filter(Boolean);
  const blob = normalizeSearchToken(fieldsRaw.join(" "));
  if (blob.includes(qn)) return true;
  if (qn.length < 3) return false;
  const words = blob.split(/[^a-z0-9]+/).filter(Boolean);
  const maxDist = qn.length <= 4 ? 1 : 2;
  for (const w of words) {
    if (w.length < 3) continue;
    if (levenshtein(w, qn, maxDist) <= maxDist) return true;
    if (w.length > qn.length && levenshtein(w.slice(0, qn.length), qn, maxDist) <= maxDist) {
      return true;
    }
  }
  return false;
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

async function loadNarrativeTags() {
  try {
    const res = await fetch("/data/narrative-tags.json");
    if (!res.ok) return;
    const data = await res.json();
    if (!data || typeof data !== "object") return;
    const rawLabels = data.labels && typeof data.labels === "object" ? data.labels : {};
    narrativeTagLabels = Object.create(null);
    narrativeTagOrder = [];
    for (const [id, label] of Object.entries(rawLabels)) {
      if (typeof id !== "string" || typeof label !== "string") continue;
      narrativeTagLabels[id] = label;
      narrativeTagOrder.push(id);
    }
    const raw = data.tags_by_number && typeof data.tags_by_number === "object"
      ? data.tags_by_number
      : {};
    narrativeTagsByNumber = Object.create(null);
    for (const [num, tags] of Object.entries(raw)) {
      if (!Array.isArray(tags)) continue;
      const clean = tags.filter((t) => typeof t === "string" && narrativeTagLabels[t]);
      if (clean.length) narrativeTagsByNumber[num] = clean;
    }
  } catch {
    narrativeTagsByNumber = Object.create(null);
    narrativeTagLabels = Object.create(null);
    narrativeTagOrder = [];
  }
}

function narrativeTagsFor(p) {
  const n = nationalNum(p);
  return narrativeTagsByNumber[String(n)] || [];
}

function matchesNarrativeTags(p) {
  if (!narrativeTagFilter.size) return true;
  const tags = narrativeTagsFor(p);
  if (!tags.length) return false;
  for (const active of narrativeTagFilter) {
    if (tags.includes(active)) return true;
  }
  return false;
}

function matchesRegion(p) {
  if (regionFilter === "all") return true;
  return effectiveRegion(p) === regionFilter;
}

/** Filtre formes — local à la liste (localStorage), sans lien avec les classeurs. */
function matchesListFormFilter(p) {
  if (window.PokevaultFilters?.matchesPokemonFilters) {
    return window.PokevaultFilters.matchesPokemonFilters(p, {
      filters: { status: "all", region: "all", forms: formFilterMode, type: "all", tags: [] },
      caughtMap,
      statusMap,
    });
  }
  if (formFilterMode === "all") return true;
  const B = window.PokedexBinder;
  if (!B?.pokemonMatchesFormRule || !B.formRuleFromScope) return true;
  const scope = formFilterMode === "base_only" ? "base_only" : "base_regional";
  const rule = B.formRuleFromScope(scope);
  return B.pokemonMatchesFormRule(p, rule);
}

function matchesTypeFilter(p) {
  if (typeFilter === "all") return true;
  const types = p.types || [];
  return types.some((t) => String(t) === typeFilter);
}

/** Pool de référence aligné sur la règle de formes effective des classeurs. */
function poolForCollectionScope() {
  const B = window.PokedexBinder;
  if (!B?.getEffectiveFormRuleForCollection || !B?.selectBinderPokemonPool) return allPokemon;
  const rule = B.getEffectiveFormRuleForCollection();
  return B.selectBinderPokemonPool(allPokemon, rule);
}

/** Pokémon comptés pour la barre de progression (dex complet, filtre région uniquement). */
function visibleList() {
  const scoped = poolForCollectionScope();
  return scoped.filter(
    (p) =>
      matchesSearch(p, searchQuery) &&
      matchesPokedexFilterState(p),
  );
}

function matchesPokedexFilterState(p) {
  if (window.PokevaultFilters?.matchesPokemonFilters) {
    return window.PokevaultFilters.matchesPokemonFilters(p, {
      filters: currentFilterState(),
      caughtMap,
      statusMap,
      effectiveRegion,
      narrativeTagsFor,
    });
  }
  return (
    matchesListFormFilter(p) &&
    matchesTypeFilter(p) &&
    matchesFilter(p) &&
    matchesRegion(p) &&
    matchesNarrativeTags(p)
  );
}

function slicedVisibleList() {
  const full = visibleList();
  const total = full.length;
  const end = total === 0 ? 0 : Math.min(total, Math.max(LIST_PAGE_SIZE, displayedCount));
  displayedCount = end || LIST_PAGE_SIZE;
  return {
    full,
    pageItems: full.slice(0, end),
    total,
    end,
  };
}

function showDexError(grid) {
  grid.replaceChildren();
  const ES = window.PokevaultEmptyStates;
  if (ES?.render) {
    const node = ES.render(grid, "dexError");
    if (node) grid.append(node);
    return;
  }
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = t("app.sync.progress_unavailable");
  grid.append(p);
}

function fillRegionSelect() {
  const sel = document.getElementById("regionFilter");
  if (!sel) return;
  const keep = regionFilter;
  sel.replaceChildren();
  const opt0 = document.createElement("option");
  opt0.value = "all";
  opt0.textContent = t("app.filters.all_regions");
  sel.append(opt0);
  for (const r of regionDefinitions) {
    const o = document.createElement("option");
    o.value = r.id;
    o.textContent = `${r.label_fr} (${r.low}–${r.high})`;
    sel.append(o);
  }
  sel.value = keep;
  if (![...sel.options].some((o) => o.value === sel.value)) sel.value = "all";
  regionFilter = sel.value;
}

function renderRegionChips() {
  const host = document.getElementById("regionChips");
  if (!host) return;
  host.replaceChildren();
  const makeChip = (id, label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "region-chip";
    btn.dataset.region = id;
    btn.setAttribute(
      "aria-pressed",
      regionFilter === id ? "true" : "false",
    );
    if (regionFilter === id) btn.classList.add("is-active");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setRegionFilter(id);
    });
    return btn;
  };
  host.append(makeChip("all", "National"));
  for (const r of regionDefinitions) {
    host.append(makeChip(r.id, r.label_fr));
  }
}

function setRegionFilter(id) {
  const next = typeof id === "string" && id ? id : "all";
  if (next !== "all" && !regionDefinitions.some((r) => r.id === next)) {
    return;
  }
  if (regionFilter === next) return;
  regionFilter = next;
  const sel = document.getElementById("regionFilter");
  if (sel) sel.value = next;
  writeRegionToHash(next);
  syncRegionChipsActive();
  resetDisplayedCount();
  render();
}

function syncRegionChipsActive() {
  const host = document.getElementById("regionChips");
  if (!host) return;
  for (const btn of host.querySelectorAll(".region-chip")) {
    const on = btn.dataset.region === regionFilter;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function writeRegionToHash(region) {
  void region;
  writeFiltersToHash();
}

function renderNarrativeChips() {
  const host = document.getElementById("narrativeChips");
  if (!host) return;
  if (!narrativeTagOrder.length) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  host.hidden = false;
  host.replaceChildren();
  for (const id of narrativeTagOrder) {
    const label = narrativeTagLabels[id];
    if (!label) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "narrative-chip";
    btn.dataset.tag = id;
    const active = narrativeTagFilter.has(id);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    if (active) btn.classList.add("is-active");
    btn.textContent = label;
    btn.addEventListener("click", () => toggleNarrativeTag(id));
    host.append(btn);
  }
  if (narrativeTagFilter.size > 0) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "narrative-chip narrative-chip--clear";
    clear.textContent = t("app.narrative.clear");
    clear.addEventListener("click", () => clearNarrativeTags());
    host.append(clear);
  }
}

function syncNarrativeChipsActive() {
  const host = document.getElementById("narrativeChips");
  if (!host) return;
  for (const btn of host.querySelectorAll(".narrative-chip")) {
    const id = btn.dataset.tag;
    if (!id) continue;
    const on = narrativeTagFilter.has(id);
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function toggleNarrativeTag(id) {
  if (!narrativeTagLabels[id]) return;
  if (narrativeTagFilter.has(id)) narrativeTagFilter.delete(id);
  else narrativeTagFilter.add(id);
  writeTagsToHash();
  resetDisplayedCount();
  renderNarrativeChips();
  render();
}

function clearNarrativeTags() {
  if (!narrativeTagFilter.size) return;
  narrativeTagFilter = new Set();
  writeTagsToHash();
  resetDisplayedCount();
  renderNarrativeChips();
  render();
}

function writeTagsToHash() {
  writeFiltersToHash();
}

function setupRegionFilter() {
  const sel = document.getElementById("regionFilter");
  if (!sel || sel.dataset.wired) return;
  sel.dataset.wired = "1";
  sel.addEventListener("change", () => {
    setRegionFilter(sel.value || "all");
  });
}

function fillTypeSelect() {
  const sel = document.getElementById("typeFilter");
  if (!sel) return;
  const keep = typeFilter;
  sel.replaceChildren();
  const o0 = document.createElement("option");
  o0.value = "all";
  o0.textContent = t("app.filters.all_types");
  sel.append(o0);
  const types = new Set();
  for (const p of allPokemon) {
    for (const t of p.types || []) {
      if (t) types.add(String(t));
    }
  }
  for (const t of [...types].sort((a, b) => a.localeCompare(b, "fr"))) {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    sel.append(o);
  }
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : "all";
  typeFilter = sel.value;
}

function setupTypeFilter() {
  const sel = document.getElementById("typeFilter");
  if (!sel || sel.dataset.wired) return;
  sel.dataset.wired = "1";
  sel.addEventListener("change", () => {
    typeFilter = sel.value || "all";
    try {
      localStorage.setItem(TYPE_FILTER_STORAGE_KEY, typeFilter);
    } catch {
      /* ignore */
    }
    writeFiltersToHash();
    resetDisplayedCount();
    render();
  });
}

function setupFormFilter() {
  const sel = document.getElementById("formFilter");
  if (!sel || sel.dataset.wired) return;
  sel.dataset.wired = "1";
  sel.value = formFilterMode;
  sel.addEventListener("change", () => {
    const v = sel.value || "all";
    formFilterMode = v === "base_only" || v === "base_regional" || v === "regional_only" ? v : "all";
    try {
      localStorage.setItem(FORM_FILTER_STORAGE_KEY, formFilterMode);
    } catch {
      /* ignore */
    }
    writeFiltersToHash();
    syncQuickFilterButtons();
    resetDisplayedCount();
    render();
  });
}

function resetDisplayedCount() {
  displayedCount = LIST_PAGE_SIZE;
}

function setupInfiniteScroll() {
  const sentinel = document.getElementById("listScrollSentinel");
  if (!sentinel || listScrollObserver) return;
  listScrollObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const full = visibleList();
        if (displayedCount >= full.length) continue;
        displayedCount = Math.min(full.length, displayedCount + LIST_PAGE_SIZE);
        appendVisibleItems(full);
      }
    },
    { rootMargin: "600px 0px" },
  );
  listScrollObserver.observe(sentinel);
}

function appendVisibleItems(fullList) {
  const grid = document.getElementById("grid");
  if (!grid) return;
  const full = fullList || visibleList();
  const target = Math.min(full.length, displayedCount);
  const already = grid.querySelectorAll(".card").length;
  const frag = document.createDocumentFragment();
  for (let i = already; i < target; i++) {
    frag.append(createPokemonCard(full[i]));
  }
  if (frag.childNodes.length) grid.append(frag);
  updateListDisplayInfo({ full, end: target, total: full.length });
  window.PokevaultKeyboard?.repaint?.();
}

function rerenderArtworkSurface() {
  const routeSlug = currentPokemonSlugFromHash();
  if (routeSlug && typeof window.PokevaultPokemonModal?.render === "function") {
    window.PokevaultPokemonModal.render(routeSlug);
    return;
  }
  if (typeof window.PokevaultPokemonModal?.render === "function") {
    window.PokevaultPokemonModal.render();
    return;
  }
  if (typeof render === "function") render();
}

function dataMaintenanceCounts(payload) {
  const files = Array.isArray(payload?.files) ? payload.files : [];
  return {
    references: files.filter((item) => item?.kind === "reference" && item.present).length,
    local: files.filter((item) => item?.kind === "local_state" && item.present).length,
  };
}

function renderSettingsMaintenanceStatus(payload) {
  const status = document.getElementById("settingsMaintenanceStatus");
  if (!status) return;
  const counts = dataMaintenanceCounts(payload);
  status.textContent = t("app.settings.maintenance_status", {
    references: `${counts.references} ${t(counts.references === 1 ? "app.settings.reference_file" : "app.settings.reference_files")}`,
    local: `${counts.local} ${t(counts.local === 1 ? "app.settings.local_file" : "app.settings.local_files")}`,
  });
}

function showSettingsMaintenanceHint(message, isError = false) {
  const hint = document.getElementById("settingsMaintenanceHint");
  if (!hint) return;
  hint.textContent = message;
  hint.hidden = false;
  hint.style.color = isError ? "var(--md-error, #ffb4ab)" : "";
  if (!isError) setTimeout(() => { hint.hidden = true; }, 5000);
}

async function loadSettingsMaintenanceStatus() {
  const status = document.getElementById("settingsMaintenanceStatus");
  try {
    const res = await fetch(`${API_DATA}/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    renderSettingsMaintenanceStatus(payload);
    return payload;
  } catch {
    if (status) status.textContent = t("app.settings.maintenance_status_error");
    return null;
  }
}

function clearClientMaintenanceState() {
  for (const key of CLIENT_STATE_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* private mode */
    }
  }
  try {
    sessionStorage.removeItem("pokedexKbFocusSlug");
  } catch {
    /* private mode */
  }
}

function countChangedFiles(payload) {
  return Array.isArray(payload?.changed) ? payload.changed.length : 0;
}

function setupSettingsMaintenanceActions() {
  const refreshBtn = document.getElementById("settingsMaintenanceRefreshBtn");
  const resetBtn = document.getElementById("settingsDataResetBtn");
  if (!refreshBtn || !resetBtn) return Promise.resolve(null);
  if (!refreshBtn.dataset.wired) {
    refreshBtn.dataset.wired = "1";
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      try {
        const res = await fetch(`${API_DATA}/refresh`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const changed = countChangedFiles(payload);
        showSettingsMaintenanceHint(
          changed
            ? t("app.settings.maintenance_refresh_success", { count: changed })
            : t("app.settings.maintenance_refresh_empty"),
          false,
        );
        await loadSettingsMaintenanceStatus();
      } catch (err) {
        showSettingsMaintenanceHint(t("app.settings.maintenance_refresh_failed", { message: err.message }), true);
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }
  if (!resetBtn.dataset.wired) {
    resetBtn.dataset.wired = "1";
    resetBtn.addEventListener("click", async () => {
      const shouldReset = typeof confirm === "function" ? confirm(t("app.settings.reset_confirm")) : false;
      if (!shouldReset) return;
      resetBtn.disabled = true;
      try {
        const res = await fetch(`${API_DATA}/reset-local`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        clearClientMaintenanceState();
        showSettingsMaintenanceHint(
          t("app.settings.maintenance_reset_success", { count: countChangedFiles(payload) }),
          false,
        );
        setTimeout(() => location.reload(), 900);
      } catch (err) {
        showSettingsMaintenanceHint(t("app.settings.maintenance_reset_failed", { message: err.message }), true);
        resetBtn.disabled = false;
      }
    });
  }
  return loadSettingsMaintenanceStatus();
}

function setupSettingsView() {
  const sel = document.getElementById("settingsDimSelect");
  if (!sel || sel.dataset.wired) return;
  sel.dataset.wired = "1";
  sel.value = getDimMode();
  sel.addEventListener("change", () => setDimMode(sel.value === "missing" ? "missing" : "caught"));
  subscribeDimMode((mode) => {
    sel.value = mode;
  });
  paintVersionLabels();
  const versionEl = document.getElementById("settingsVersionLabel");
  const healthEl = document.getElementById("settingsHealthLabel");
  if (versionEl) versionEl.textContent = t("app.health.checking", { version: appVersionLabel() });
  if (healthEl) healthEl.textContent = t("app.health.status_checking");
  void (async () => {
    try {
      const res = await fetch(API_HEALTH);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const apiVer = String(data?.api_version || "n/a");
      const apiStatus = apiVer === APP_VERSION ? "API ok" : `API ${apiVer}`;
      if (versionEl) versionEl.textContent = t("app.health.version_ok", { version: appVersionLabel(), apiStatus });
      if (healthEl) healthEl.textContent = t("app.health.status_ok");
    } catch {
      if (versionEl) versionEl.textContent = t("app.health.version_unavailable", { version: appVersionLabel() });
      if (healthEl) healthEl.textContent = t("app.health.status_error");
    }
  })();
  setupExportImport();
  void setupSettingsMaintenanceActions();
}

let pendingImportPayload = null;

function isSupportedBackupSchemaVersion(value) {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function getCollectionScopeSlugSet() {
  const pool = window.PokedexCollection?.poolForCollectionScope
    ? window.PokedexCollection.poolForCollectionScope()
    : window.PokedexCollection?.allPokemon || [];
  const keep = new Set();
  for (const p of pool) {
    const slug = String(p?.slug || "");
    if (slug) keep.add(slug);
  }
  return keep;
}

function sanitizeBackupPayloadToCollectionScope(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const keep = getCollectionScopeSlugSet();
  const clean = JSON.parse(JSON.stringify(payload));

  const caught = clean?.progress?.caught && typeof clean.progress.caught === "object"
    ? clean.progress.caught
    : {};
  const filteredCaught = Object.create(null);
  for (const [slug, v] of Object.entries(caught)) {
    if (keep.has(String(slug))) filteredCaught[slug] = Boolean(v);
  }
  if (clean?.progress) clean.progress.caught = filteredCaught;

  const byBinder =
    clean?.binder_placements?.by_binder && typeof clean.binder_placements.by_binder === "object"
      ? clean.binder_placements.by_binder
      : {};
  const filteredByBinder = Object.create(null);
  for (const [binderId, placements] of Object.entries(byBinder)) {
    if (!placements || typeof placements !== "object") continue;
    const keptPlacements = Object.create(null);
    for (const [slug, slot] of Object.entries(placements)) {
      if (keep.has(String(slug))) keptPlacements[slug] = slot;
    }
    filteredByBinder[binderId] = keptPlacements;
  }
  if (clean?.binder_placements) clean.binder_placements.by_binder = filteredByBinder;

  return clean;
}

function setupExportImport() {
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const fileInput = document.getElementById("importFileInput");
  const preview = document.getElementById("importPreview");
  const previewText = document.getElementById("importPreviewText");
  const confirmBtn = document.getElementById("importConfirmBtn");
  const cancelBtn = document.getElementById("importCancelBtn");
  const hint = document.getElementById("exportImportHint");
  if (!exportBtn || exportBtn.dataset.wired) return;
  exportBtn.dataset.wired = "1";

  function showHint(msg, isError) {
    if (!hint) return;
    hint.textContent = msg;
    hint.hidden = false;
    hint.style.color = isError ? "var(--md-error, #f44)" : "";
    if (!isError) setTimeout(() => { hint.hidden = true; }, 4000);
  }

  exportBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dataRaw = await res.json();
      const data = sanitizeBackupPayloadToCollectionScope(dataRaw);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `pokevault-backup-${date}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showHint(t("app.export.success", {
        caught: Object.keys(data.progress?.caught || {}).length,
        binders: (data.binder_config?.binders || []).length,
      }), false);
    } catch (err) {
      showHint(t("app.export.failed", { message: err.message }), true);
    }
  });

  importBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!isSupportedBackupSchemaVersion(data.schema_version)) throw new Error(t("app.import.unsupported"));
        if (!data.progress || !data.binder_config || !data.binder_placements) {
          throw new Error(t("app.import.required"));
        }
        pendingImportPayload = sanitizeBackupPayloadToCollectionScope(data);
        const caught = Object.keys(pendingImportPayload.progress?.caught || {}).length;
        const binders = (pendingImportPayload.binder_config?.binders || []).length;
        const date = data.exported_at ? new Date(data.exported_at).toLocaleDateString() : t("app.date.unknown");
        previewText.textContent = t("app.import.preview", { caught, binders, date });
        preview.hidden = false;
      } catch (err) {
        showHint(t("app.import.invalid", { message: err.message }), true);
        pendingImportPayload = null;
        preview.hidden = true;
      }
      fileInput.value = "";
    };
    reader.readAsText(file);
  });

  confirmBtn.addEventListener("click", async () => {
    if (!pendingImportPayload) return;
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingImportPayload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      showHint(t("app.import.success", { caught: body.caught_count, binders: body.binder_count }), false);
      pendingImportPayload = null;
      preview.hidden = true;
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      showHint(t("app.import.failed", { message: err.message }), true);
    }
  });

  cancelBtn.addEventListener("click", () => {
    pendingImportPayload = null;
    preview.hidden = true;
  });
}

function updateListDisplayInfo({ full, end, total }) {
  const info = document.getElementById("listDisplayInfo");
  const endBanner = document.getElementById("listScrollEnd");
  if (info) {
    if (!total) {
      info.textContent = t("app.list.silent");
    } else {
      const caughtVisible = (full || []).filter((p) => Boolean(caughtMap[pokemonKey(p)])).length;
      const pctVisible = total ? Math.round((caughtVisible / total) * 100) : 0;
      info.textContent = t("app.list.display", { end, total, pct: pctVisible });
    }
  }
  if (endBanner) {
    const done = total > 0 && end >= total;
    endBanner.hidden = !done;
    if (done) endBanner.textContent = t("app.list.end", { total });
  }
}

/**
 * Carte Pokédex (même rendu que la liste) — réutilisable dans le classeur.
 * @param {Record<string, unknown>} p
 * @param {{ empty?: boolean; slotLabel?: string }} [opts]
 */
function createPokemonCard(p, opts) {
  const empty = Boolean(opts?.empty);
  if (empty) {
    const wrap = document.createElement("div");
    wrap.className = "card card--empty-slot";
    wrap.setAttribute("role", "presentation");
    const ph = document.createElement("div");
    ph.className = "card-img-placeholder";
    wrap.append(ph);
    const lab = document.createElement("div");
    lab.className = "card-name";
    lab.textContent = "—";
    wrap.append(lab);
    return wrap;
  }

  const key = pokemonKey(p);
  const status = getStatus(key);
  const caught = status.state === "caught";
  const seen = status.state === "seen";
  const ownership = ownershipStateForSlug(key);
  const tradeSummary = tradeSummaryForSlug(key);
  const locallyOwned = Boolean(ownership.caught);
  const networkSeen = !locallyOwned && tradeSummary.availableFrom.length > 0;
  const visualSeen = seen || networkSeen;
  const dim = getDimMode();

  const card = document.createElement("article");
  const classParts = ["card"];
  if (caught) classParts.push("is-caught");
  if (visualSeen) classParts.push("is-seen");
  if (ownership.duplicate) classParts.push("is-duplicate");
  card.className = classParts.join(" ");
  if (shouldDimCardForHighlight(dim, { caught: locallyOwned, duplicate: ownership.duplicate })) {
    card.classList.add("is-dimmed");
  }
  card.dataset.slug = key;
  card.dataset.status = status.state;
  card.dataset.ownership = window.PokevaultPokemonFiche?.ownershipLabel?.(ownership) || "";
  card.setAttribute("role", "group");
  const stateLabel = caught
    ? t("app.card.state_caught")
    : visualSeen ? t("app.card.state_seen") : t("app.card.state_missing");
  const exchangeLabel = networkSeen
    ? t("app.card.seen_contact", { count: tradeSummary.availableFrom.length })
    : "";
  card.setAttribute(
    "aria-label",
    `${displayName(p)} ${displayNumber(p.number)}${stateLabel}${exchangeLabel}`,
  );

  const top = document.createElement("div");
  top.className = "card-top";
  const numEl = document.createElement("div");
  numEl.className = "card-num";
  numEl.textContent = displayNumber(p.number);
  const markers = document.createElement("div");
  markers.className = "card-markers";
  const statusIcon = document.createElement("span");
  const statusClass = caught ? "is-caught" : visualSeen ? "is-seen" : "is-missing";
  statusIcon.className = `card-status-icon ${statusClass}`;
  statusIcon.textContent = caught
    ? "✓"
    : visualSeen
      ? "◉"
      : "○";
  statusIcon.setAttribute("aria-hidden", "true");
  markers.append(statusIcon);
  if (ownership.count > 1) {
    const ownedCount = document.createElement("span");
    ownedCount.className = "pokemon-owned-count";
    ownedCount.textContent = String(ownership.count);
    ownedCount.title = card.dataset.ownership || t("pokemon_fiche.ownership.duplicate");
    ownedCount.setAttribute("aria-label", ownedCount.title);
    markers.append(ownedCount);
  }
  top.append(numEl, markers);
  card.append(top);

  const imgWrap = document.createElement("div");
  imgWrap.className = "card-img-wrap";
  const glow = document.createElement("div");
  glow.className = "card-glow";
  imgWrap.append(glow);
  const A = window.PokevaultArtwork;
  const resolved = A?.resolve ? A.resolve(p) : { src: normalizePath(p.image), fallbacks: [] };
  const src = resolved.src;
  if (src) {
    const img = document.createElement("img");
    img.className = "card-img";
    img.alt = "";
    img.loading = "lazy";
    const remainingFallbacks = (resolved.fallbacks || []).slice();
    img.addEventListener("error", () => {
      const next = remainingFallbacks.shift();
      if (next && img.src !== next) {
        img.src = next;
        return;
      }
      img.remove();
      const ph = document.createElement("div");
      ph.className = "card-img-placeholder";
      imgWrap.append(ph);
    });
    img.src = src;
    imgWrap.append(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "card-img-placeholder";
    imgWrap.append(ph);
  }
  card.append(imgWrap);

  const nameEl = document.createElement("div");
  nameEl.className = "card-name";
  nameEl.textContent = displayName(p);
  card.append(nameEl);

  const types = document.createElement("div");
  types.className = "card-types";
  const typeList = Array.isArray(p.types) ? p.types.filter(Boolean).slice(0, 2) : [];
  const fiche = window.PokevaultPokemonFiche;
  if (!typeList.length) {
    const unknown = fiche?.createTypeChip
      ? fiche.createTypeChip(t("app.card.unknown"), "card-type-badge")
      : document.createElement("span");
    if (!unknown.className) unknown.className = "card-type-badge";
    if (!unknown.textContent) unknown.textContent = t("app.card.unknown");
    types.append(unknown);
  } else {
    for (const typeName of typeList) {
      const badge = fiche?.createTypeChip
        ? fiche.createTypeChip(typeName, "card-type-badge")
        : document.createElement("span");
      if (!badge.className) badge.className = "card-type-badge";
      if (!badge.textContent) badge.textContent = String(typeName);
      types.append(badge);
    }
  }
  card.append(types);

  const reg = effectiveRegion(p);
  const lbl = p.region_label_fr || regionDefinitions.find((x) => x.id === reg)?.label_fr || reg;
  const tag = document.createElement("div");
  tag.className = "card-region";
  tag.textContent = p.region_native === false ? t("app.card.region_form", { region: lbl }) : lbl;
  card.append(tag);

  const action = document.createElement("div");
  action.className = "card-action";
  const ownershipActions = window.PokevaultPokemonFiche?.createOwnershipActions?.(
    ownership,
    (next) => {
      void setPokemonOwnershipState(key, next);
    },
    { compact: true },
  );
  if (ownershipActions) action.append(ownershipActions);
  else action.textContent = t("app.card.action_caught");
  card.append(action);

  const exchange = document.createElement("div");
  exchange.className = "pokemon-network-row";
  if (networkSeen) {
    const badge = document.createElement("span");
    badge.className = "pokemon-network-badge";
    badge.textContent = t("app.card.seen_badge", { count: tradeSummary.availableFrom.length });
    badge.title = tradeSummary.availableFrom.join(", ");
    exchange.append(badge);
  }
  card.append(exchange);

  const details = document.createElement("button");
  details.type = "button";
  details.className = "card-details";
  details.textContent = t("app.card.details");
  details.setAttribute("aria-label", t("app.card.open", { name: displayName(p) }));
  details.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.PokevaultPokemonModal?.open?.(key, card);
  });
  card.append(details);

  return card;
}

window.PokedexCollection.createPokemonCard = createPokemonCard;
window.PokedexCollection.poolForCollectionScope = poolForCollectionScope;
if (window.__POKEVAULT_APP_TESTS__) {
  window.PokedexCollection._test = {
    currentViewFromHash,
    isSupportedBackupSchemaVersion,
    matchesSearch,
    renderSettingsMaintenanceStatus,
    rerenderArtworkSurface,
    setupSettingsMaintenanceActions,
    shouldDimCardForHighlight,
  };
}

function hasActiveFilterExceptStatus() {
  return (
    searchQuery.trim() !== "" ||
    regionFilter !== "all" ||
    typeFilter !== "all" ||
    formFilterMode !== "all" ||
    narrativeTagFilter.size > 0
  );
}

function render() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  const sliced = slicedVisibleList();
  const list = sliced.pageItems;

  const scrollY = window.scrollY;

  // Fix scroll jump/glitch: lock height during clearing
  const currentHeight = grid.offsetHeight;
  grid.style.minHeight = `${currentHeight}px`;

  grid.replaceChildren();
  if (!sliced.total) {
    grid.style.minHeight = ""; // Reset if empty
    const ES = window.PokevaultEmptyStates;
    const collectionEmpty = Object.keys(caughtMap).length === 0;
    const hasActiveFilter =
      searchQuery.trim() !== "" ||
      hideCaught ||
      hideMissing ||
      regionFilter !== "all" ||
      typeFilter !== "all" ||
      formFilterMode !== "all" ||
      narrativeTagFilter.size > 0;
    let variant = "listNoMatch";
    if (hideMissing && !hideCaught && !hasActiveFilterExceptStatus()) {
      variant = "listAllCaught";
    } else if (collectionEmpty && !hasActiveFilter) {
      variant = "listCollectionEmpty";
    }
    const node = ES?.render
      ? ES.render(grid, variant)
      : (() => {
          const p = document.createElement("p");
          p.className = "empty-state";
          p.textContent = t("app.list.no_filter");
          return p;
    })();
    if (node) grid.append(node);
    updateListDisplayInfo({ full: sliced.full, end: 0, total: 0 });
    return;
  }

  const frag = document.createDocumentFragment();
  for (const p of list) frag.append(createPokemonCard(p));
  grid.append(frag);

  // Release height lock
  grid.style.minHeight = "";

  if (window.scrollY !== scrollY) {
    window.scrollTo(0, scrollY);
  }

  updateListDisplayInfo({ full: sliced.full, end: sliced.end, total: sliced.total });
  window.PokevaultKeyboard?.repaint?.();
}

function syncQuickFilterButtons() {
  const buttons = document.querySelectorAll("#viewListe .filter-btn[data-filter], #viewListe .filter-btn[data-form-filter]");
  buttons.forEach((btn) => {
    let on = false;
    if (btn.dataset.filter === "hide_caught") {
      on = hideCaught;
    } else if (btn.dataset.filter === "hide_missing") {
      on = hideMissing;
    } else if (btn.dataset.formFilter) {
      on = btn.dataset.formFilter === formFilterMode;
    }
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function setupFilters() {
  const buttons = document.querySelectorAll("#viewListe .filter-btn[data-filter], #viewListe .filter-btn[data-form-filter]");
  buttons.forEach((btn) => {
    if (btn.dataset.filterWired) return;
    btn.dataset.filterWired = "1";
    btn.addEventListener("click", () => {
      if (btn.dataset.filter === "hide_caught") {
        hideCaught = !hideCaught;
      } else if (btn.dataset.filter === "hide_missing") {
        hideMissing = !hideMissing;
      } else if (btn.dataset.formFilter) {
        const next = btn.dataset.formFilter || "all";
        formFilterMode = formFilterMode === next ? "all" : next;
      }
      const formSel = document.getElementById("formFilter");
      if (formSel) formSel.value = formFilterMode;
      try {
        localStorage.setItem(FORM_FILTER_STORAGE_KEY, formFilterMode);
      } catch {
        /* ignore */
      }
      writeFiltersToHash();
      resetDisplayedCount();
      syncQuickFilterButtons();
      render();
    });
  });
  syncQuickFilterButtons();
}

function setupSearch() {
  const input = document.getElementById("search");
  input.addEventListener("input", () => {
    searchQuery = input.value;
    resetDisplayedCount();
    render();
  });
}

function setupKeyboardHelpTrigger() {
  const btn = document.getElementById("kbHelpTrigger");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", () => {
    window.PokevaultKeyboard?.openHelp?.();
  });
}

let listCaughtSubscribed = false;
let listDimSubscribed = false;
let listBadgesSubscribed = false;
let listTrainerContactsSubscribed = false;

function readStoredFormFilterMode() {
  try {
    const v = localStorage.getItem(FORM_FILTER_STORAGE_KEY);
    if (v === "base_only" || v === "base_regional" || v === "regional_only") return v;
  } catch {
    /* ignore */
  }
  return "all";
}

function readStoredTypeFilter() {
  try {
    const tf = localStorage.getItem(TYPE_FILTER_STORAGE_KEY);
    return tf && tf !== "all" ? tf : "all";
  } catch {
    return "all";
  }
}

async function startTracker() {
  formFilterMode = readStoredFormFilterMode();
  typeFilter = readStoredTypeFilter();
  setupFilters();
  setupSearch();
  setupKeyboardHelpTrigger();
  setupRegionFilter();
  setupTypeFilter();
  setupFormFilter();
  setupInfiniteScroll();
  setupSettingsView();
  const formSel = document.getElementById("formFilter");
  if (formSel) formSel.value = formFilterMode;
  wireDimModeSelectsOnce();
  try {
    await getCollectionBootstrap();
  } catch {
    return;
  }
  try {
    await window.PokevaultTrainerContacts?.ensureLoaded?.();
  } catch {
    /* trainer contacts are optional local state */
  }
  applyFilterState(readFiltersFromHash());
  renderRegionChips();
  syncFilterControlsFromState();
  if (!listCaughtSubscribed) {
    listCaughtSubscribed = true;
    window.PokedexCollection.subscribeCaught(() => render());
  }
  if (!listDimSubscribed) {
    listDimSubscribed = true;
    window.PokedexCollection.subscribeDimMode(() => render());
  }
  if (!listTrainerContactsSubscribed) {
    listTrainerContactsSubscribed = true;
    window.PokevaultTrainerContacts?.subscribe?.(() => {
      resetDisplayedCount();
      render();
    });
  }
  if (!listBadgesSubscribed) {
    listBadgesSubscribed = true;
    window.PokevaultBadges?.subscribe?.(() => render());
  }
  if (!window.__pokedexOnlineFlushWired) {
    window.__pokedexOnlineFlushWired = true;
    window.addEventListener("online", () => void flushOfflineProgressQueue());
  }
  void flushOfflineProgressQueue();
  render();
}

function currentViewFromHash() {
  const rawFull = (location.hash || "#/liste").replace(/^#/, "").replace(/^\//, "");
  const raw = rawFull.split("?")[0];
  if (raw.startsWith("pokemon/")) return "liste";
  if (raw === "stats") return "stats";
  if (raw === "classeur") return "classeur";
  if (raw === "dresseurs") return "dresseurs";
  if (raw === "badges") return "badges";
  if (raw === "settings") return "settings";
  if (raw === "docs") return "docs";
  if (raw === "liste" || raw === "") return "liste";
  return "liste";
}

function currentPokemonSlugFromHash() {
  const shared = window.PokevaultPokemonFiche?.parsePokemonRouteSlug?.(location.hash || "");
  if (shared) return shared;
  const raw = (location.hash || "").replace(/^#/, "").replace(/^\//, "");
  const before = raw.split("?")[0];
  if (!before.startsWith("pokemon/")) return null;
  return before.slice("pokemon/".length) || null;
}

let listViewStarted = false;

function updateAppSwitchNav(view) {
  document.querySelectorAll(".app-switch-link").forEach((a) => {
    const v = a.dataset.view;
    const on = v === view;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-mobile-view]").forEach((a) => {
    const v = a.dataset.mobileView;
    const on = v === view;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.querySelectorAll(".mobile-more-menu__link").forEach((a) => {
    const v = a.dataset.view;
    const on = v === view;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function closeMobileMoreMenu() {
  const toggle = document.getElementById("mobileMoreToggle");
  const menu = document.getElementById("mobileMoreMenu");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  if (menu) menu.hidden = true;
}

function setupMobileMoreMenu() {
  const toggle = document.getElementById("mobileMoreToggle");
  const menu = document.getElementById("mobileMoreMenu");
  if (!toggle || !menu || toggle.dataset.bound) return;
  toggle.dataset.bound = "1";
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    menu.hidden = isOpen;
  });
  menu.querySelectorAll?.("a").forEach((link) => {
    link.addEventListener("click", () => closeMobileMoreMenu());
  });
}

function applyAppRoute() {
  const routePokemonSlug = currentPokemonSlugFromHash();
  const view = currentViewFromHash();
  const elListe = document.getElementById("viewListe");
  const elClasseur = document.getElementById("viewClasseur");
  const elDresseurs = document.getElementById("viewDresseurs");
  const elBadges = document.getElementById("viewBadges");
  const elStats = document.getElementById("viewStats");
  const elSettings = document.getElementById("viewSettings");
  const elDocs = document.getElementById("viewDocs");
  if (elListe) elListe.hidden = view !== "liste";
  if (elClasseur) elClasseur.hidden = view !== "classeur";
  if (elDresseurs) elDresseurs.hidden = view !== "dresseurs";
  if (elBadges) elBadges.hidden = view !== "badges";
  if (elStats) elStats.hidden = view !== "stats";
  if (elSettings) elSettings.hidden = view !== "settings";
  if (elDocs) elDocs.hidden = view !== "docs";
  updateAppSwitchNav(view);
  closeMobileMoreMenu();
  const titles = {
    liste: `pokevault — ${t("app.nav.collection")}`,
    badges: `pokevault — ${t("app.badges.title")}`,
    stats: `pokevault — ${t("app.nav.stats")}`,
    settings: `pokevault — ${t("app.nav.settings")}`,
    docs: `pokevault — ${t("app.nav.docs")}`,
    classeur: `pokevault — ${t("app.nav.binders")}`,
    dresseurs: `pokevault — ${t("app.nav.trainers")}`,
  };
  document.title = titles[view] || "pokevault";
  if (view === "liste" && !listViewStarted) {
    listViewStarted = true;
    void startTracker();
  } else if (view === "liste" && listViewStarted && allPokemon.length) {
    applyFilterState(readFiltersFromHash());
    syncFilterControlsFromState();
    resetDisplayedCount();
    render();
  }
  if (view === "classeur" && typeof window.startBinderV2IfNeeded === "function") {
    window.startBinderV2IfNeeded();
  }
  if (view === "dresseurs" && typeof window.PokevaultTrainerContacts?.start === "function") {
    window.PokevaultTrainerContacts.start();
  }
  if (view === "badges" && typeof window.PokevaultBadgesPage?.start === "function") {
    window.PokevaultBadgesPage.start();
  }
  if (view === "stats" && typeof window.PokedexStats?.start === "function") {
    window.PokedexStats.start();
  }
  if (view === "settings") {
    setupSettingsView();
  }
  if (routePokemonSlug && typeof window.PokevaultPokemonModal?.open === "function") {
    window.PokevaultPokemonModal.open(routePokemonSlug, null);
    const back = window.PokevaultPokemonFiche?.listReturnHash?.(location.hash || "") || "#/liste";
    if (window.history?.replaceState) window.history.replaceState(null, "", back);
    location.hash = back;
  }
}

window.addEventListener("hashchange", applyAppRoute);
window.PokevaultI18n?.subscribeLocale?.(() => {
  window.PokevaultI18n?.applyTranslations?.();
  fillRegionSelect();
  fillTypeSelect();
  renderRegionChips();
  renderNarrativeChips();
  if (allPokemon.length && currentViewFromHash() === "liste") render();
  applyAppRoute();
});

window.applyPokedexAppRoute = applyAppRoute;

void (async () => {
  setupMobileMoreMenu();
  applyAppRoute();
})();
