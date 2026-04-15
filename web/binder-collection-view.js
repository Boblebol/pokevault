/**
 * Vue classeur : grille synchronisée avec la progression (même caughtMap que la liste),
 * choix du classeur, navigation feuillet recto/verso.
 */

/** @type {{ cfg: object | null; binderId: string; sheet: number; face: number; ordered: unknown[] }} */
const shellState = {
  cfg: null,
  binderId: "",
  sheet: 0,
  face: 0,
  ordered: [],
};

let shellInited = false;
/** @type {(() => void) | null} */
let unsubCaught = null;
let shellDimSubbed = false;

function regionDefLabelBinder(defs, id) {
  const d = defs.find((r) => r && r.id === id);
  return d ? String(d.label_fr) : String(id);
}

/** @param {Record<string, unknown>} b */
function binderScopeId(b) {
  return String(b?.region_scope || b?.region_id || "");
}

function countBindersWithScope(binders, scope) {
  if (!scope) return 0;
  return binders.filter((x) => binderScopeId(x) === scope).length;
}

function ordinalBinderScope(binders, idx) {
  const scope = binderScopeId(binders[idx]);
  if (!scope) return 0;
  let k = 0;
  for (let i = 0; i <= idx; i++) {
    if (binderScopeId(binders[i]) === scope) k += 1;
  }
  return k;
}

function getActiveBinder(cfg) {
  const binders = listBindersForCurrentMode(cfg);
  if (!binders.length) return null;
  const id = shellState.binderId;
  const b = binders.find((x) => x && x.id === id) || binders[0];
  return b;
}

function binderSortKeyForRegionMode(b, defs) {
  const scope = binderScopeId(b);
  const idx = defs.findIndex((r) => r && r.id === scope);
  return {
    idx: idx >= 0 ? idx : Number.MAX_SAFE_INTEGER,
    name: String(b?.name || ""),
  };
}

function listBindersForCurrentMode(cfg) {
  const all = (cfg && Array.isArray(cfg.binders) ? cfg.binders : []).filter((b) => b && b.id);
  const defs = window.PokedexCollection?.regionDefinitions || [];
  const scoped = all.filter((b) => binderScopeId(b));
  if (!scoped.length) return all;
  return [...scoped].sort((a, b) => {
    const ka = binderSortKeyForRegionMode(a, defs);
    const kb = binderSortKeyForRegionMode(b, defs);
    if (ka.idx !== kb.idx) return ka.idx - kb.idx;
    return ka.name.localeCompare(kb.name, "fr");
  });
}

function slotsPerFace(binder) {
  const r = Number(binder.rows) || 3;
  const c = Number(binder.cols) || 3;
  return Math.max(1, r * c);
}

function maxGlobalFaceIndex(binder) {
  const sheets = Math.max(1, Number(binder.sheet_count) || 1);
  return sheets * 2 - 1;
}

function totalLogicalPages(binder) {
  return maxGlobalFaceIndex(binder) + 1;
}

/**
 * Première page seule : une grille ; ensuite jusqu’à deux pages côte à côte.
 * @param {number} start
 * @param {number} totalPages
 */
function visibleSpreadFromStart(start, totalPages) {
  if (totalPages <= 1) return 1;
  if (start === 0) return 1;
  return Math.min(2, totalPages - start);
}

function binderPagerGoNext(binder) {
  const total = totalLogicalPages(binder);
  const s = globalFaceIndex();
  const step = visibleSpreadFromStart(s, total);
  setGlobalFaceIndex(binder, Math.min(total - 1, s + step));
}

function binderPagerGoPrev(binder) {
  const s = globalFaceIndex();
  if (s === 0) return;
  if (s === 1) {
    setGlobalFaceIndex(binder, 0);
    return;
  }
  setGlobalFaceIndex(binder, Math.max(0, s - 2));
}

function globalFaceIndex() {
  return shellState.sheet * 2 + shellState.face;
}

function setGlobalFaceIndex(binder, idx) {
  const max = maxGlobalFaceIndex(binder);
  const clamped = Math.max(0, Math.min(max, idx));
  shellState.sheet = Math.floor(clamped / 2);
  shellState.face = clamped % 2;
}

function updateFaceLabel(binder, start, nShow) {
  const el = document.getElementById("binderFaceLabel");
  if (!el || !binder) return;
  const sheets = Math.max(1, Number(binder.sheet_count) || 1);
  const bits = [];
  for (let j = 0; j < nShow; j++) {
    const pi = start + j;
    const sheetNum = Math.floor(pi / 2) + 1;
    const faceLab = pi % 2 === 0 ? "Recto" : "Verso";
    bits.push(`Page ${pi + 1} (f.${sheetNum}/${sheets} ${faceLab})`);
  }
  el.textContent = bits.join(" · ");
}

function fillBinderSelect(cfg) {
  const sel = document.getElementById("binderIdSelect");
  if (!sel || !cfg) return;
  const binders = listBindersForCurrentMode(cfg);
  const defs = window.PokedexCollection?.regionDefinitions || [];
  const keep = shellState.binderId;
  sel.replaceChildren();
  binders.forEach((b, idx) => {
    const o = document.createElement("option");
    o.value = String(b.id);
    const scope = binderScopeId(b);
    let label = "";
    if (scope) {
      const base = regionDefLabelBinder(defs, scope);
      const nSame = countBindersWithScope(binders, scope);
      const ord = ordinalBinderScope(binders, idx);
      label = nSame > 1 ? `${base} (${ord})` : base;
    } else if (binders.length > 1) {
      const nm = b.name && String(b.name).trim() ? String(b.name) : "Sans nom";
      label = `Classeur ${idx + 1} — ${nm}`;
    } else {
      label = b.name ? String(b.name) : "Classeur";
    }
    o.textContent = label;
    sel.append(o);
  });
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
  else if (sel.options[0]) {
    sel.value = sel.options[0].value;
    shellState.binderId = sel.value;
  }
}

function renderVaultsNav(cfg, activeBinderId, ordered) {
  const host = document.getElementById("binderVaultsNav");
  const PC = window.PokedexCollection;
  if (!host || !cfg) return;
  host.replaceChildren();
  const binders = listBindersForCurrentMode(cfg);
  const defs = PC?.regionDefinitions || [];
  const caught = PC?.caughtMap || {};
  for (const b of binders) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "binder-vault-item";
    if (String(b.id) === String(activeBinderId)) item.classList.add("is-active");
    const pool = window.PokedexBinder?.selectBinderPokemonPool
      ? window.PokedexBinder.selectBinderPokemonPool(PC?.allPokemon || [], window.PokedexBinder.getFormRuleForBinder?.(cfg, b))
      : PC?.allPokemon || [];
    const ord = ordered && String(b.id) === String(activeBinderId)
      ? ordered
      : window.PokedexBinder?.orderPokemonForBinder
        ? window.PokedexBinder.orderPokemonForBinder(b, pool, defs)
        : [];
    const total = ord.length;
    const got = ord.filter((p) => p && caught[String(p.slug || "")]).length;
    const pct = total ? Math.round((got / total) * 100) : 0;
    const top = document.createElement("div");
    top.className = "binder-vault-item-top";
    const nm = document.createElement("span");
    nm.className = "binder-vault-item-name";
    nm.textContent = String(b.name || "Vault");
    top.append(nm);
    if (String(b.id) === String(activeBinderId)) {
      const pill = document.createElement("span");
      pill.className = "binder-vault-item-pill";
      pill.textContent = "ACTIVE";
      top.append(pill);
    }
    const progress = document.createElement("div");
    progress.className = "binder-vault-progress";
    const fill = document.createElement("div");
    fill.className = "binder-vault-progress-fill";
    fill.style.width = `${pct}%`;
    progress.append(fill);
    const meta = document.createElement("p");
    meta.className = "binder-vault-meta";
    const left = document.createElement("span");
    left.textContent = `${pct}% COMPLETE`;
    const right = document.createElement("span");
    right.textContent = `${got} / ${total}`;
    meta.append(left, right);
    item.append(top, progress, meta);
    item.addEventListener("click", () => {
      shellState.binderId = String(b.id);
      shellState.sheet = 0;
      shellState.face = 0;
      const sel = document.getElementById("binderIdSelect");
      if (sel) sel.value = String(b.id);
      renderBinderPageGrid();
    });
    host.append(item);
  }
}

function renderBinderPageGrid() {
  const host = document.getElementById("binderPagesHost");
  const hint = document.getElementById("binderShellHint");
  const metricsHost = document.getElementById("binderMetrics");
  const cfg = shellState.cfg;
  const binder = getActiveBinder(cfg);
  const PC = window.PokedexCollection;
  if (!host || !binder || !window.PokedexBinder?.orderPokemonForBinder) {
    if (host) host.replaceChildren();
    if (metricsHost) metricsHost.replaceChildren();
    return;
  }

  const raw = PC?.allPokemon && PC.allPokemon.length ? PC.allPokemon : [];
  const defs = PC?.regionDefinitions || [];
  const poolSelector = window.PokedexBinder?.selectBinderPokemonPool;
  const matchesBinderRule = window.PokedexBinder?.pokemonMatchesBinderRule;
  const rule =
    cfg && window.PokedexBinder?.getFormRuleForBinder && window.PokedexBinder?.pokemonMatchesFormRule
      ? window.PokedexBinder.getFormRuleForBinder(cfg, binder)
      : null;
  const pokemon = rule
    ? poolSelector
      ? poolSelector(raw, rule)
      : raw.filter((p) =>
          matchesBinderRule
            ? matchesBinderRule(p, rule)
            : window.PokedexBinder.pokemonMatchesFormRule(p, rule),
        )
    : raw;
  shellState.ordered = window.PokedexBinder.orderPokemonForBinder(binder, pokemon, defs);
  renderVaultsNav(cfg, binder.id, shellState.ordered);

  const rows = Math.max(1, Number(binder.rows) || 3);
  const cols = Math.max(1, Number(binder.cols) || 3);
  const perFace = slotsPerFace(binder);
  const pageStart = globalFaceIndex();
  const totalPages = totalLogicalPages(binder);
  const nShow = visibleSpreadFromStart(pageStart, totalPages);
  const makeCard = window.PokedexCollection?.createPokemonCard;

  host.replaceChildren();
  host.classList.toggle("is-double-spread", nShow === 2);

  for (let j = 0; j < nShow; j++) {
    const pageIdx = pageStart + j;
    const panel = document.createElement("div");
    panel.className = "binder-page-panel";
    const title = document.createElement("h3");
    title.className = "binder-page-panel-title";
    const sheets = Math.max(1, Number(binder.sheet_count) || 1);
    const sheetNum = Math.floor(pageIdx / 2) + 1;
    const faceLab = pageIdx % 2 === 0 ? "Recto" : "Verso";
    title.textContent = `Page ${pageIdx + 1} — Feuillet ${sheetNum}/${sheets} · ${faceLab}`;
    const grid = document.createElement("div");
    grid.className = "binder-page-grid binder-page-grid--cards";
    grid.setAttribute("role", "grid");
    grid.style.setProperty("--binder-cols", String(cols));
    grid.style.setProperty("--binder-rows", String(rows));
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    const slotOffset = pageIdx * perFace;

    for (let i = 0; i < perFace; i++) {
      const idx = slotOffset + i;
      const p = shellState.ordered[idx];
      if (makeCard) {
        const card = p ? makeCard(p) : makeCard(null, { empty: true });
        if (card) {
          card.classList.add("binder-card");
          grid.append(card);
        }
      } else {
        const ph = document.createElement("div");
        ph.className = "card card--empty-slot";
        ph.textContent = "…";
        grid.append(ph);
      }
    }
    panel.append(title, grid);
    host.append(panel);
  }

  if (metricsHost) {
    metricsHost.replaceChildren();
    const totalEntries = shellState.ordered.length;
    const totalCaught = shellState.ordered.filter((p) => p && PC?.caughtMap?.[String(p.slug || "")]).length;
    const pct = totalEntries ? Math.round((totalCaught / totalEntries) * 100) : 0;

    const makeMetric = (label, value, sub) => {
      const card = document.createElement("article");
      card.className = "binder-metric-card";
      const h = document.createElement("h3");
      h.textContent = label;
      const p = document.createElement("p");
      p.textContent = value;
      const s = document.createElement("span");
      s.textContent = sub;
      card.append(h, p, s);
      return card;
    };

    metricsHost.append(
      makeMetric("Completion", `${pct}%`, `${totalCaught} / ${totalEntries}`),
      makeMetric("Page spread", `${pageStart + 1}-${pageStart + nShow}`, `${totalPages} pages`),
    );
  }

  if (hint) {
    const total = shellState.ordered.length;
    const firstSlot = pageStart * perFace;
    const lastIdx =
      total > 0 ? Math.min(total - 1, pageStart * perFace + nShow * perFace - 1) : -1;
    const modeText = "Classeurs régionaux en format 3×3.";
    hint.textContent =
      total === 0
        ? `${modeText} Charge le Pokédex (make web) pour remplir les cases.`
        : `${modeText} Emplacements ${firstSlot + 1}–${lastIdx + 1} sur ${total} entrées (même coches que la liste).`;
  }

  updateFaceLabel(binder, pageStart, nShow);
}

function wirePager() {
  const prev = document.getElementById("binderFacePrev");
  const next = document.getElementById("binderFaceNext");
  if (prev && !prev.dataset.shellWired) {
    prev.dataset.shellWired = "1";
    prev.addEventListener("click", () => {
      const binder = getActiveBinder(shellState.cfg);
      if (!binder) return;
      binderPagerGoPrev(binder);
      renderBinderPageGrid();
    });
  }
  if (next && !next.dataset.shellWired) {
    next.dataset.shellWired = "1";
    next.addEventListener("click", () => {
      const binder = getActiveBinder(shellState.cfg);
      if (!binder) return;
      binderPagerGoNext(binder);
      renderBinderPageGrid();
    });
  }
}

function wireBinderSelect() {
  const sel = document.getElementById("binderIdSelect");
  if (!sel || sel.dataset.shellWired) return;
  sel.dataset.shellWired = "1";
  sel.addEventListener("change", () => {
    shellState.binderId = sel.value || "";
    shellState.sheet = 0;
    shellState.face = 0;
    renderBinderPageGrid();
  });
}

function syncFromConfig(cfg) {
  shellState.cfg = cfg;
  const empty = !cfg || !Array.isArray(cfg.binders) || cfg.binders.length === 0;
  if (empty) {
    shellState.binderId = "";
    shellState.ordered = [];
    const grid = document.getElementById("binderPagesHost");
    if (grid) grid.replaceChildren();
    return;
  }
  fillBinderSelect(cfg);
  const binder = getActiveBinder(cfg);
  if (binder && !shellState.binderId) shellState.binderId = binder.id;
  shellState.sheet = 0;
  shellState.face = 0;
  renderBinderPageGrid();
}

function initBinderShell() {
  if (shellInited) return;
  shellInited = true;
  window.PokedexCollection?.wireDimModeSelectsOnce?.();
  if (!shellDimSubbed) {
    shellDimSubbed = true;
    window.PokedexCollection?.subscribeDimMode?.(() => {
      const cfg = shellState.cfg;
      const empty = !cfg || !Array.isArray(cfg.binders) || !cfg.binders.length;
      if (!empty) renderBinderPageGrid();
    });
  }
  wirePager();
  wireBinderSelect();
  unsubCaught = window.PokedexCollection?.subscribeCaught?.(() => {
    const cfg = shellState.cfg;
    const empty = !cfg || !Array.isArray(cfg.binders) || !cfg.binders.length;
    if (!empty) renderBinderPageGrid();
  });
}

window.PokedexBinderShell = {
  init() {
    initBinderShell();
  },
  syncFromConfig(cfg) {
    syncFromConfig(cfg);
  },
};
