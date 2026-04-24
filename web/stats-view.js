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

function typeCompletionRows(pool, caught) {
  const byType = new Map();
  for (const p of pool) {
    const got = Boolean(caught[pokemonKeyStats(p)]);
    const types = Array.isArray(p.types) ? p.types : [];
    for (const t of types) {
      const key = String(t || "").trim();
      if (!key) continue;
      const cur = byType.get(key) || { type: key, caught: 0, total: 0 };
      cur.total += 1;
      if (got) cur.caught += 1;
      byType.set(key, cur);
    }
  }
  return [...byType.values()]
    .map((r) => ({
      ...r,
      pct: r.total ? Math.round((r.caught / r.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.type.localeCompare(b.type, "fr"));
}

function nextPriorityRows(pool, caught, defs, limit = 6) {
  const missing = pool.filter((p) => !caught[pokemonKeyStats(p)]);
  if (!missing.length) return { targetRegion: "Toutes régions", rows: [] };
  const byRegion = new Map();
  for (const p of missing) {
    const rid = effectiveRegionStats(p, defs);
    const n = byRegion.get(rid) || 0;
    byRegion.set(rid, n + 1);
  }
  let targetRegion = "Toutes régions";
  let targetId = "";
  let max = -1;
  for (const [rid, n] of byRegion.entries()) {
    if (n > max) {
      max = n;
      targetId = rid;
    }
  }
  if (targetId) {
    targetRegion = defs.find((d) => d.id === targetId)?.label_fr || targetId;
  }
  const scoped = targetId ? missing.filter((p) => effectiveRegionStats(p, defs) === targetId) : missing;
  const sorted = [...scoped].sort((a, b) => nationalNumStats(a) - nationalNumStats(b));
  return { targetRegion, rows: sorted.slice(0, limit) };
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
  const showAdvanced = true;
  const hero = document.createElement("section");
  hero.className = "stats-hero";
  const heroLeft = document.createElement("div");
  heroLeft.className = "stats-hero-left";
  const heroRight = document.createElement("div");
  heroRight.className = "stats-hero-right";
  const heroTitle = document.createElement("h2");
  heroTitle.className = "stats-hero-title";
  heroTitle.textContent = "État global de complétion";
  const heroPct = document.createElement("p");
  heroPct.className = "stats-hero-pct";
  heroPct.textContent = `${globalPct}% complété`;
  const heroSub = document.createElement("p");
  heroSub.className = "stats-hero-sub";
  heroSub.textContent = `${Math.max(0, gTotal - gCaught)} manquants · ${gCaught} / ${gTotal}`;
  const ring = document.createElement("div");
  ring.className = "stats-hero-ring";
  const ringVal = document.createElement("span");
  ringVal.className = "stats-hero-ring-value";
  ringVal.textContent = String(Math.max(0, gTotal - gCaught));
  const ringSub = document.createElement("span");
  ringSub.className = "stats-hero-ring-sub";
  ringSub.textContent = "A ATTRAPER";
  ring.style.setProperty("--pct", `${Math.max(0, Math.min(100, globalPct))}`);
  ring.append(ringVal, ringSub);
  heroLeft.append(heroTitle, heroPct, heroSub);
  heroRight.append(ring);
  hero.append(heroLeft, heroRight);
  host.append(hero);

  const kpiGrid = document.createElement("section");
  kpiGrid.className = "stats-kpi-grid";
  kpiGrid.append(
    renderKpiCard("Total spécimens", String(gTotal), "Entrées suivies dans le Pokédex local"),
    renderKpiCard("Attrapés", String(gCaught), `${globalPct}% de complétion globale`),
    renderKpiCard("Manquants", String(Math.max(0, gTotal - gCaught)), "Priorité collection"),
  );
  host.append(kpiGrid);

  const bento = document.createElement("section");
  bento.className = "stats-bento-grid";
  const regWrap = document.createElement("section");
  regWrap.className = "stats-region-wrap";
  const regTitle = document.createElement("h2");
  regTitle.className = "stats-section-title";
  regTitle.textContent = "Archive régionale";
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
    h.textContent = "Lacunes de collection";
    sec.append(h);
    for (const [type, count] of missing) {
      const line = document.createElement("p");
      line.className = "stats-gap-line";
      line.textContent = `${type} · ${count} spécimen(s) manquants`;
      sec.append(line);
    }
    sec.hidden = !showAdvanced;
    bento.append(sec);
  }

  const objective = nextPriorityRows(pool, caught, defs, 6);
  if (objective.rows.length) {
    const sec = document.createElement("section");
    sec.className = "stats-gaps";
    const h = document.createElement("h2");
    h.className = "stats-section-title";
    h.textContent = `Objectif session — ${objective.targetRegion}`;
    sec.append(h);
    for (const p of objective.rows) {
      const line = document.createElement("p");
      line.className = "stats-gap-line";
      const num = String(p.number || "").replace(/^#/, "");
      const name = p?.names?.fr || p?.names?.en || p?.slug || "?";
      line.textContent = `#${num} · ${name}`;
      sec.append(line);
    }
    bento.append(sec);
  }

  const types = typeCompletionRows(pool, caught);
  if (types.length) {
    const sec = document.createElement("section");
    sec.className = "stats-region-wrap";
    const h = document.createElement("h2");
    h.className = "stats-section-title";
    h.textContent = "Complétion par type";
    sec.append(h);
    for (const row of types) {
      const line = document.createElement("div");
      line.className = "stats-region-line";
      const top = document.createElement("div");
      top.className = "stats-region-top";
      const left = document.createElement("span");
      left.textContent = `${row.type} · ${row.pct}%`;
      const right = document.createElement("span");
      right.textContent = `${row.caught} / ${row.total}`;
      top.append(left, right);
      const bar = document.createElement("div");
      bar.className = "stats-region-bar";
      const fill = document.createElement("div");
      fill.className = "stats-region-fill";
      fill.style.width = `${row.pct}%`;
      bar.append(fill);
      line.append(top, bar);
      sec.append(line);
    }
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
