/**
 * Vue Stats — pourcentages et compteurs par région (même périmètre « formes » que la liste).
 */

const STATS_FALLBACK_I18N = {
  "stats.next_badge": "Prochain badge",
  "stats.badge": "Badge",
  "stats.rail_caught": "{caught} / {total} attrapés",
  "stats.rail_missing": "{count} manquants",
  "stats.other": "Autre",
  "stats.hero_title": "État global de complétion",
  "stats.hero_pct": "{pct}% complété",
  "stats.hero_sub": "{missing} manquants · {caught} / {total}",
  "stats.hero_ring": "A ATTRAPER",
  "stats.kpi.total": "Total spécimens",
  "stats.kpi.total_sub": "Entrées suivies dans le Pokédex local",
  "stats.kpi.caught": "Attrapés",
  "stats.kpi.caught_sub": "{pct}% de complétion globale",
  "stats.kpi.missing": "Manquants",
  "stats.kpi.missing_sub": "Priorité collection",
  "stats.kpi.cards": "Cartes cataloguées",
  "stats.kpi.cards_empty": "Ajoute une carte pour activer le suivi TCG",
  "stats.kpi.cards_sets": "{sets} set(s) catalogué(s)",
  "stats.region_archive": "Archive régionale",
  "stats.collection_gaps": "Lacunes de collection",
  "stats.gap_line": "{type} · {count} spécimen(s) manquants",
  "stats.objective_title": "Objectif session — {region}",
  "stats.why": "Pourquoi ? {reason}",
  "stats.all_regions": "Toutes régions",
  "stats.type_completion": "Complétion par type",
};

function tStats(key, params = {}) {
  const runtime = window.PokevaultI18n;
  if (runtime?.t) return runtime.t(key, params);
  const template = STATS_FALLBACK_I18N[key] || key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
  );
}

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

function renderKpiCard(label, value, sub, modifier) {
  const item = document.createElement("article");
  item.className = "stats-kpi-card";
  if (modifier) item.classList.add(modifier);
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

function renderStatsRailBadge(badge) {
  const host = document.getElementById("statsRailBadge");
  if (!host) return;
  host.replaceChildren();
  if (!badge || badge.unlocked) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const title = document.createElement("p");
  title.className = "stats-rail-badge__kicker";
  title.textContent = tStats("stats.next_badge");
  const name = document.createElement("p");
  name.className = "stats-rail-badge__title";
  name.textContent = badge.title || tStats("stats.badge");
  const meta = document.createElement("p");
  meta.className = "stats-rail-badge__meta";
  meta.textContent = `${badge.current || 0} / ${badge.target || 1} · ${badge.hint || ""}`;
  const bar = document.createElement("div");
  bar.className = "stats-rail-badge__bar";
  const fill = document.createElement("span");
  fill.className = "stats-rail-badge__fill";
  fill.style.width = `${Math.max(0, Math.min(100, Number(badge.percent) || 0))}%`;
  bar.append(fill);
  host.append(title, name, meta, bar);
}

function renderStatsRail(caught, total) {
  const pct = total ? Math.round((caught / total) * 100) : 0;
  const pctEl = document.getElementById("statsRailPct");
  const countEl = document.getElementById("statsRailCount");
  const missingEl = document.getElementById("statsRailMissing");
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (countEl) countEl.textContent = tStats("stats.rail_caught", { caught, total });
  if (missingEl) missingEl.textContent = tStats("stats.rail_missing", { count: Math.max(0, total - caught) });
  renderStatsRailBadge(window.PokevaultBadges?.nearest?.());
}

function renderStats() {
  const host = document.getElementById("statsBody");
  if (!host) return;
  host.replaceChildren();

  const PC = window.PokedexCollection;
  const pool = filteredPoolForStats();
  const defs = PC?.regionDefinitions || [];
  const caught = PC?.caughtMap || {};

  const nothingCaught = Object.keys(caught).length === 0;
  if (nothingCaught || pool.length === 0) {
    const ES = window.PokevaultEmptyStates;
    if (ES?.render) {
      const node = ES.render(host, "statsEmpty");
      if (node) host.append(node);
      renderStatsRail(0, pool.length);
      window.PokevaultFocus?.refresh?.();
      return;
    }
  }

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
      if (!byR._other) byR._other = { label: tStats("stats.other"), caught: 0, total: 0 };
      byR._other.total += 1;
      if (got) byR._other.caught += 1;
    }
  }

  const globalPct = gTotal ? Math.round((gCaught / gTotal) * 100) : 0;
  renderStatsRail(gCaught, gTotal);
  const showAdvanced = true;
  const hero = document.createElement("section");
  hero.className = "stats-hero";
  const heroLeft = document.createElement("div");
  heroLeft.className = "stats-hero-left";
  const heroRight = document.createElement("div");
  heroRight.className = "stats-hero-right";
  const heroTitle = document.createElement("h2");
  heroTitle.className = "stats-hero-title";
  heroTitle.textContent = tStats("stats.hero_title");
  const heroPct = document.createElement("p");
  heroPct.className = "stats-hero-pct";
  heroPct.textContent = tStats("stats.hero_pct", { pct: globalPct });
  const heroSub = document.createElement("p");
  heroSub.className = "stats-hero-sub";
  heroSub.textContent = tStats("stats.hero_sub", {
    missing: Math.max(0, gTotal - gCaught),
    caught: gCaught,
    total: gTotal,
  });
  const ring = document.createElement("div");
  ring.className = "stats-hero-ring";
  const ringVal = document.createElement("span");
  ringVal.className = "stats-hero-ring-value";
  ringVal.textContent = String(Math.max(0, gTotal - gCaught));
  const ringSub = document.createElement("span");
  ringSub.className = "stats-hero-ring-sub";
  ringSub.textContent = tStats("stats.hero_ring");
  ring.style.setProperty("--pct", `${Math.max(0, Math.min(100, globalPct))}`);
  ring.append(ringVal, ringSub);
  heroLeft.append(heroTitle, heroPct, heroSub);
  heroRight.append(ring);
  hero.append(heroLeft, heroRight);
  host.append(hero);

  const kpiGrid = document.createElement("section");
  kpiGrid.className = "stats-kpi-grid";
  const cardStats = PC?.computeCardStats ? PC.computeCardStats() : { cards: 0, sets: 0 };
  const cardSub =
    cardStats.cards === 0
      ? tStats("stats.kpi.cards_empty")
      : tStats("stats.kpi.cards_sets", { sets: cardStats.sets });
  kpiGrid.append(
    renderKpiCard(tStats("stats.kpi.total"), String(gTotal), tStats("stats.kpi.total_sub")),
    renderKpiCard(tStats("stats.kpi.caught"), String(gCaught), tStats("stats.kpi.caught_sub", { pct: globalPct })),
    renderKpiCard(tStats("stats.kpi.missing"), String(Math.max(0, gTotal - gCaught)), tStats("stats.kpi.missing_sub")),
    renderKpiCard(
      tStats("stats.kpi.cards"),
      String(cardStats.cards),
      cardSub,
      cardStats.cards === 0 ? "is-dormant" : "",
    ),
  );
  host.append(kpiGrid);

  const bento = document.createElement("section");
  bento.className = "stats-bento-grid";
  const regWrap = document.createElement("section");
  regWrap.className = "stats-region-wrap";
  const regTitle = document.createElement("h2");
  regTitle.className = "stats-section-title";
  regTitle.textContent = tStats("stats.region_archive");
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
    h.textContent = tStats("stats.collection_gaps");
    sec.append(h);
    for (const [type, count] of missing) {
      const line = document.createElement("p");
      line.className = "stats-gap-line";
      line.textContent = tStats("stats.gap_line", { type, count });
      sec.append(line);
    }
    sec.hidden = !showAdvanced;
    bento.append(sec);
  }

  const objective = window.PokevaultRecommendations?.rankTargets?.({
    pool,
    caughtMap: caught,
    statusMap: PC?.statusMap || {},
    huntMap: window.PokevaultHunts?.state?.hunts || {},
    regionDefinitions: defs,
    limit: 6,
  }) || { targetRegion: tStats("stats.all_regions"), reason: "", rows: [] };
  if (objective.rows.length) {
    const sec = document.createElement("section");
    sec.className = "stats-gaps";
    const h = document.createElement("h2");
    h.className = "stats-section-title";
    h.textContent = tStats("stats.objective_title", { region: objective.targetRegion });
    sec.append(h);
    if (objective.reason) {
      const why = document.createElement("p");
      why.className = "stats-gap-line stats-gap-line--why";
      why.textContent = tStats("stats.why", { reason: objective.reason });
      sec.append(why);
    }
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
    h.textContent = tStats("stats.type_completion");
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
  window.PokevaultFocus?.refresh?.();
}

let statsStarted = false;
let statsLocaleSubbed = false;

function renderBadgesBlock() {
  const host = document.getElementById("statsBadges");
  if (!host) return;
  const B = window.PokevaultBadges;
  if (!B) return;
  B.renderInto(host);
}

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
      window.PokevaultBadges?.subscribe?.(() => {
        renderStats();
        renderBadgesBlock();
      });
    }
    if (!statsLocaleSubbed) {
      statsLocaleSubbed = true;
      window.PokevaultI18n?.subscribeLocale?.(() => {
        renderStats();
        renderBadgesBlock();
      });
    }
    renderStats();
    window.PokevaultBadges?.poll?.().then(() => renderBadgesBlock());
  })();
}

window.PokedexStats = {
  render: renderStats,
  start: startStatsIfNeeded,
};
