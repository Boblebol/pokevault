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

  function huntRank(slug, huntMap) {
    const hunt = huntMap?.[slug];
    if (hunt?.wanted && hunt.priority === "high") return 0;
    if (hunt?.wanted) return 1;
    return 2;
  }

  function targetRank(p, caughtMap, statusMap, huntMap) {
    const slug = slugOf(p);
    const byHunt = huntRank(slug, huntMap);
    if (byHunt < 2) return byHunt;
    const state = statusState(slug, caughtMap, statusMap);
    if (state === "seen") return 2;
    return 3;
  }

  function sortTargets(items, caughtMap, statusMap, huntMap) {
    return [...items].sort((a, b) => {
      const byState = targetRank(a, caughtMap, statusMap, huntMap) - targetRank(b, caughtMap, statusMap, huntMap);
      if (byState !== 0) return byState;
      return nationalNum(a) - nationalNum(b);
    });
  }

  function regionGroups(pool, caughtMap, statusMap, huntMap, defs) {
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
        items: sortTargets(g.items, caughtMap, statusMap, huntMap),
      }))
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct;
        if (a.items.length !== b.items.length) return a.items.length - b.items.length;
        return a.firstNum - b.firstNum;
      });
  }

  function reasonFor(group, rows, caughtMap, statusMap, huntMap) {
    const first = rows[0];
    const hunt = first ? huntMap?.[slugOf(first)] : null;
    if (hunt?.wanted && hunt.priority === "high") {
      return `Ta recherche prioritaire ${displayName(first)} avance ${group.label}.`;
    }
    if (hunt?.wanted) {
      return `Dans tes recherches : ${displayName(first)} avance ${group.label}.`;
    }
    if (first && statusState(slugOf(first), caughtMap, statusMap) === "seen") {
      return `Deja apercu : ${displayName(first)} est le meilleur prochain pas pour ${group.label}.`;
    }
    const missing = group.items.length;
    return `${group.label} est proche d'etre completee : ${missing} restant${missing > 1 ? "s" : ""}.`;
  }

  function badgeReason(badge) {
    if (!badge || badge.unlocked) return "";
    const title = String(badge.title || "").trim();
    if (!title) return "";
    const current = Number.isFinite(Number(badge.current)) ? Number(badge.current) : 0;
    const target = Number.isFinite(Number(badge.target)) ? Number(badge.target) : 1;
    return `Aide aussi le badge ${title} (${current}/${target}).`;
  }

  function missingCountByRegion(groups) {
    const out = new Map();
    for (const group of groups || []) out.set(group.id, group.items.length);
    return out;
  }

  function nextActionKind(p, state, regionId, activeRegionId, closestRegionId, nearestBadge) {
    if (state === "seen") return "seen";
    if (activeRegionId && activeRegionId !== "all" && regionId === activeRegionId) {
      return "active_region";
    }
    if (closestRegionId && regionId === closestRegionId) return "regional_completion";
    if (badgeReason(nearestBadge)) return "badge";
    return "missing";
  }

  function nextActionPriority(kind) {
    if (kind === "seen") return 0;
    if (kind === "active_region") return 1;
    if (kind === "regional_completion") return 2;
    if (kind === "badge") return 3;
    return 4;
  }

  function nextActionReason(kind, p, regionId, defs, missingByRegion, nearestBadge) {
    const label = regionLabel(regionId, defs);
    if (kind === "seen") return "Vu dans le Pokedex, pas encore capture.";
    if (kind === "active_region") return `Dans ta region active ${label}.`;
    if (kind === "regional_completion") {
      const missing = missingByRegion.get(regionId) || 1;
      return `${label} est proche : ${missing} restant${missing > 1 ? "s" : ""}.`;
    }
    if (kind === "badge") return badgeReason(nearestBadge);
    return `${displayName(p)} manque au Pokedex national.`;
  }

  function buildNextActions({
    pool = [],
    caughtMap = {},
    statusMap = {},
    regionDefinitions = [],
    activeRegionId = "all",
    nearestBadge = null,
    limit = 3,
  } = {}) {
    const groups = regionGroups(pool, caughtMap, statusMap, {}, regionDefinitions);
    const closestRegionId = groups[0]?.id || "";
    const missingByRegion = missingCountByRegion(groups);
    const actions = [];
    for (const p of Array.isArray(pool) ? pool : []) {
      const slug = slugOf(p);
      if (!slug) continue;
      const state = statusState(slug, caughtMap, statusMap);
      if (state === "caught") continue;
      const regionId = regionIdFor(p, regionDefinitions);
      const kind = nextActionKind(p, state, regionId, activeRegionId, closestRegionId, nearestBadge);
      actions.push({
        slug,
        pokemon: p,
        name: displayName(p),
        number: nationalNum(p),
        regionId,
        regionLabel: regionLabel(regionId, regionDefinitions),
        kind,
        reason: nextActionReason(kind, p, regionId, regionDefinitions, missingByRegion, nearestBadge),
      });
    }
    actions.sort((a, b) => {
      const byKind = nextActionPriority(a.kind) - nextActionPriority(b.kind);
      if (byKind !== 0) return byKind;
      if (a.number !== b.number) return a.number - b.number;
      return a.slug.localeCompare(b.slug);
    });
    const max = Math.max(1, Number(limit) || 3);
    return actions.slice(0, max);
  }

  function rankTargets({
    pool = [],
    caughtMap = {},
    statusMap = {},
    huntMap = {},
    regionDefinitions = [],
    limit = 6,
  } = {}) {
    const groups = regionGroups(pool, caughtMap, statusMap, huntMap, regionDefinitions);
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
      reason: reasonFor(best, rows, caughtMap, statusMap, huntMap),
      rows,
      groups,
    };
  }

  const api = { rankTargets, buildNextActions };
  if (window.__POKEVAULT_RECOMMENDATIONS_TESTS__) {
    api._test = {
      rankTargets,
      buildNextActions,
      regionGroups,
      statusState,
      huntRank,
      sortTargets,
    };
  }

  window.PokevaultRecommendations = api;
})();
