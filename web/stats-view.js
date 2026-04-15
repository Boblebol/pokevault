/**
 * Vue Stats — pourcentages et compteurs par région (même périmètre « formes » que la liste).
 */

function nationalNumStats(p) {
  const s = String(p.number || "").replace(/^#/, "").replace(/^0+/, "") || "0";
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function effectiveRegionStats(p, defs) {
  if (p.region) return p.region;
  const n = nationalNumStats(p);
  for (const r of defs) {
    if (r.low <= n && n <= r.high) return r.id;
  }
  return "unknown";
}

function pokemonKeyStats(p) {
  return String(p.slug || "");
}

function filteredPoolForStats() {
  const PC = window.PokedexCollection;
  if (PC?.poolForCollectionScope) return PC.poolForCollectionScope();
  return PC?.allPokemon || [];
}

function appendRow(tbody, cells) {
  const tr = document.createElement("tr");
  for (const c of cells) {
    const td = document.createElement("td");
    td.textContent = c;
    tr.append(td);
  }
  tbody.append(tr);
}

function topMissingTypes(pool, caught, limit = 3) {
  const map = new Map();
  for (const p of pool) {
    if (caught[pokemonKeyStats(p)]) continue;
    for (const t of Array.isArray(p.types) ? p.types : []) {
      const k = String(t || "").trim();
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function renderKpiCard(label, value, sub) {
  const item = document.createElement("article");
  item.className = "stats-kpi-card";
  const l = document.createElement("h3");
  l.className = "stats-kpi-label";
  l.textContent = label;
  const v = document.createElement("p");
  v.className = "stats-kpi-value";
  v.textContent = value;
  const s = document.createElement("p");
  s.className = "stats-kpi-sub";
  s.textContent = sub;
  item.append(l, v, s);
  return item;
}

function renderStats() {
  const host = document.getElementById("statsBody");
  if (!host) return;
  host.replaceChildren();

  const PC = window.PokedexCollection;
  const pool = filteredPoolForStats();
  const defs = PC?.regionDefinitions || [];
  const caught = PC?.caughtMap || {};

  /** @type {Record<string, { label: string; caught: number; total: number }>} */
  const byR = Object.create(null);
  for (const d of defs) {
    byR[d.id] = { label: d.label_fr, caught: 0, total: 0 };
  }

  let gCaught = 0;
  let gTotal = 0;
  for (const p of pool) {
    const rid = effectiveRegionStats(p, defs);
    const k = pokemonKeyStats(p);
    const got = Boolean(caught[k]);
    gTotal += 1;
    if (got) gCaught += 1;
    if (byR[rid]) {
      byR[rid].total += 1;
      if (got) byR[rid].caught += 1;
    } else {
      if (!byR._other) byR._other = { label: "Autre", caught: 0, total: 0 };
      byR._other.total += 1;
      if (got) byR._other.caught += 1;
    }
  }

  const globalPct = gTotal ? Math.round((gCaught / gTotal) * 100) : 0;
  const hasToggle = Boolean(document.getElementById("statsAdvancedToggle"));
  const showAdvanced = hasToggle ? window.__statsAdvancedOpen === true : true;
  const hero = document.createElement("section");
  hero.className = "stats-hero";
  const heroLeft = document.createElement("div");
  heroLeft.className = "stats-hero-left";
  const heroRight = document.createElement("div");
  heroRight.className = "stats-hero-right";
  const heroTitle = document.createElement("h2");
  heroTitle.className = "stats-hero-title";
  heroTitle.textContent = "Global Completion Status";
  const heroPct = document.createElement("p");
  heroPct.className = "stats-hero-pct";
  heroPct.textContent = `${globalPct}% archived`;
  const heroSub = document.createElement("p");
  heroSub.className = "stats-hero-sub";
  heroSub.textContent = `${Math.max(0, gTotal - gCaught)} left to catch · ${gCaught} / ${gTotal}`;
  const ring = document.createElement("div");
  ring.className = "stats-hero-ring";
  const ringVal = document.createElement("span");
  ringVal.className = "stats-hero-ring-value";
  ringVal.textContent = String(Math.max(0, gTotal - gCaught));
  const ringSub = document.createElement("span");
  ringSub.className = "stats-hero-ring-sub";
  ringSub.textContent = "LEFT TO CATCH";
  ring.style.setProperty("--pct", `${Math.max(0, Math.min(100, globalPct))}`);
  ring.append(ringVal, ringSub);
  heroLeft.append(heroTitle, heroPct, heroSub);
  heroRight.append(ring);
  hero.append(heroLeft, heroRight);
  host.append(hero);

  const kpiGrid = document.createElement("section");
  kpiGrid.className = "stats-kpi-grid";
  kpiGrid.append(
    renderKpiCard("Total specimens", String(gTotal), "Entrees suivies dans le dex local"),
    renderKpiCard("Captured", String(gCaught), `${globalPct}% completion globale`),
    renderKpiCard("Left to catch", String(Math.max(0, gTotal - gCaught)), "Priorite collection"),
  );
  host.append(kpiGrid);

  const bento = document.createElement("section");
  bento.className = "stats-bento-grid";
  const regWrap = document.createElement("section");
  regWrap.className = "stats-region-wrap";
  const regTitle = document.createElement("h2");
  regTitle.className = "stats-section-title";
  regTitle.textContent = "Regional Archive";
  regWrap.append(regTitle);

  for (const d of defs) {
    const row = byR[d.id];
    const pct = row.total ? Math.round((row.caught / row.total) * 100) : 0;
    const line = document.createElement("div");
    line.className = "stats-region-line";
    const top = document.createElement("div");
    top.className = "stats-region-top";
    const l = document.createElement("span");
    l.textContent = row.label;
    const r = document.createElement("span");
    r.textContent = `${row.caught} / ${row.total}`;
    top.append(l, r);
    const bar = document.createElement("div");
    bar.className = "stats-region-bar";
    const fill = document.createElement("div");
    fill.className = "stats-region-fill";
    fill.style.width = `${pct}%`;
    bar.append(fill);
    line.append(top, bar);
    regWrap.append(line);
  }
  if (byR._other && byR._other.total > 0) {
    const r = byR._other;
    const pct = r.total ? Math.round((r.caught / r.total) * 100) : 0;
    const line = document.createElement("div");
    line.className = "stats-region-line";
    const top = document.createElement("div");
    top.className = "stats-region-top";
    const l = document.createElement("span");
    l.textContent = r.label;
    const rr = document.createElement("span");
    rr.textContent = `${r.caught} / ${r.total}`;
    top.append(l, rr);
    const bar = document.createElement("div");
    bar.className = "stats-region-bar";
    const fill = document.createElement("div");
    fill.className = "stats-region-fill";
    fill.style.width = `${pct}%`;
    bar.append(fill);
    line.append(top, bar);
    regWrap.append(line);
  }
  regWrap.hidden = !showAdvanced;
  bento.append(regWrap);

  const missing = topMissingTypes(pool, caught, 3);
  if (missing.length) {
    const sec = document.createElement("section");
    sec.className = "stats-gaps";
    const h = document.createElement("h2");
    h.className = "stats-section-title";
    h.textContent = "Archive gaps";
    sec.append(h);
    for (const [type, count] of missing) {
      const line = document.createElement("p");
      line.className = "stats-gap-line";
      line.textContent = `${type} · ${count} specimen(s) manquants`;
      sec.append(line);
    }
    sec.hidden = !showAdvanced;
    bento.append(sec);
  }
  host.append(bento);
}

let statsStarted = false;

function startStatsIfNeeded() {
  void (async () => {
    try {
      await window.PokedexCollection?.ensureLoaded?.();
    } catch {
      /* dex manquant */
    }
    if (!statsStarted) {
      statsStarted = true;
      window.PokedexCollection?.subscribeCaught?.(() => renderStats());
    }
    renderStats();
  })();
}

window.PokedexStats = {
  render: renderStats,
  start: startStatsIfNeeded,
};
