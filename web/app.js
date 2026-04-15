/**
 * Collection — liste et classeurs partagent la même progression (slug → attrapé).
 * Routage : #/liste et #/classeur.
 */

const API_PROGRESS = "/api/progress";
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
let listPage = 1;
const LIST_PAGE_SIZE = 48;
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

function pagedVisibleList() {
  const full = visibleList();
  const total = full.length;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const current = Math.max(1, Math.min(totalPages, listPage));
  const start = (current - 1) * LIST_PAGE_SIZE;
  const end = Math.min(total, start + LIST_PAGE_SIZE);
  return {
    full,
    pageItems: full.slice(start, end),
    total,
    start,
    end,
    current,
    totalPages,
  };
}

function showDexError(grid) {
  grid.replaceChildren();
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

function setupRegionFilter() {
  const sel = document.getElementById("regionFilter");
  if (!sel || sel.dataset.wired) return;
  sel.dataset.wired = "1";
  sel.addEventListener("change", () => {
    regionFilter = sel.value || "all";
    listPage = 1;
    render();
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
    listPage = 1;
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
    listPage = 1;
    render();
  });
}

function setupListPagination() {
  const prev = document.getElementById("listPagePrev");
  const next = document.getElementById("listPageNext");
  if (prev && !prev.dataset.wired) {
    prev.dataset.wired = "1";
    prev.addEventListener("click", () => {
      listPage = Math.max(1, listPage - 1);
      render();
    });
  }
  if (next && !next.dataset.wired) {
    next.dataset.wired = "1";
    next.addEventListener("click", () => {
      listPage += 1;
      render();
    });
  }
}

function setupAdvancedFiltersToggle() {
  const btn = document.getElementById("advancedFiltersToggle");
  const panel = document.getElementById("advancedFiltersPanel");
  if (!btn || !panel || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    btn.classList.toggle("is-active", willOpen);
  });
}

function setupStatsAdvancedToggle() {
  const btn = document.getElementById("statsAdvancedToggle");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", () => {
    const current = window.__statsAdvancedOpen === true;
    window.__statsAdvancedOpen = !current;
    btn.setAttribute("aria-expanded", !current ? "true" : "false");
    btn.classList.toggle("is-active", !current);
    if (window.PokedexStats?.render) window.PokedexStats.render();
  });
}

function setupBinderAdvancedToggle() {
  const btn = document.getElementById("binderAdvancedToggle");
  const panel = document.getElementById("binderAdvancedPanel");
  const extras = document.getElementById("binderExtrasWrap");
  if (!btn || !panel || !extras || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    extras.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.classList.toggle("is-active", open);
  });
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
}

function renderPageNumbers(current, totalPages) {
  const host = document.getElementById("listPageNumbers");
  if (!host) return;
  host.replaceChildren();
  if (totalPages <= 1) return;
  const pages = new Set([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  let last = 0;
  for (const p of sorted) {
    if (p - last > 1) {
      const sep = document.createElement("span");
      sep.className = "list-page-sep";
      sep.textContent = "…";
      host.append(sep);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `list-page-num${p === current ? " is-active" : ""}`;
    btn.textContent = String(p);
    btn.setAttribute("aria-label", `Aller a la page ${p}`);
    btn.addEventListener("click", () => {
      listPage = p;
      render();
    });
    host.append(btn);
    last = p;
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
    unknown.textContent = "Unknown";
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
  action.textContent = caught ? "Release Specimen" : "Register Catch";
  card.append(action);

  card.addEventListener("click", () => {
    toggleCaughtBySlug(key);
  });

  return card;
}

window.PokedexCollection.createPokemonCard = createPokemonCard;
window.PokedexCollection.poolForCollectionScope = poolForCollectionScope;

function render() {
  const grid = document.getElementById("grid");
  const footer = document.getElementById("listFooterMeta");
  const pageInfo = document.getElementById("listPageInfo");
  const prevBtn = document.getElementById("listPagePrev");
  const nextBtn = document.getElementById("listPageNext");
  const paged = pagedVisibleList();
  const list = paged.pageItems;
  listPage = paged.current;
  const { caught: caughtCount, total: barTotal } = progressForRegionBar();

  document.getElementById("counter").textContent = `${caughtCount} / ${barTotal}`;
  const pct = barTotal ? Math.round((caughtCount / barTotal) * 100) : 0;
  const heroPct = document.getElementById("listHeroPct");
  const heroCount = document.getElementById("listHeroCount");
  if (heroPct) heroPct.textContent = `${pct}%`;
  if (heroCount) heroCount.textContent = `${caughtCount} / ${barTotal} discovered`;
  const fill = document.getElementById("progressFill");
  fill.style.width = `${pct}%`;
  fill.parentElement.setAttribute("aria-valuenow", String(pct));

  grid.replaceChildren();
  if (!paged.total) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Aucun Pokémon ne correspond à ce filtre.";
    grid.append(empty);
    if (footer) footer.textContent = "0 resultat sur le perimetre courant.";
    if (pageInfo) pageInfo.textContent = "Page 1 / 1";
    renderPageNumbers(1, 1);
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  for (const p of list) {
    grid.append(createPokemonCard(p));
  }

  if (pageInfo) pageInfo.textContent = `Page ${paged.current} / ${paged.totalPages}`;
  renderPageNumbers(paged.current, paged.totalPages);
  if (prevBtn) prevBtn.disabled = paged.current <= 1;
  if (nextBtn) nextBtn.disabled = paged.current >= paged.totalPages;

  if (footer) {
    const totalVisible = paged.total;
    const pctVisible = totalVisible
      ? Math.round(
          (paged.full.filter((p) => Boolean(caughtMap[pokemonKey(p)])).length / totalVisible) * 100,
        )
      : 0;
    footer.textContent = `Affichage: ${paged.start + 1}-${paged.end} sur ${totalVisible} entrees filtrees · ${pctVisible}% capturees dans cette vue.`;
  }
}

function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterMode = btn.dataset.filter || "all";
      listPage = 1;
      document.querySelectorAll(".filter-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      render();
    });
  });
}

function setupSearch() {
  const input = document.getElementById("search");
  input.addEventListener("input", () => {
    searchQuery = input.value;
    listPage = 1;
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

async function startTrackerV1() {
  formFilterMode = readStoredFormFilterMode();
  typeFilter = readStoredTypeFilter();
  setupFilters();
  setupSearch();
  setupRegionFilter();
  setupTypeFilter();
  setupFormFilter();
  setupListPagination();
  setupAdvancedFiltersToggle();
  setupStatsAdvancedToggle();
  setupBinderAdvancedToggle();
  setupSettingsView();
  const formSel = document.getElementById("formFilter");
  if (formSel) formSel.value = formFilterMode;
  wireDimModeSelectsOnce();
  try {
    await getCollectionBootstrap();
  } catch {
    return;
  }
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
  const raw = (location.hash || "#/liste").replace(/^#/, "").replace(/^\//, "");
  if (raw === "stats") return "stats";
  if (raw === "classeur") return "classeur";
  if (raw === "settings") return "settings";
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
  if (elListe) elListe.hidden = view !== "liste";
  if (elClasseur) elClasseur.hidden = view !== "classeur";
  if (elStats) elStats.hidden = view !== "stats";
  if (elSettings) elSettings.hidden = view !== "settings";
  updateAppSwitchNav(view);
  document.title =
    view === "liste"
      ? "Collection — Liste"
      : view === "stats"
        ? "Collection — Stats"
        : view === "settings"
          ? "Collection — Settings"
          : "Collection — Classeurs";
  if (view === "liste" && !listViewStarted) {
    listViewStarted = true;
    void startTrackerV1();
  }
  if (view === "classeur" && typeof window.startBinderV2IfNeeded === "function") {
    window.startBinderV2IfNeeded();
  }
  if (view === "stats" && typeof window.PokedexStats?.start === "function") {
    window.PokedexStats.start();
  }
}

window.addEventListener("hashchange", applyAppRoute);

window.applyPokedexAppRoute = applyAppRoute;

void (async () => {
  if (typeof window.PokedexOnboarding?.bootstrapOnboarding === "function") {
    await window.PokedexOnboarding.bootstrapOnboarding();
  }
  applyAppRoute();
})();
