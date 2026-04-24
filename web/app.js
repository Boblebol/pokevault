/**
 * Collection — liste et classeurs partagent la même progression (slug → attrapé).
 * Routage : #/liste et #/classeur.
 */

const API_PROGRESS = "/api/progress";
const API_HEALTH = "/api/health";
const APP_UI_VERSION = "2026.04.17-p2";
const PROGRESS_QUEUE_KEY = "pokedex_progress_queue";
const FORM_FILTER_STORAGE_KEY = "pokedexFormFilter";
const TYPE_FILTER_STORAGE_KEY = "pokedexTypeFilter";

let allPokemon = [];
let caughtMap = Object.create(null);
let filterMode = "all";
let regionFilter = "all";
let searchQuery = "";
let totalCount = 0;
/** @type {"all" | "base_only" | "base_regional"} */
let formFilterMode = "all";
let typeFilter = "all";
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
    let fileCaught = {};
    try {
      fileCaught = await fetchProgressFile();
    } catch {
      const hint = document.getElementById("syncHint");
      if (hint) {
        hint.textContent =
          "Progression fichier indisponible — lance « make web » depuis la racine du projet.";
        hint.hidden = false;
      }
    }
    const rawCaught = fileCaught && typeof fileCaught === "object" ? fileCaught : {};
    caughtMap = Object.create(null);
    for (const [k, v] of Object.entries(rawCaught)) {
      if (v) caughtMap[k] = true;
    }

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
      const res = await fetch(API_PROGRESS, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.slug, caught: item.caught }),
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

async function persistCaughtPatch(slug, caught) {
  const hint = document.getElementById("syncHint");
  try {
    const res = await fetch(API_PROGRESS, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, caught }),
    });
    if (!res.ok) throw new Error(String(res.status));
    await flushOfflineProgressQueue();
    if (hint) hint.hidden = true;
  } catch {
    const q = loadProgressQueue();
    q.push({ slug, caught, ts: Date.now() });
    saveProgressQueue(q);
    if (hint) {
      hint.textContent = "Hors ligne ou serveur indisponible — synchro différée.";
      hint.hidden = false;
    }
  }
}

function toggleCaughtBySlug(slug) {
  if (!slug) return;
  const willCatch = !caughtMap[slug];
  if (willCatch) caughtMap[slug] = true;
  else delete caughtMap[slug];
  void persistCaughtPatch(slug, willCatch);
  for (const cb of caughtUiListeners) {
    try {
      cb();
    } catch {
      /* ignore */
    }
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
  return data.caught && typeof data.caught === "object" ? data.caught : {};
}

function matchesSearch(p, q) {
  if (!q) return true;
  const qq = q.toLowerCase().trim();
  const num = String(p.number || "").toLowerCase();
  const form = (p.form || "").toLowerCase();
  const names = p.names || {};
  const blob = [num, form, names.fr, names.en, names.ja, p.slug].filter(Boolean).join(" ").toLowerCase();
  return blob.includes(qq);
}

function matchesFilter(p) {
  const k = pokemonKey(p);
  const got = !!caughtMap[k];
  if (filterMode === "caught") return got;
  if (filterMode === "missing") return !got;
  return true;
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
      matchesRegion(p),
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
  const caught = Boolean(caughtMap[key]);
  const dim = getDimMode();

  const card = document.createElement("button");
  card.type = "button";
  card.className = `card${caught ? " is-caught" : ""}`;
  if ((dim === "caught" && caught) || (dim === "missing" && !caught)) {
    card.classList.add("is-dimmed");
  }
  card.dataset.slug = key;
  card.setAttribute("aria-pressed", caught ? "true" : "false");
  card.setAttribute(
    "aria-label",
    `${displayName(p)} ${displayNumber(p.number)}${caught ? ", attrapé" : ", manquant"}`,
  );

  const top = document.createElement("div");
  top.className = "card-top";
  const numEl = document.createElement("div");
  numEl.className = "card-num";
  numEl.textContent = displayNumber(p.number);
  const status = document.createElement("span");
  status.className = `card-status-icon ${caught ? "is-caught" : "is-missing"}`;
  status.textContent = caught ? "check_circle" : "radio_button_unchecked";
  status.setAttribute("aria-hidden", "true");
  top.append(numEl, status);
  card.append(top);

  const imgWrap = document.createElement("div");
  imgWrap.className = "card-img-wrap";
  const glow = document.createElement("div");
  glow.className = "card-glow";
  imgWrap.append(glow);
  const src = normalizePath(p.image);
  if (src) {
    const img = document.createElement("img");
    img.className = "card-img";
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.remove();
      const ph = document.createElement("div");
      ph.className = "card-img-placeholder";
      imgWrap.append(ph);
    });
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
  action.textContent = caught ? "Retirer de la collection" : "Marquer comme attrapé";
  card.append(action);

  card.addEventListener("click", () => {
    toggleCaughtBySlug(key);
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
    formFilterMode !== "all"
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
      formFilterMode !== "all";
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
  renderRegionChips();
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
  if (raw === "liste" || raw === "") return "liste";
  return "liste";
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
  if (elListe) elListe.hidden = view !== "liste";
  if (elClasseur) elClasseur.hidden = view !== "classeur";
  if (elStats) elStats.hidden = view !== "stats";
  if (elSettings) elSettings.hidden = view !== "settings";
  if (elPrint) elPrint.hidden = view !== "print";
  updateAppSwitchNav(view);
  const titles = {
    liste: "pokevault — Collection",
    stats: "pokevault — Statistiques",
    settings: "pokevault — Réglages",
    print: "pokevault — Impression",
    classeur: "pokevault — Classeurs",
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
}

window.addEventListener("hashchange", applyAppRoute);

window.applyPokedexAppRoute = applyAppRoute;

void (async () => {
  applyAppRoute();
})();
