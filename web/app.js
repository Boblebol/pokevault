/**
 * Collection — liste et classeurs partagent la même progression (slug → attrapé).
 * Routage : #/liste et #/classeur.
 */

const API_PROGRESS = "/api/progress";
const API_HEALTH = "/api/health";
const APP_UI_VERSION = "1.0.0";
const PROGRESS_QUEUE_KEY = "pokedex_progress_queue";
const FORM_FILTER_STORAGE_KEY = "pokedexFormFilter";
const TYPE_FILTER_STORAGE_KEY = "pokedexTypeFilter";

let allPokemon = [];
/**
 * Source of truth for the enriched Pokédex status (F03).
 * Keys are Pokémon slugs. Absence means `not_met`.
 * @type {Record<string, { state: "seen" | "caught"; shiny: boolean; seen_at?: string | null }>}
 */
let statusMap = Object.create(null);
/** Derived mirror kept in sync with `statusMap` for legacy consumers. */
let caughtMap = Object.create(null);
let filterMode = "all";
let regionFilter = "all";
let searchQuery = "";
let totalCount = 0;
/** @type {"all" | "base_only" | "base_regional"} */
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
    let progress = { caught: {}, statuses: {} };
    try {
      progress = await fetchProgressFile();
    } catch {
      const hint = document.getElementById("syncHint");
      if (hint) {
        hint.textContent =
          "Progression fichier indisponible — lance « make web » depuis la racine du projet.";
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
        hint.textContent = `${pending.length} modification(s) en attente de synchro…`;
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
        hint.textContent = `${rest.length} modification(s) en attente de synchro…`;
        hint.hidden = false;
      }
      return;
    }
  }
  if (hint) hint.hidden = true;
}

function endpointForQueueItem(item) {
  return item && item.kind === "status" ? `${API_PROGRESS}/status` : API_PROGRESS;
}

function bodyForQueueItem(item) {
  if (item && item.kind === "status") {
    return { slug: item.slug, state: item.state, shiny: Boolean(item.shiny) };
  }
  return { slug: item.slug, caught: Boolean(item.caught) };
}

async function persistStatusPatch(slug, state, shiny) {
  const hint = document.getElementById("syncHint");
  try {
    const res = await fetch(`${API_PROGRESS}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, state, shiny: Boolean(shiny) }),
    });
    if (!res.ok) throw new Error(String(res.status));
    await flushOfflineProgressQueue();
    if (hint) hint.hidden = true;
  } catch {
    const q = loadProgressQueue();
    q.push({ kind: "status", slug, state, shiny: Boolean(shiny), ts: Date.now() });
    saveProgressQueue(q);
    if (hint) {
      hint.textContent = "Hors ligne ou serveur indisponible — synchro différée.";
      hint.hidden = false;
    }
  }
}

/**
 * @param {{ caught?: Record<string, unknown>; statuses?: Record<string, unknown> }} payload
 */
function hydrateProgressMaps(payload) {
  statusMap = Object.create(null);
  caughtMap = Object.create(null);
  const statuses = payload && typeof payload.statuses === "object" ? payload.statuses : null;
  if (statuses) {
    for (const [slug, raw] of Object.entries(statuses)) {
      if (!slug || !raw || typeof raw !== "object") continue;
      const state = raw.state === "seen" || raw.state === "caught" ? raw.state : null;
      if (!state) continue;
      const shiny = state === "caught" && Boolean(raw.shiny);
      const seenAt = typeof raw.seen_at === "string" ? raw.seen_at : null;
      statusMap[slug] = { state, shiny, seen_at: seenAt };
      if (state === "caught") caughtMap[slug] = true;
    }
    return;
  }
  const rawCaught = payload && typeof payload.caught === "object" ? payload.caught : {};
  for (const [k, v] of Object.entries(rawCaught)) {
    if (!v) continue;
    statusMap[k] = { state: "caught", shiny: false, seen_at: null };
    caughtMap[k] = true;
  }
}

/** @returns {{ state: "not_met" | "seen" | "caught"; shiny: boolean }} */
function getStatus(slug) {
  const s = statusMap[slug];
  if (!s) return { state: "not_met", shiny: false };
  return { state: s.state, shiny: Boolean(s.shiny) };
}

/**
 * Persists a status change for a slug and broadcasts to listeners.
 * Passing `state: "not_met"` removes the entry.
 *
 * @param {string} slug
 * @param {"not_met" | "seen" | "caught"} state
 * @param {boolean} [shiny]
 */
function setStatus(slug, state, shiny = false) {
  if (!slug) return;
  const effectiveShiny = state === "caught" ? Boolean(shiny) : false;
  if (state === "not_met") {
    delete statusMap[slug];
    delete caughtMap[slug];
  } else {
    const prev = statusMap[slug];
    const seenAt = prev?.seen_at || new Date().toISOString();
    statusMap[slug] = { state, shiny: effectiveShiny, seen_at: seenAt };
    if (state === "caught") caughtMap[slug] = true;
    else delete caughtMap[slug];
  }
  void persistStatusPatch(slug, state, effectiveShiny);
  for (const cb of caughtUiListeners) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

/**
 * F03 cycle : not_met → seen → caught → not_met.
 * `shiftPressed` shortcuts to/toggles the shiny flag.
 *
 * @param {string} slug
 * @param {{ shift?: boolean }} [opts]
 */
function cycleStatusBySlug(slug, opts) {
  if (!slug) return;
  const shift = Boolean(opts?.shift);
  const current = getStatus(slug);
  if (shift) {
    if (current.state === "caught") {
      setStatus(slug, "caught", !current.shiny);
    } else {
      setStatus(slug, "caught", true);
    }
    return;
  }
  if (current.state === "not_met") setStatus(slug, "seen");
  else if (current.state === "seen") setStatus(slug, "caught");
  else setStatus(slug, "not_met");
}

/** Legacy helper kept for binder/stats: toggles the `caught` bit only. */
function toggleCaughtBySlug(slug) {
  if (!slug) return;
  const current = getStatus(slug);
  if (current.state === "caught") {
    setStatus(slug, "not_met");
  } else {
    setStatus(slug, "caught", current.shiny);
  }
}

/**
 * Contract-first card stats (F01 ↔ F08).
 *
 * Returns the aggregate number of catalogued cards and the count of distinct
 * sets those cards belong to. Until F08 ships the real Card model, we return
 * zeroes — but downstream views already render the secondary progression
 * line so the UI contract is frozen.
 *
 * @returns {{ cards: number; sets: number }}
 */
function computeCardStats() {
  const src = window.PokevaultCards;
  if (src && typeof src.summary === "function") {
    try {
      const s = src.summary();
      if (s && typeof s === "object") {
        const cards = Number(s.cards);
        const sets = Number(s.sets);
        return {
          cards: Number.isFinite(cards) ? cards : 0,
          sets: Number.isFinite(sets) ? sets : 0,
        };
      }
    } catch {
      /* tolerate incomplete provider */
    }
  }
  return { cards: 0, sets: 0 };
}

function formatCardSummary({ cards, sets }) {
  const c = cards === 1 ? "1 carte" : `${cards} cartes`;
  const s = sets === 1 ? "1 set" : `${sets} sets`;
  return `${c} dans ${s}`;
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
  cycleStatusBySlug,
  get statusMap() {
    return statusMap;
  },
  getDimMode,
  setDimMode,
  subscribeDimMode,
  wireDimModeSelectsOnce,
};
window.PokevaultMeta = { uiVersion: APP_UI_VERSION };

function paintVersionLabels() {
  const topBadge = document.getElementById("appVersionBadge");
  if (topBadge) topBadge.textContent = `UI ${APP_UI_VERSION}`;
  const footerLabel = document.getElementById("footerVersionLabel");
  if (footerLabel) footerLabel.textContent = `UI ${APP_UI_VERSION}`;
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
  const got = !!caughtMap[k];
  if (filterMode === "caught") return got;
  if (filterMode === "missing") return !got;
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
function poolForRegionProgress() {
  const scoped = poolForCollectionScope();
  if (regionFilter === "all") return scoped;
  return scoped.filter((p) => effectiveRegion(p) === regionFilter);
}

function progressForRegionBar() {
  const pool = poolForRegionProgress();
  const caught = pool.filter((p) => caughtMap[pokemonKey(p)]).length;
  return { caught, total: pool.length };
}

function visibleList() {
  const scoped = poolForCollectionScope();
  return scoped.filter(
    (p) =>
      matchesListFormFilter(p) &&
      matchesTypeFilter(p) &&
      matchesSearch(p, searchQuery) &&
      matchesFilter(p) &&
      matchesRegion(p) &&
      matchesNarrativeTags(p),
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
  p.textContent =
    "pokedex.json introuvable. Lance le serveur à la racine du dépôt (make web).";
  grid.append(p);
}

function fillRegionSelect() {
  const sel = document.getElementById("regionFilter");
  if (!sel) return;
  const keep = regionFilter;
  sel.replaceChildren();
  const opt0 = document.createElement("option");
  opt0.value = "all";
  opt0.textContent = "Toutes les régions";
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

function parseHashQuery() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const q = raw.indexOf("?");
  if (q < 0) return { view: raw, params: new URLSearchParams() };
  return {
    view: raw.slice(0, q),
    params: new URLSearchParams(raw.slice(q + 1)),
  };
}

function writeRegionToHash(region) {
  const { view, params } = parseHashQuery();
  if (region && region !== "all") params.set("region", region);
  else params.delete("region");
  const qs = params.toString();
  const next = `#/${view}${qs ? `?${qs}` : ""}`;
  if (location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

function readRegionFromHash() {
  const { params } = parseHashQuery();
  const v = params.get("region");
  if (!v || v === "all") return null;
  return v;
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
    clear.textContent = "Tout réinitialiser";
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
  const { view, params } = parseHashQuery();
  const ordered = narrativeTagOrder.filter((t) => narrativeTagFilter.has(t));
  if (ordered.length) params.set("tags", ordered.join(","));
  else params.delete("tags");
  const qs = params.toString();
  const next = `#/${view}${qs ? `?${qs}` : ""}`;
  if (location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

function readTagsFromHash() {
  const { params } = parseHashQuery();
  const raw = params.get("tags");
  if (!raw) return new Set();
  const out = new Set();
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (t && narrativeTagLabels[t]) out.add(t);
  }
  return out;
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
  o0.textContent = "Tous les types";
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
    formFilterMode = v === "base_only" || v === "base_regional" ? v : "all";
    try {
      localStorage.setItem(FORM_FILTER_STORAGE_KEY, formFilterMode);
    } catch {
      /* ignore */
    }
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

function setupThemeSelect() {
  const sel = document.getElementById("settingsThemeSelect");
  const T = window.PokevaultThemes;
  if (!sel || !T || sel.dataset.wired) return;
  sel.dataset.wired = "1";
  sel.replaceChildren();
  for (const t of T.list) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label;
    sel.append(opt);
  }
  sel.value = T.current;
  sel.addEventListener("change", () => T.set(sel.value));
  T.subscribe((id) => {
    if (sel.value !== id) sel.value = id;
  });
}

function setupArtworkSelect() {
  const sel = document.getElementById("settingsArtworkSelect");
  const A = window.PokevaultArtwork;
  if (!sel || !A || sel.dataset.wired) return;
  sel.dataset.wired = "1";
  sel.replaceChildren();
  for (const m of A.modes) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    sel.append(opt);
  }
  sel.value = A.mode;
  sel.addEventListener("change", () => A.setMode(sel.value));
  A.subscribe((id) => {
    if (sel.value !== id) sel.value = id;
    if (typeof render === "function") render();
  });
}

function setupProfileSwitcher() {
  const sel = document.getElementById("settingsProfileSelect");
  const nameInput = document.getElementById("settingsProfileNewName");
  const createBtn = document.getElementById("settingsProfileCreateBtn");
  const deleteBtn = document.getElementById("settingsProfileDeleteBtn");
  const hint = document.getElementById("settingsProfileHint");
  const label = document.getElementById("settingsProfileLabel");
  const P = window.PokevaultProfiles;
  if (!sel || !P || sel.dataset.wired) return;
  sel.dataset.wired = "1";

  function showHint(text, variant) {
    if (!hint) return;
    hint.textContent = text || "";
    hint.classList.toggle("sync-hint--err", variant === "err");
    hint.hidden = !text;
  }

  function paint(state) {
    sel.replaceChildren();
    const profiles = state?.profiles || [];
    for (const p of profiles) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.id === "default" ? `${p.name} (défaut)` : p.name;
      sel.append(opt);
    }
    sel.value = state?.active_id || "default";
    if (deleteBtn) deleteBtn.disabled = sel.value === "default";
    if (label) {
      const active = profiles.find((p) => p.id === state?.active_id);
      label.textContent = `Profil : ${active ? active.name : "—"}`;
    }
  }

  P.subscribe(paint);

  sel.addEventListener("change", async () => {
    showHint("Bascule de profil…");
    try {
      await P.setActive(sel.value);
      showHint("Profil actif. Rechargement…");
      setTimeout(() => window.location.reload(), 350);
    } catch (err) {
      showHint(`Erreur : ${err && err.message ? err.message : err}`, "err");
    }
  });

  if (createBtn && nameInput) {
    createBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) {
        showHint("Donne un nom au nouveau profil.", "err");
        return;
      }
      try {
        const created = await P.create(name);
        nameInput.value = "";
        showHint(`Profil « ${created.name} » créé.`);
      } catch (err) {
        showHint(`Erreur création : ${err && err.message ? err.message : err}`, "err");
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const id = sel.value;
      if (id === "default") return;
      const confirmation = window.confirm(
        `Supprimer le profil « ${id} » ? Les fichiers JSON associés resteront sur disque (data/profiles/${id}/), tu peux les effacer à la main si besoin.`,
      );
      if (!confirmation) return;
      try {
        await P.remove(id);
        showHint(`Profil « ${id} » supprimé. Bascule sur défaut…`);
        setTimeout(() => window.location.reload(), 350);
      } catch (err) {
        showHint(`Erreur suppression : ${err && err.message ? err.message : err}`, "err");
      }
    });
  }
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
  setupThemeSelect();
  setupArtworkSelect();
  setupProfileSwitcher();
  paintVersionLabels();
  const versionEl = document.getElementById("settingsVersionLabel");
  const healthEl = document.getElementById("settingsHealthLabel");
  if (versionEl) versionEl.textContent = `UI ${APP_UI_VERSION} · API vérification...`;
  if (healthEl) healthEl.textContent = "État API : vérification...";
  void (async () => {
    try {
      const res = await fetch(API_HEALTH);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const apiVer = String(data?.api_version || "n/a");
      if (versionEl) versionEl.textContent = `UI ${APP_UI_VERSION} · API ${apiVer}`;
      if (healthEl) healthEl.textContent = "État API : ok";
    } catch {
      if (versionEl) versionEl.textContent = `UI ${APP_UI_VERSION} · API indisponible`;
      if (healthEl) healthEl.textContent = "État API : erreur de connexion";
    }
  })();
  setupExportImport();
}

let pendingImportPayload = null;

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
      showHint(`Export : ${Object.keys(data.progress?.caught || {}).length} attrapés, ${(data.binder_config?.binders || []).length} classeurs.`, false);
    } catch (err) {
      showHint(`Échec export : ${err.message}`, true);
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
        if (data.schema_version !== 1) throw new Error("Version de schéma non supportée");
        if (!data.progress || !data.binder_config || !data.binder_placements) {
          throw new Error("Champs requis manquants");
        }
        pendingImportPayload = sanitizeBackupPayloadToCollectionScope(data);
        const caught = Object.keys(pendingImportPayload.progress?.caught || {}).length;
        const binders = (pendingImportPayload.binder_config?.binders || []).length;
        const date = data.exported_at ? new Date(data.exported_at).toLocaleDateString() : "inconnue";
        previewText.textContent = `${caught} attrapés, ${binders} classeurs — export du ${date}. Cela remplacera les données actuelles.`;
        preview.hidden = false;
      } catch (err) {
        showHint(`Fichier invalide: ${err.message}`, true);
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
      showHint(`Import : ${body.caught_count} attrapés, ${body.binder_count} classeurs. Rechargement…`, false);
      pendingImportPayload = null;
      preview.hidden = true;
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      showHint(`Échec import : ${err.message}`, true);
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
      info.textContent = "Le Pokédex reste silencieux sur ce périmètre.";
    } else {
      const caughtVisible = (full || []).filter((p) => Boolean(caughtMap[pokemonKey(p)])).length;
      const pctVisible = total ? Math.round((caughtVisible / total) * 100) : 0;
      info.textContent = `Affichage : 1-${end} sur ${total} entrées filtrées · ${pctVisible}% capturées dans cette vue.`;
    }
  }
  if (endBanner) {
    const done = total > 0 && end >= total;
    endBanner.hidden = !done;
    if (done) endBanner.textContent = `Fin de la liste — ${total} entrées affichées.`;
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
  const shiny = caught && status.shiny;
  const dim = getDimMode();

  const card = document.createElement("button");
  card.type = "button";
  const classParts = ["card"];
  if (caught) classParts.push("is-caught");
  if (seen) classParts.push("is-seen");
  if (shiny) classParts.push("is-shiny");
  card.className = classParts.join(" ");
  if ((dim === "caught" && caught) || (dim === "missing" && !caught)) {
    card.classList.add("is-dimmed");
  }
  card.dataset.slug = key;
  card.dataset.status = status.state;
  if (shiny) card.dataset.shiny = "1";
  card.setAttribute("aria-pressed", caught ? "true" : "false");
  const stateLabel = caught
    ? shiny ? ", attrapé shiny" : ", attrapé"
    : seen ? ", aperçu" : ", non rencontré";
  card.setAttribute(
    "aria-label",
    `${displayName(p)} ${displayNumber(p.number)}${stateLabel}`,
  );

  const top = document.createElement("div");
  top.className = "card-top";
  const numEl = document.createElement("div");
  numEl.className = "card-num";
  numEl.textContent = displayNumber(p.number);
  const statusIcon = document.createElement("span");
  const statusClass = caught ? "is-caught" : seen ? "is-seen" : "is-missing";
  statusIcon.className = `card-status-icon ${statusClass}`;
  statusIcon.textContent = caught
    ? (shiny ? "auto_awesome" : "check_circle")
    : seen
      ? "visibility"
      : "radio_button_unchecked";
  statusIcon.setAttribute("aria-hidden", "true");
  top.append(numEl, statusIcon);
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
  if (!typeList.length) {
    const unknown = document.createElement("span");
    unknown.className = "card-type-badge";
    unknown.textContent = "Inconnu";
    types.append(unknown);
  } else {
    for (const t of typeList) {
      const badge = document.createElement("span");
      badge.className = "card-type-badge";
      badge.textContent = String(t);
      types.append(badge);
    }
  }
  card.append(types);

  const reg = effectiveRegion(p);
  const lbl = p.region_label_fr || regionDefinitions.find((x) => x.id === reg)?.label_fr || reg;
  const tag = document.createElement("div");
  tag.className = "card-region";
  tag.textContent = p.region_native === false ? `${lbl} · forme` : lbl;
  card.append(tag);

  const action = document.createElement("div");
  action.className = "card-action";
  const actionLabel = caught
    ? shiny ? "Shiny — clic pour retirer" : "Attrapé — clic pour retirer"
    : seen
      ? "Aperçu — clic pour marquer attrapé"
      : "Clic pour marquer aperçu";
  action.textContent = actionLabel;
  card.append(action);

  const details = document.createElement("span");
  details.className = "card-details";
  details.textContent = "Fiche & cartes";
  details.setAttribute("role", "button");
  details.setAttribute("tabindex", "-1");
  details.setAttribute("aria-label", `Ouvrir la fiche de ${displayName(p)}`);
  details.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.PokevaultDrawer?.open(key, card);
  });
  card.append(details);

  card.addEventListener("click", (event) => {
    cycleStatusBySlug(key, { shift: event.shiftKey });
  });

  return card;
}

window.PokedexCollection.createPokemonCard = createPokemonCard;
window.PokedexCollection.poolForCollectionScope = poolForCollectionScope;
window.PokedexCollection.computeCardStats = computeCardStats;
window.PokedexCollection.formatCardSummary = formatCardSummary;

function hasActiveFilterExceptMissing() {
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
  const sliced = slicedVisibleList();
  const list = sliced.pageItems;
  const { caught: caughtCount, total: barTotal } = progressForRegionBar();

  document.getElementById("counter").textContent = `${caughtCount} / ${barTotal}`;
  const pct = barTotal ? Math.round((caughtCount / barTotal) * 100) : 0;
  const heroPct = document.getElementById("listHeroPct");
  const heroCount = document.getElementById("listHeroCount");
  const heroCards = document.getElementById("listHeroCards");
  if (heroPct) heroPct.textContent = `${pct}%`;
  if (heroCount) heroCount.textContent = `${caughtCount} / ${barTotal} découverts`;
  if (heroCards) {
    const stats = computeCardStats();
    heroCards.textContent = formatCardSummary(stats);
    heroCards.classList.toggle("is-dormant", stats.cards === 0);
  }
  const fill = document.getElementById("progressFill");
  fill.style.width = `${pct}%`;
  fill.parentElement.setAttribute("aria-valuenow", String(pct));

  grid.replaceChildren();
  if (!sliced.total) {
    const ES = window.PokevaultEmptyStates;
    const collectionEmpty = Object.keys(caughtMap).length === 0;
    const hasActiveFilter =
      searchQuery.trim() !== "" ||
      filterMode !== "all" ||
      regionFilter !== "all" ||
      typeFilter !== "all" ||
      formFilterMode !== "all" ||
      narrativeTagFilter.size > 0;
    let variant = "listNoMatch";
    if (filterMode === "missing" && !hasActiveFilterExceptMissing()) {
      variant = "listAllCaught";
    } else if (collectionEmpty && !hasActiveFilter) {
      variant = "listCollectionEmpty";
    }
    const node = ES?.render
      ? ES.render(grid, variant)
      : (() => {
          const p = document.createElement("p");
          p.className = "empty-state";
          p.textContent = "Aucun Pokémon ne correspond à ce filtre.";
          return p;
        })();
    if (node) grid.append(node);
    updateListDisplayInfo({ full: sliced.full, end: 0, total: 0 });
    return;
  }

  const frag = document.createDocumentFragment();
  for (const p of list) frag.append(createPokemonCard(p));
  grid.append(frag);

  updateListDisplayInfo({ full: sliced.full, end: sliced.end, total: sliced.total });
  window.PokevaultKeyboard?.repaint?.();
}

function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterMode = btn.dataset.filter || "all";
      resetDisplayedCount();
      document.querySelectorAll(".filter-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
  });
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

function readStoredFormFilterMode() {
  try {
    const v = localStorage.getItem(FORM_FILTER_STORAGE_KEY);
    if (v === "base_only" || v === "base_regional") return v;
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
  const hashRegion = readRegionFromHash();
  if (hashRegion) {
    regionFilter = hashRegion;
    const sel = document.getElementById("regionFilter");
    if (sel) sel.value = hashRegion;
  }
  narrativeTagFilter = readTagsFromHash();
  renderRegionChips();
  renderNarrativeChips();
  if (!listCaughtSubscribed) {
    listCaughtSubscribed = true;
    window.PokedexCollection.subscribeCaught(() => render());
  }
  if (!listDimSubscribed) {
    listDimSubscribed = true;
    window.PokedexCollection.subscribeDimMode(() => render());
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
  if (raw === "stats") return "stats";
  if (raw === "classeur") return "classeur";
  if (raw === "settings") return "settings";
  if (raw === "print") return "print";
  if (raw.startsWith("pokemon/")) return "pokemon";
  if (raw === "liste" || raw === "") return "liste";
  return "liste";
}

function currentPokemonSlugFromHash() {
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
}

function applyAppRoute() {
  const view = currentViewFromHash();
  const elListe = document.getElementById("viewListe");
  const elClasseur = document.getElementById("viewClasseur");
  const elStats = document.getElementById("viewStats");
  const elSettings = document.getElementById("viewSettings");
  const elPrint = document.getElementById("viewPrint");
  const elPokemon = document.getElementById("viewPokemon");
  if (elListe) elListe.hidden = view !== "liste";
  if (elClasseur) elClasseur.hidden = view !== "classeur";
  if (elStats) elStats.hidden = view !== "stats";
  if (elSettings) elSettings.hidden = view !== "settings";
  if (elPrint) elPrint.hidden = view !== "print";
  if (elPokemon) elPokemon.hidden = view !== "pokemon";
  updateAppSwitchNav(view);
  const titles = {
    liste: "pokevault — Collection",
    stats: "pokevault — Statistiques",
    settings: "pokevault — Réglages",
    print: "pokevault — Impression",
    classeur: "pokevault — Classeurs",
    pokemon: "pokevault — Fiche Pokédex",
  };
  document.title = titles[view] || "pokevault";
  if (view === "liste" && !listViewStarted) {
    listViewStarted = true;
    void startTracker();
  }
  if (view === "classeur" && typeof window.startBinderV2IfNeeded === "function") {
    window.startBinderV2IfNeeded();
  }
  if (view === "stats" && typeof window.PokedexStats?.start === "function") {
    window.PokedexStats.start();
  }
  if (view === "print" && typeof window.PokedexPrint?.start === "function") {
    window.PokedexPrint.start();
  }
  if (view === "pokemon" && typeof window.PokevaultFullView?.render === "function") {
    window.PokevaultFullView.render(currentPokemonSlugFromHash());
  }
}

window.addEventListener("hashchange", applyAppRoute);

window.applyPokedexAppRoute = applyAppRoute;

void (async () => {
  applyAppRoute();
})();
