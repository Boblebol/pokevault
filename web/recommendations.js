/**
 * Pokevault — shared next-best-action recommendations.
 *
 * This module is deliberately small and deterministic. It ranks local
 * collection targets; it does not use remote popularity or opaque scoring.
 */
(function initRecommendations() {
  "use strict";

  function slugOf(p) {
    return String(p?.slug || "");
  }

  function displayName(p) {
    const names = p?.names || {};
    return names.fr || names.en || names.ja || p?.slug || "?";
  }

  function nationalNum(p) {
    const raw = String(p?.number || "").replace(/^#/, "").replace(/^0+/, "") || "0";
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function regionIdFor(p, defs) {
    if (p?.region) return String(p.region);
    const n = nationalNum(p);
    for (const d of defs || []) {
      if (d.low <= n && n <= d.high) return String(d.id);
    }
    return "unknown";
  }

  function regionLabel(id, defs) {
    const found = (defs || []).find((d) => String(d.id) === String(id));
    return found?.label_fr || (id === "unknown" ? "Autre" : String(id || "National"));
  }

  function statusState(slug, caughtMap, statusMap) {
    const raw = statusMap?.[slug];
    if (raw?.state === "caught" || caughtMap?.[slug]) return "caught";
    if (raw?.state === "seen") return "seen";
    return "not_met";
  }

  function targetRank(p, caughtMap, statusMap) {
    const state = statusState(slugOf(p), caughtMap, statusMap);
    if (state === "seen") return 0;
    return 1;
  }

  function sortTargets(items, caughtMap, statusMap) {
    return [...items].sort((a, b) => {
      const byState = targetRank(a, caughtMap, statusMap) - targetRank(b, caughtMap, statusMap);
      if (byState !== 0) return byState;
      return nationalNum(a) - nationalNum(b);
    });
  }

  function regionGroups(pool, caughtMap, statusMap, defs) {
    const byRegion = new Map();
    for (const p of pool || []) {
      const slug = slugOf(p);
      if (!slug) continue;
      const rid = regionIdFor(p, defs);
      const cur = byRegion.get(rid) || {
        id: rid,
        label: regionLabel(rid, defs),
        total: 0,
        caught: 0,
        items: [],
        firstNum: nationalNum(p),
      };
      cur.total += 1;
      cur.firstNum = Math.min(cur.firstNum, nationalNum(p));
      if (statusState(slug, caughtMap, statusMap) === "caught") cur.caught += 1;
      else cur.items.push(p);
      byRegion.set(rid, cur);
    }

    return [...byRegion.values()]
      .filter((g) => g.items.length > 0)
      .map((g) => ({
        ...g,
        pct: g.total ? g.caught / g.total : 0,
        items: sortTargets(g.items, caughtMap, statusMap),
      }))
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct;
        if (a.items.length !== b.items.length) return a.items.length - b.items.length;
        return a.firstNum - b.firstNum;
      });
  }

  function reasonFor(group, rows, caughtMap, statusMap) {
    const first = rows[0];
    if (first && statusState(slugOf(first), caughtMap, statusMap) === "seen") {
      return `Deja apercu : ${displayName(first)} est le meilleur prochain pas pour ${group.label}.`;
    }
    const missing = group.items.length;
    return `${group.label} est proche d'etre completee : ${missing} restant${missing > 1 ? "s" : ""}.`;
  }

  function rankTargets({
    pool = [],
    caughtMap = {},
    statusMap = {},
    regionDefinitions = [],
    limit = 6,
  } = {}) {
    const groups = regionGroups(pool, caughtMap, statusMap, regionDefinitions);
    const best = groups[0];
    if (!best) {
      return {
        targetRegionId: "all",
        targetRegion: "Toutes regions",
        targetLabel: "Toutes regions",
        reason: "Aucune cible manquante dans ce perimetre.",
        rows: [],
        groups: [],
      };
    }
    const rows = best.items.slice(0, Math.max(1, Number(limit) || 6));
    return {
      targetRegionId: best.id,
      targetRegion: best.label,
      targetLabel: best.label,
      reason: reasonFor(best, rows, caughtMap, statusMap),
      rows,
      groups,
    };
  }

  const api = { rankTargets };
  if (window.__POKEVAULT_RECOMMENDATIONS_TESTS__) {
    api._test = {
      rankTargets,
      regionGroups,
      statusState,
      sortTargets,
    };
  }

  window.PokevaultRecommendations = api;
})();

