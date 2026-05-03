/**
 * Pokevault — shared next-best-action recommendations.
 *
 * This module is deliberately small and deterministic. It ranks local
 * collection targets; it does not use remote popularity or opaque scoring.
 */
(function initRecommendations() {
  "use strict";

  const FALLBACK_I18N = {
    "recommendations.region.other": "Autre",
    "recommendations.region.national": "National",
    "recommendations.reason.priority_hunt": "Ta recherche prioritaire {name} avance {region}.",
    "recommendations.reason.hunt": "Dans tes recherches : {name} avance {region}.",
    "recommendations.reason.seen": "Deja apercu : {name} est le meilleur prochain pas pour {region}.",
    "recommendations.reason.region_close": "{region} est proche d'etre completee : {missing} restant{plural}.",
    "recommendations.reason.badge": "Aide aussi le badge {title} ({current}/{target}).",
    "recommendations.next.seen": "Vu dans le Pokedex, pas encore capture.",
    "recommendations.next.active_region": "Dans ta region active {region}.",
    "recommendations.next.region_close": "{region} est proche : {missing} restant{plural}.",
    "recommendations.next.badge_mission": "Mission badge active.",
    "recommendations.next.missing": "{name} manque au Pokedex national.",
    "recommendations.empty.region": "Toutes regions",
    "recommendations.empty.reason": "Aucune cible manquante dans ce perimetre.",
  };

  function t(key, params = {}) {
    const runtime = window.PokevaultI18n;
    if (runtime?.t) return runtime.t(key, params);
    const template = FALLBACK_I18N[key] || key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
    );
  }

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
    return found?.label_fr || (id === "unknown" ? t("recommendations.region.other") : String(id || t("recommendations.region.national")));
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
      return t("recommendations.reason.priority_hunt", { name: displayName(first), region: group.label });
    }
    if (hunt?.wanted) {
      return t("recommendations.reason.hunt", { name: displayName(first), region: group.label });
    }
    if (first && statusState(slugOf(first), caughtMap, statusMap) === "seen") {
      return t("recommendations.reason.seen", { name: displayName(first), region: group.label });
    }
    const missing = group.items.length;
    return t("recommendations.reason.region_close", {
      region: group.label,
      missing,
      plural: missing > 1 ? "s" : "",
    });
  }

  function badgeReason(badge) {
    if (!badge || badge.unlocked) return "";
    const title = String(badge.title || "").trim();
    if (!title) return "";
    const current = Number.isFinite(Number(badge.current)) ? Number(badge.current) : 0;
    const target = Number.isFinite(Number(badge.target)) ? Number(badge.target) : 1;
    return t("recommendations.reason.badge", { title, current, target });
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
    if (kind === "badge_mission") return -1;
    if (kind === "seen") return 0;
    if (kind === "active_region") return 1;
    if (kind === "regional_completion") return 2;
    if (kind === "badge") return 3;
    return 4;
  }

  function nextActionReason(kind, p, regionId, defs, missingByRegion, nearestBadge) {
    const label = regionLabel(regionId, defs);
    if (kind === "badge_mission") return t("recommendations.next.badge_mission");
    if (kind === "seen") return t("recommendations.next.seen");
    if (kind === "active_region") return t("recommendations.next.active_region", { region: label });
    if (kind === "regional_completion") {
      const missing = missingByRegion.get(regionId) || 1;
      return t("recommendations.next.region_close", { region: label, missing, plural: missing > 1 ? "s" : "" });
    }
    if (kind === "badge") return badgeReason(nearestBadge);
    return t("recommendations.next.missing", { name: displayName(p) });
  }

  function buildNextActions({
    pool = [],
    caughtMap = {},
    statusMap = {},
    regionDefinitions = [],
    activeRegionId = "all",
    nearestBadge = null,
    activeMissionSlugs = [],
    limit = 3,
  } = {}) {
    const groups = regionGroups(pool, caughtMap, statusMap, {}, regionDefinitions);
    const closestRegionId = groups[0]?.id || "";
    const missingByRegion = missingCountByRegion(groups);
    const missionOrder = new Map(
      (Array.isArray(activeMissionSlugs) ? activeMissionSlugs : [])
        .map((slug, index) => [String(slug || "").trim(), index])
        .filter(([slug]) => slug),
    );
    const actions = [];
    for (const p of Array.isArray(pool) ? pool : []) {
      const slug = slugOf(p);
      if (!slug) continue;
      const state = statusState(slug, caughtMap, statusMap);
      if (state === "caught") continue;
      const regionId = regionIdFor(p, regionDefinitions);
      const missionIndex = missionOrder.has(slug) ? missionOrder.get(slug) : -1;
      const kind = missionIndex >= 0
        ? "badge_mission"
        : nextActionKind(p, state, regionId, activeRegionId, closestRegionId, nearestBadge);
      actions.push({
        slug,
        pokemon: p,
        name: displayName(p),
        number: nationalNum(p),
        regionId,
        regionLabel: regionLabel(regionId, regionDefinitions),
        kind,
        missionIndex,
        reason: nextActionReason(kind, p, regionId, regionDefinitions, missingByRegion, nearestBadge),
      });
    }
    actions.sort((a, b) => {
      const byKind = nextActionPriority(a.kind) - nextActionPriority(b.kind);
      if (byKind !== 0) return byKind;
      if (a.kind === "badge_mission" && b.kind === "badge_mission") {
        return a.missionIndex - b.missionIndex;
      }
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
        targetRegion: t("recommendations.empty.region"),
        targetLabel: t("recommendations.empty.region"),
        reason: t("recommendations.empty.reason"),
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
