/**
 * Vue impression — checklist textuelle groupée par classeur ou région.
 * Chaque entrée affiche : numéro, nom, page classeur, case, coche attrapé.
 */

let printStarted = false;
let printLocaleSubbed = false;
let printSelectedBinder = "all";
let printSearchQuery = "";
let printArtworkMode = "global";

const PRINT_FALLBACK_I18N = {
  "print.pill.selection": "SÉLECTION",
  "print.pill.active": "ACTIF",
  "print.progress.completed": "{pct}% COMPLÉTÉ",
  "print.all_binders": "Tous les classeurs",
  "print.summary.entries": "{count} entrées",
  "print.subtitle.caught": "{caught}/{total} attrapés ({pct}%)",
  "print.footer": "pokevault · {date} · ☑ = attrapé · ☐ = manquant",
  "print.footer_pocket": "pokevault pocket · {date} · ☑ = attrapé · ☐ = manquant",
  "print.artwork.global": "Comme l'app",
  "print.placeholder.reserve": "Reserve famille",
  "print.placeholder.missing": "Manquant",
  "print.placeholder.caught": "Capture",
  "print.col.name": "Nom",
  "print.col.binder": "Classeur",
  "print.col.page": "Page",
  "print.col.slot": "Case",
  "print.col.note": "Carte / note",
};

function tPrint(key, params = {}) {
  const runtime = window.PokevaultI18n;
  if (runtime?.t) return runtime.t(key, params);
  const template = PRINT_FALLBACK_I18N[key] || key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
  );
}

function formatEntrySummary(count) {
  return tPrint("print.summary.entries", { count });
}

function formatPrintSubtitle(caught, total) {
  const pct = total ? Math.round((caught / total) * 100) : 0;
  return tPrint("print.subtitle.caught", { caught, total, pct });
}

function formatPrintFooter(date, pocket) {
  return tPrint(pocket ? "print.footer_pocket" : "print.footer", { date });
}

async function startPrintView() {
  if (printStarted) {
    renderPrintVaultsNav();
    renderPrintView();
    return;
  }
  printStarted = true;

  await window.PokedexCollection.ensureLoaded();
  if (typeof window.startBinderV2IfNeeded === "function") {
    await window.startBinderV2IfNeeded();
  }
  await fetchBinderConfigIfNeeded();
  const cfg = getBinderConfig();
  if (cfg?.binders?.some((b) => b?.organization === "family")) {
    await window.PokedexBinder?.ensureEvolutionFamiliesLoaded?.();
  }

  wirePrintControls();
  renderPrintVaultsNav();
  renderPrintView();

  if (!printLocaleSubbed) {
    printLocaleSubbed = true;
    window.PokevaultI18n?.subscribeLocale?.(() => {
      fillPrintArtworkOptions(document.getElementById("printArtworkSelect"));
      renderPrintVaultsNav();
      renderPrintView();
    });
  }

  window.PokedexCollection?.subscribeCaught?.(() => {
    renderPrintVaultsNav();
    renderPrintView();
  });
}

function renderPrintVaultsNav() {
  const host = document.getElementById("printVaultsNav");
  if (!host) return;
  const cfg = getBinderConfig();
  const binders = (cfg?.binders || []).filter((b) => b?.id);
  const PC = window.PokedexCollection;
  const B = window.PokedexBinder;
  const allPokemon = PC?.allPokemon || [];
  const defs = PC?.regionDefinitions || [];
  const caught = PC?.caughtMap || {};

  host.replaceChildren();

  const makeItem = ({ id, name, pct, got, total, isAll }) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "binder-vault-item";
    if (String(id) === String(printSelectedBinder)) item.classList.add("is-active");

    const top = document.createElement("div");
    top.className = "binder-vault-item-top";
    const nm = document.createElement("span");
    nm.className = "binder-vault-item-name";
    nm.textContent = name;
    top.append(nm);
    if (String(id) === String(printSelectedBinder)) {
      const pill = document.createElement("span");
      pill.className = "binder-vault-item-pill";
      pill.textContent = isAll ? tPrint("print.pill.selection") : tPrint("print.pill.active");
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
    left.textContent = tPrint("print.progress.completed", { pct });
    const right = document.createElement("span");
    right.textContent = `${got} / ${total}`;
    meta.append(left, right);

    item.append(top, progress, meta);
    item.addEventListener("click", () => {
      printSelectedBinder = String(id);
      renderPrintVaultsNav();
      renderPrintView();
    });
    return item;
  };

  let allGot = 0;
  let allTotal = 0;
  const perBinder = [];
  for (const b of binders) {
    const pool = B?.selectBinderPokemonPool
      ? B.selectBinderPokemonPool(allPokemon, B.getFormRuleForBinder?.(cfg, b))
      : allPokemon;
    const ordered = B?.orderPokemonForBinder ? B.orderPokemonForBinder(b, pool, defs) : pool;
    const realEntries = ordered.filter(Boolean);
    const total = realEntries.length;
    const got = realEntries.filter((p) => p && caught[String(p.slug || "")]).length;
    allGot += got;
    allTotal += total;
    perBinder.push({ binder: b, total, got });
  }

  const allPct = allTotal ? Math.round((allGot / allTotal) * 100) : 0;
  host.append(
    makeItem({
      id: "all",
      name: tPrint("print.all_binders"),
      pct: allPct,
      got: allGot,
      total: allTotal,
      isAll: true,
    }),
  );

  for (const entry of perBinder) {
    const { binder, total, got } = entry;
    const pct = total ? Math.round((got / total) * 100) : 0;
    host.append(
      makeItem({
        id: binder.id,
        name: String(binder.name || binder.id),
        pct,
        got,
        total,
        isAll: false,
      }),
    );
  }
}

function wirePrintControls() {
  const ids = ["printFilterSelect", "printGroupSelect"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && !el.dataset.printWired) {
      el.dataset.printWired = "1";
      el.addEventListener("change", () => renderPrintView());
    }
  }
  const search = document.getElementById("printSearch");
  if (search && !search.dataset.printWired) {
    search.dataset.printWired = "1";
    search.addEventListener("input", () => {
      printSearchQuery = search.value || "";
      renderPrintView();
    });
  }
  const btn = document.getElementById("printBtn");
  if (btn && !btn.dataset.printWired) {
    btn.dataset.printWired = "1";
    btn.addEventListener("click", () => window.print());
  }
  const artwork = document.getElementById("printArtworkSelect");
  if (artwork) {
    fillPrintArtworkOptions(artwork);
    if (!artwork.dataset.printWired) {
      artwork.dataset.printWired = "1";
      artwork.addEventListener("change", () => {
        printArtworkMode = artwork.value || "global";
        renderPrintView();
      });
    }
  }
}

function fillPrintArtworkOptions(sel) {
  if (!sel) return;
  const current = printArtworkMode || "global";
  sel.replaceChildren();

  const addOption = (value, label) => {
    const opt = document.createElement("option");
    opt.value = String(value || "");
    opt.textContent = String(label || value || "");
    sel.append(opt);
  };

  addOption("global", tPrint("print.artwork.global"));
  for (const mode of window.PokevaultArtwork?.modes || []) {
    addOption(mode.id, mode.label || mode.id);
  }

  const values = Array.from(sel.options || []).map((opt) => opt.value);
  printArtworkMode = values.includes(current) ? current : "global";
  sel.value = printArtworkMode;
}

function getBinderConfig() {
  const B = window.PokedexBinder;
  if (B?.cachedConfig) return B.cachedConfig;
  return window._printCachedConfig || null;
}

async function fetchBinderConfigIfNeeded() {
  if (getBinderConfig()) return;
  try {
    const res = await fetch("/api/binder/config");
    if (res.ok) {
      window._printCachedConfig = await res.json();
    }
  } catch { /* ignore */ }
}

function getSelectedBinder() {
  return printSelectedBinder || "all";
}

function getSelectedFilter() {
  return document.getElementById("printFilterSelect")?.value || "all";
}

function getSelectedGroup() {
  return document.getElementById("printGroupSelect")?.value || "binder";
}

function matchesPrintSearch(p, q) {
  if (!q) return true;
  const qq = q.toLowerCase().trim();
  if (!qq) return true;
  const num = String(p.number || "").toLowerCase();
  const names = p.names || {};
  const blob = [num, names.fr, names.en, names.ja, p.slug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes(qq);
}

function pageKeyForSlot(slot, binderId = "") {
  const id = String(slot?.binderId || binderId || "");
  const page = Number(slot?.page) || 1;
  return `${id}:${page}`;
}

function displayEnglishNamePrint(p) {
  const n = p?.names || {};
  return n.en || n.ja || p?.slug || "";
}

function placeholderStatusLabel(caught) {
  return tPrint(caught ? "print.placeholder.caught" : "print.placeholder.missing");
}

function pokemonCaughtPrint(p, caughtMap = {}) {
  const slug = String(p?.slug || "");
  if (!slug) return false;
  return caughtMap instanceof Map ? Boolean(caughtMap.get(slug)) : Boolean(caughtMap[slug]);
}

function normalizedDefaultArtworkPrint(p) {
  const raw = String(p?.image || "");
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function shinyArtworkPathPrint(p) {
  const slug = String(p?.slug || "");
  if (!slug) return "";
  return `/data/images_shiny/${encodeURIComponent(slug)}.png`;
}

function shinyCdnArtworkPathPrint(p) {
  const slug = String(p?.slug || "");
  const m = slug.match(/^(\d{1,4})/);
  if (!m) return "";
  const natId = Number.parseInt(m[1], 10);
  if (!Number.isFinite(natId) || natId <= 0) return "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${natId}.png`;
}

function defaultArtworkResultPrint(p) {
  return { src: normalizedDefaultArtworkPrint(p), fallbacks: [] };
}

function resolvePrintArtwork(p, mode = printArtworkMode) {
  const A = window.PokevaultArtwork;
  const selected = mode || "global";

  if (selected === "global") {
    return A?.resolve ? A.resolve(p) : defaultArtworkResultPrint(p);
  }
  if (A?.resolveForMode) {
    return A.resolveForMode(p, selected);
  }
  if (selected === "default") {
    return defaultArtworkResultPrint(p);
  }
  if (selected === "shiny") {
    const def = normalizedDefaultArtworkPrint(p);
    const chain = [shinyArtworkPathPrint(p), shinyCdnArtworkPathPrint(p), def].filter(
      (url, idx, arr) => url && arr.indexOf(url) === idx,
    );
    return { src: chain[0] || def, fallbacks: chain.slice(1) };
  }
  if (selected === "card") {
    if (A?.resolve && A.mode === "card") return A.resolve(p);
    return defaultArtworkResultPrint(p);
  }

  return defaultArtworkResultPrint(p);
}

function buildPlaceholderSection(binder = {}, slots = [], caughtMap = {}, filterMode = "all", searchQuery = printSearchQuery) {
  if (binder && typeof binder === "object" && !Array.isArray(binder) && Array.isArray(binder.slots)) {
    const opts = binder;
    return buildPlaceholderSection(
      opts.binder || {},
      opts.slots,
      opts.caughtMap || {},
      opts.filterMode || "all",
      opts.searchQuery ?? printSearchQuery,
    );
  }

  const sourceSlots = Array.isArray(slots) ? slots : [];
  const firstSlot = sourceSlots.find(Boolean) || {};
  const binderId = String(binder?.id || firstSlot.binderId || "");
  const title = String(binder?.name || binder?.id || firstSlot.binderName || binderId || "");
  const rows = Math.max(1, Number(binder?.rows) || 3);
  const cols = Math.max(1, Number(binder?.cols) || 3);
  const pagesByKey = new Map();

  const ensurePage = (rawSlot) => {
    const page = Number(rawSlot.page) || 1;
    const sheet = Number(rawSlot.sheet) || Math.floor((page - 1) / 2) + 1;
    const face = rawSlot.face || (page % 2 === 1 ? "R" : "V");
    const key = pageKeyForSlot(rawSlot, binderId);
    if (!pagesByKey.has(key)) {
      pagesByKey.set(key, {
        key,
        binderId: String(rawSlot.binderId || binderId),
        page,
        sheet,
        face,
        slots: [],
        hasVisiblePokemon: false,
      });
    }
    return pagesByKey.get(key);
  };

  for (const rawSlot of sourceSlots) {
    if (!rawSlot || rawSlot.emptyKind === "capacity_empty") continue;

    const p = rawSlot.pokemon || null;
    let caught = false;
    if (p) {
      caught = pokemonCaughtPrint(p, caughtMap);
      if (filterMode === "caught" && !caught) continue;
      if (filterMode === "missing" && caught) continue;
      if (!matchesPrintSearch(p, searchQuery)) continue;
    }

    const page = Number(rawSlot.page) || 1;
    const sheet = Number(rawSlot.sheet) || Math.floor((page - 1) / 2) + 1;
    const face = rawSlot.face || (page % 2 === 1 ? "R" : "V");
    const pageEntry = ensurePage(rawSlot);
    if (p) pageEntry.hasVisiblePokemon = true;

    pageEntry.slots.push({
      ...rawSlot,
      binderId: String(rawSlot.binderId || binderId),
      binderName: String(rawSlot.binderName || title),
      page,
      sheet,
      face,
      slot: Number(rawSlot.slot) || 1,
      row: Number(rawSlot.row) || 1,
      col: Number(rawSlot.col) || 1,
      pokemon: p,
      emptyKind: rawSlot.emptyKind || null,
      title: p ? displayNamePrint(p) : tPrint("print.placeholder.reserve"),
      subtitle: p ? displayEnglishNamePrint(p) : "",
      number: p ? displayNumPrint(p.number) : "",
      caught,
      status: p ? placeholderStatusLabel(caught) : "",
    });
  }

  const pages = Array.from(pagesByKey.values())
    .filter((page) => page.hasVisiblePokemon)
    .sort((a, b) => a.page - b.page)
    .map((page) => ({
      key: page.key,
      binderId: page.binderId,
      page: page.page,
      sheet: page.sheet,
      face: page.face,
      slots: page.slots.slice().sort((a, b) =>
        (a.row - b.row) || (a.col - b.col) || (a.slot - b.slot),
      ),
    }));

  return { binderId, title, rows, cols, pages };
}

function renderPrintView() {
  const output = document.getElementById("printOutput");
  const summary = document.getElementById("printSummary");
  if (!output) return;
  output.replaceChildren();

  const PC = window.PokedexCollection;
  const allPokemon = PC?.allPokemon || [];
  // Aligne Print sur la meme base que la liste (pas de formes specifiques non souhaitees).
  const listScopedPokemon = PC?.poolForCollectionScope ? PC.poolForCollectionScope() : allPokemon;
  const caughtMap = PC?.caughtMap || {};
  const defs = PC?.regionDefinitions || [];
  const cfg = getBinderConfig();
  const binders = (cfg?.binders || []).filter((b) => b?.id);
  const filterMode = getSelectedFilter();
  const groupMode = getSelectedGroup();
  const selectedBinder = getSelectedBinder();

  const date = new Date().toLocaleDateString(window.PokevaultI18n?.getLocale?.() === "en" ? "en-US" : "fr-FR");
  let totalEntries = 0;

  let sectionIdx = 0;

  output.classList.toggle("is-pocket", groupMode === "pocket");
  output.classList.toggle("is-placeholders", groupMode === "placeholders");

  if (groupMode === "placeholders") {
    const targetBinders = selectedBinder === "all"
      ? binders
      : binders.filter((b) => String(b.id) === selectedBinder);

    for (const binder of targetBinders) {
      const section = buildPlaceholderSectionForBinder(
        binder,
        listScopedPokemon,
        caughtMap,
        defs,
        cfg,
        filterMode,
      );
      totalEntries += section.pages.reduce(
        (sum, page) => sum + page.slots.filter((slot) => slot.pokemon).length,
        0,
      );
      output.append(buildPlaceholderSectionElement(section, date, sectionIdx++ > 0));
    }
  } else if (groupMode === "pocket") {
    const sections = buildRegionSections(
      listScopedPokemon,
      binders,
      caughtMap,
      defs,
      cfg,
      filterMode,
      selectedBinder,
    );
    for (const section of sections) {
      totalEntries += section.rows.length;
      output.append(buildPocketSectionElement(section, date, sectionIdx++ > 0));
    }
  } else if (groupMode === "region") {
    const sections = buildRegionSections(
      listScopedPokemon,
      binders,
      caughtMap,
      defs,
      cfg,
      filterMode,
      selectedBinder,
    );
    for (const section of sections) {
      totalEntries += section.rows.length;
      output.append(buildSectionElement(section, date, true, sectionIdx++ > 0));
    }
  } else {
    const targetBinders = selectedBinder === "all"
      ? binders
      : binders.filter((b) => String(b.id) === selectedBinder);

    for (const binder of targetBinders) {
      const section = buildBinderSection(binder, listScopedPokemon, caughtMap, defs, cfg, filterMode);
      totalEntries += section.rows.length;
      output.append(buildSectionElement(section, date, false, sectionIdx++ > 0));
    }
  }

  if (summary) {
    summary.textContent = formatEntrySummary(totalEntries);
  }

  if (totalEntries === 0) {
    const ES = window.PokevaultEmptyStates;
    if (ES?.render) {
      const node = ES.render(output, "printEmpty");
      if (node) output.append(node);
    }
  }
}

function buildPlaceholderSectionForBinder(binder, allPokemon, caughtMap, defs, cfg, filterMode) {
  const B = window.PokedexBinder;
  const rule = B?.getFormRuleForBinder?.(cfg, binder) || null;
  const pool = rule && B?.selectBinderPokemonPool
    ? B.selectBinderPokemonPool(allPokemon, rule)
    : allPokemon;
  const slots = window.PokevaultBinderLayout?.computeBinderSlots
    ? window.PokevaultBinderLayout.computeBinderSlots({
        binder,
        pokemon: pool,
        defs,
        familyData: B?.cachedFamilyData || null,
        includeCapacity: true,
      })
    : [];
  return buildPlaceholderSection(
    binder,
    Array.isArray(slots) ? slots : [],
    caughtMap,
    filterMode,
    printSearchQuery,
  );
}

function buildBinderSection(binder, allPokemon, caughtMap, defs, cfg, filterMode) {
  const B = window.PokedexBinder;
  const rule = B?.getFormRuleForBinder?.(cfg, binder) || null;
  const pool = rule && B?.selectBinderPokemonPool
    ? B.selectBinderPokemonPool(allPokemon, rule)
    : allPokemon;
  const ordered = B?.orderPokemonForBinder
    ? B.orderPokemonForBinder(binder, pool, defs)
    : pool;

  const perFace = Math.max(1, (Number(binder.rows) || 3) * (Number(binder.cols) || 3));
  const rows = [];

  for (let i = 0; i < ordered.length; i++) {
    const p = ordered[i];
    if (!p) continue;
    const slug = String(p.slug || "");
    const caught = Boolean(caughtMap[slug]);
    if (filterMode === "caught" && !caught) continue;
    if (filterMode === "missing" && caught) continue;
    if (!matchesPrintSearch(p, printSearchQuery)) continue;

    const pageIdx = Math.floor(i / perFace);
    const slotIdx = (i % perFace) + 1;
    const sheetNum = Math.floor(pageIdx / 2) + 1;
    const face = pageIdx % 2 === 0 ? "R" : "V";

    rows.push({
      number: displayNumPrint(p.number),
      name: displayNamePrint(p),
      page: `P${pageIdx + 1}`,
      pageDetail: `f.${sheetNum}${face}`,
      slot: slotIdx,
      caught,
    });
  }

  const realEntries = ordered.filter(Boolean);
  const total = realEntries.length;
  const caughtCount = realEntries.filter((p) => p && caughtMap[String(p.slug || "")]).length;

  return {
    title: String(binder.name || binder.id),
    subtitle: formatPrintSubtitle(caughtCount, total),
    rows,
    showBinderCol: false,
  };
}

function buildRegionSections(allPokemon, binders, caughtMap, defs, cfg, filterMode, selectedBinder) {
  const B = window.PokedexBinder;
  const binderLookup = buildBinderLookup(binders, allPokemon, defs, cfg);
  const sections = [];

  for (const region of defs) {
    const regionPokemon = allPokemon.filter((p) => {
      const reg = effectiveRegionPrint(p, defs);
      return reg === region.id;
    });

    const rows = [];
    for (const p of regionPokemon) {
      const slug = String(p.slug || "");
      const caught = Boolean(caughtMap[slug]);
      if (filterMode === "caught" && !caught) continue;
      if (filterMode === "missing" && caught) continue;
      if (!matchesPrintSearch(p, printSearchQuery)) continue;

      const placement = binderLookup[slug];
      if (selectedBinder !== "all" && (!placement || placement.binderId !== selectedBinder)) continue;

      rows.push({
        number: displayNumPrint(p.number),
        name: displayNamePrint(p),
        page: placement ? placement.page : "—",
        pageDetail: placement ? placement.pageDetail : "",
        slot: placement ? placement.slot : "—",
        caught,
        binderName: placement ? placement.binderName : "—",
      });
    }

    if (rows.length === 0) continue;

    const caughtCount = rows.filter((r) => r.caught).length;
    sections.push({
      title: `${region.label_fr} (${region.low}–${region.high})`,
      subtitle: formatPrintSubtitle(caughtCount, rows.length),
      rows,
      showBinderCol: true,
    });
  }

  return sections;
}

function buildBinderLookup(binders, allPokemon, defs, cfg) {
  const B = window.PokedexBinder;
  const lookup = {};

  for (const binder of binders) {
    const rule = B?.getFormRuleForBinder?.(cfg, binder) || null;
    const pool = rule && B?.selectBinderPokemonPool
      ? B.selectBinderPokemonPool(allPokemon, rule)
      : allPokemon;
    const ordered = B?.orderPokemonForBinder
      ? B.orderPokemonForBinder(binder, pool, defs)
      : pool;

    const perFace = Math.max(1, (Number(binder.rows) || 3) * (Number(binder.cols) || 3));

    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      if (!p) continue;
      const slug = String(p.slug || "");
      if (lookup[slug]) continue;

      const pageIdx = Math.floor(i / perFace);
      const slotIdx = (i % perFace) + 1;
      const sheetNum = Math.floor(pageIdx / 2) + 1;
      const face = pageIdx % 2 === 0 ? "R" : "V";

      lookup[slug] = {
        binderId: String(binder.id),
        binderName: String(binder.name || binder.id),
        page: `P${pageIdx + 1}`,
        pageDetail: `f.${sheetNum}${face}`,
        slot: slotIdx,
      };
    }
  }

  return lookup;
}

function buildSectionElement(section, date, showBinderCol, pageBreakBefore) {
  const frag = document.createDocumentFragment();
  const wrapper = document.createElement("div");
  wrapper.className = "print-section";
  if (pageBreakBefore) wrapper.classList.add("print-page-break");

  const h2 = document.createElement("h2");
  h2.className = "print-section-title";
  h2.textContent = `${section.title} — ${section.subtitle}`;
  wrapper.append(h2);

  const table = document.createElement("table");
  table.className = "print-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const cols = ["#", tPrint("print.col.name")];
  if (section.showBinderCol) cols.push(tPrint("print.col.binder"));
  cols.push(tPrint("print.col.page"), tPrint("print.col.slot"), "✓");
  for (const col of cols) {
    const th = document.createElement("th");
    th.textContent = col;
    if (col === "✓") th.className = "print-check";
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const row of section.rows) {
    const tr = document.createElement("tr");
    if (row.caught) tr.className = "is-caught";

    const tdNum = document.createElement("td");
    tdNum.textContent = row.number;
    tr.append(tdNum);

    const tdName = document.createElement("td");
    tdName.textContent = row.name;
    tr.append(tdName);

    if (section.showBinderCol) {
      const tdBinder = document.createElement("td");
      tdBinder.textContent = row.binderName || "—";
      tr.append(tdBinder);
    }

    const tdPage = document.createElement("td");
    tdPage.textContent = row.pageDetail ? `${row.page} ${row.pageDetail}` : row.page;
    tr.append(tdPage);

    const tdSlot = document.createElement("td");
    tdSlot.textContent = String(row.slot);
    tr.append(tdSlot);

    const tdCheck = document.createElement("td");
    tdCheck.className = "print-check";
    tdCheck.textContent = row.caught ? "☑" : "☐";
    tr.append(tdCheck);

    tbody.append(tr);
  }
  table.append(tbody);
  wrapper.append(table);

  const footer = document.createElement("div");
  footer.className = "print-footer";
  footer.textContent = formatPrintFooter(date, false);
  wrapper.append(footer);

  frag.append(wrapper);
  return frag;
}

function buildPlaceholderSectionElement(section, date, pageBreakBefore) {
  const frag = document.createDocumentFragment();
  const cols = Math.max(1, Number(section.cols) || 3);

  section.pages.forEach((page, pageIdx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "print-placeholder-page";
    if (pageBreakBefore || pageIdx > 0) wrapper.classList.add("print-page-break");

    const h2 = document.createElement("h2");
    h2.className = "print-section-title print-placeholder-page__title";
    h2.textContent = `${section.title} — P${page.page} f.${page.sheet}${page.face}`;
    wrapper.append(h2);

    const grid = document.createElement("div");
    grid.className = "print-placeholder-grid";
    grid.style.setProperty("--placeholder-cols", String(cols));
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    for (const slot of page.slots) {
      grid.append(buildPlaceholderCardElement(slot));
    }
    wrapper.append(grid);

    const footer = document.createElement("div");
    footer.className = "print-footer";
    footer.textContent = formatPrintFooter(date, false);
    wrapper.append(footer);

    frag.append(wrapper);
  });

  return frag;
}

function buildPlaceholderCardElement(slot) {
  const article = document.createElement("article");
  article.className = "print-placeholder-card";
  article.classList.add(
    slot.emptyKind === "family_reserved"
      ? "print-placeholder-card--reserved"
      : "print-placeholder-card--pokemon",
  );
  article.style.gridColumn = String(Math.max(1, Number(slot.col) || 1));
  article.style.gridRow = String(Math.max(1, Number(slot.row) || 1));

  if (slot.emptyKind === "family_reserved") {
    article.textContent = tPrint("print.placeholder.reserve");
    return article;
  }

  const p = slot.pokemon || {};
  const top = document.createElement("div");
  top.className = "print-placeholder-card__top";
  const num = document.createElement("span");
  num.textContent = slot.number || displayNumPrint(p.number);
  const status = document.createElement("span");
  status.textContent = slot.status || placeholderStatusLabel(slot.caught);
  top.append(num, status);
  article.append(top);

  const artwork = window.PokevaultArtwork;
  const resolved = resolvePrintArtwork(p);
  if (resolved?.src) {
    const img = document.createElement("img");
    img.className = "print-placeholder-card__image";
    img.alt = slot.title || displayNamePrint(p);
    img.loading = "eager";
    img.decoding = "sync";
    if (artwork?.attach) {
      artwork.attach(img, resolved);
    } else {
      img.src = resolved.src;
    }
    article.append(img);
  }

  const title = document.createElement("strong");
  title.textContent = slot.title || displayNamePrint(p);
  article.append(title);

  const subtitle = document.createElement("span");
  subtitle.textContent = slot.subtitle || displayEnglishNamePrint(p);
  article.append(subtitle);

  const meta = document.createElement("small");
  meta.textContent = `${slot.binderName} · P${slot.page} f.${slot.sheet}${slot.face} · case ${slot.slot}`;
  article.append(meta);

  return article;
}

function buildPocketSectionElement(section, date, pageBreakBefore) {
  const frag = document.createDocumentFragment();
  const wrapper = document.createElement("div");
  wrapper.className = "print-section print-section--pocket";
  if (pageBreakBefore) wrapper.classList.add("print-page-break");

  const h2 = document.createElement("h2");
  h2.className = "print-section-title";
  h2.textContent = `${section.title} — ${section.subtitle}`;
  wrapper.append(h2);

  const table = document.createElement("table");
  table.className = "print-table print-table--pocket";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const col of ["#", tPrint("print.col.name"), "✓", tPrint("print.col.note")]) {
    const th = document.createElement("th");
    th.textContent = col;
    if (col === "✓") th.className = "print-check";
    if (col === "Carte / note") th.className = "print-note-col";
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const row of section.rows) {
    const tr = document.createElement("tr");
    if (row.caught) tr.className = "is-caught";

    const tdNum = document.createElement("td");
    tdNum.textContent = row.number;
    tr.append(tdNum);

    const tdName = document.createElement("td");
    tdName.textContent = row.name;
    tr.append(tdName);

    const tdCheck = document.createElement("td");
    tdCheck.className = "print-check";
    tdCheck.textContent = row.caught ? "☑" : "☐";
    tr.append(tdCheck);

    const tdNote = document.createElement("td");
    tdNote.className = "print-note-col";
    tdNote.textContent = "";
    tr.append(tdNote);

    tbody.append(tr);
  }
  table.append(tbody);
  wrapper.append(table);

  const footer = document.createElement("div");
  footer.className = "print-footer";
  footer.textContent = formatPrintFooter(date, true);
  wrapper.append(footer);

  frag.append(wrapper);
  return frag;
}

function displayNumPrint(num) {
  const n = String(num || "").replace(/^#/, "");
  const stripped = n.replace(/^0+/, "") || "0";
  return `#${stripped}`;
}

function displayNamePrint(p) {
  const n = p.names || {};
  return n.fr || n.en || n.ja || p.slug || "?";
}

function effectiveRegionPrint(p, defs) {
  if (p.region) return p.region;
  const s = String(p.number || "").replace(/^#/, "").replace(/^0+/, "") || "0";
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return "unknown";
  for (const r of defs) {
    if (r.low <= n && n <= r.high) return r.id;
  }
  return "unknown";
}

window.PokedexPrint = {
  start() {
    void startPrintView();
  },
};

if (window.__POKEVAULT_PRINT_TESTS__) {
  window.PokedexPrint._test = {
    formatEntrySummary,
    formatPrintSubtitle,
    formatPrintFooter,
    buildPlaceholderSection,
    buildPlaceholderCardElement,
    resolvePrintArtwork,
    setPrintArtworkMode(mode) {
      printArtworkMode = mode || "global";
    },
  };
}
