/**
 * Vue impression — checklist textuelle groupée par classeur ou région.
 * Chaque entrée affiche : numéro, nom, page classeur, case, coche attrapé.
 */

let printStarted = false;
let printSelectedBinder = "all";
let printSearchQuery = "";

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
      pill.textContent = isAll ? "SÉLECTION" : "ACTIF";
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
    left.textContent = `${pct}% COMPLÉTÉ`;
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
      name: "Tous les classeurs",
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

  const date = new Date().toLocaleDateString();
  let totalEntries = 0;

  let sectionIdx = 0;

  output.classList.toggle("is-pocket", groupMode === "pocket");

  if (groupMode === "pocket") {
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
    summary.textContent = `${totalEntries} entrées`;
  }

  if (totalEntries === 0) {
    const ES = window.PokevaultEmptyStates;
    if (ES?.render) {
      const node = ES.render(output, "printEmpty");
      if (node) output.append(node);
    }
  }
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
    subtitle: `${caughtCount}/${total} attrapés (${total ? Math.round((caughtCount / total) * 100) : 0}%)`,
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
    subtitle: `${caughtCount}/${rows.length} attrapés (${rows.length ? Math.round((caughtCount / rows.length) * 100) : 0}%)`,
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
  const cols = ["#", "Nom"];
  if (section.showBinderCol) cols.push("Classeur");
  cols.push("Page", "Case", "✓");
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
  footer.textContent = `pokevault · ${date} · ☑ = attrapé · ☐ = manquant`;
  wrapper.append(footer);

  frag.append(wrapper);
  return frag;
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
  for (const col of ["#", "Nom", "✓", "Carte / note"]) {
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
  footer.textContent = `pokevault pocket · ${date} · ☑ = attrapé · ☐ = manquant`;
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
