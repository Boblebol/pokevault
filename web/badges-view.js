/**
 * Pokevault — badges view + toast unlocker (roadmap F12).
 *
 * Exposes ``window.PokevaultBadges`` with:
 *   - ``poll({ silent })``  — refetch ``GET /api/badges`` and fire a
 *     toast for every newly-unlocked badge (skipped when ``silent``).
 *   - ``renderInto(host)`` — paint the badge catalog into a container
 *     (used by the stats view).
 *   - ``subscribe(fn)``    — subscribe to state changes.
 *
 * The first poll is ``silent`` so opening the app does not replay
 * historical unlocks; subsequent polls (triggered by progress /
 * cards mutations) surface any newly-due badges.
 */
(function initBadges() {
  "use strict";

  const API_BADGES = "/api/badges";

  let cachedState = null;
  let inflight = null;
  const listeners = new Set();

  async function fetchState() {
    const r = await fetch(API_BADGES);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.json();
    if (!body || !Array.isArray(body.catalog)) {
      return { catalog: [], unlocked: [] };
    }
    return body;
  }

  function diffUnlocked(prev, next) {
    const before = new Set(prev?.unlocked || []);
    return (next.unlocked || []).filter((id) => !before.has(id));
  }

  function progressNumber(value, fallback = 0) {
    const n = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeProgress(badge) {
    const target = Math.max(1, progressNumber(badge?.target, 1));
    const current = Math.max(0, Math.min(progressNumber(badge?.current, 0), target));
    const rawPercent = progressNumber(badge?.percent, -1);
    const computedPercent = current >= target ? 100 : Math.floor((current / target) * 100);
    const percent = Math.max(0, Math.min(rawPercent >= 0 ? rawPercent : computedPercent, 100));
    return {
      current,
      target,
      percent: badge?.unlocked ? 100 : percent,
      remaining: Math.max(0, target - current),
      hint: typeof badge?.hint === "string" ? badge.hint : "",
    };
  }

  function nearestBadge(state = cachedState) {
    const catalog = Array.isArray(state?.catalog) ? state.catalog : [];
    const locked = catalog
      .filter((b) => b && !b.unlocked)
      .map((b, index) => ({ ...b, _progress: normalizeProgress(b), _index: index }));
    if (!locked.length) return null;
    locked.sort((a, b) => {
      if (b._progress.percent !== a._progress.percent) {
        return b._progress.percent - a._progress.percent;
      }
      if (a._progress.remaining !== b._progress.remaining) {
        return a._progress.remaining - b._progress.remaining;
      }
      return a._index - b._index;
    });
    const { _progress, _index, ...badge } = locked[0];
    return {
      ...badge,
      current: _progress.current,
      target: _progress.target,
      percent: _progress.percent,
      hint: _progress.hint,
    };
  }

  function announce(newIds, next) {
    const T = window.PokevaultToast;
    if (!T || !newIds.length) return;
    const byId = new Map((next.catalog || []).map((b) => [b.id, b]));
    for (const id of newIds) {
      const def = byId.get(id);
      if (!def) continue;
      T.show("Badge débloqué", def.title, {
        icon: "military_tech",
        tone: "ok",
        duration: 6000,
      });
    }
  }

  function notifyListeners(state) {
    for (const fn of listeners) {
      try {
        fn(state);
      } catch (err) {
        console.error("badges: listener failed", err);
      }
    }
  }

  async function poll({ silent = false } = {}) {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const next = await fetchState();
        const newIds = silent ? [] : diffUnlocked(cachedState, next);
        cachedState = next;
        if (newIds.length) announce(newIds, next);
        notifyListeners(next);
        return { state: next, newlyUnlocked: newIds };
      } catch (err) {
        console.error("badges: poll failed", err);
        return { state: cachedState, newlyUnlocked: [] };
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    if (cachedState) {
      try {
        fn(cachedState);
      } catch (err) {
        console.error("badges: sub immediate-notify failed", err);
      }
    }
    return () => listeners.delete(fn);
  }

  function renderInto(host) {
    if (!host) return;
    host.replaceChildren();
    const section = document.createElement("section");
    section.className = "stats-badges";

    const title = document.createElement("h2");
    title.className = "stats-section-title";
    title.textContent = "Badges Pokédex";
    section.append(title);

    const grid = document.createElement("div");
    grid.className = "stats-badges-grid";
    section.append(grid);

    const state = cachedState || { catalog: [], unlocked: [] };
    if (!state.catalog.length) {
      const empty = document.createElement("p");
      empty.className = "stats-badges-empty";
      empty.textContent = "Aucun badge pour l’instant.";
      section.append(empty);
    } else {
      const total = state.catalog.length;
      const unlocked = state.catalog.filter((b) => b.unlocked).length;
      const sub = document.createElement("p");
      sub.className = "stats-kpi-sub";
      sub.textContent = `${unlocked} / ${total} obtenus`;
      section.insertBefore(sub, grid);

      for (const badge of state.catalog) {
        grid.append(buildBadgeTile(badge));
      }
    }

    host.append(section);
  }

  function buildBadgeTile(badge) {
    const tile = document.createElement("article");
    tile.className = "badge-tile";
    if (badge.unlocked) tile.classList.add("is-unlocked");
    tile.setAttribute("role", "listitem");
    const progress = normalizeProgress(badge);

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined badge-tile__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = badge.unlocked ? "military_tech" : "lock";
    tile.append(icon);

    const body = document.createElement("div");
    body.className = "badge-tile__body";
    const t = document.createElement("h3");
    t.className = "badge-tile__title";
    t.textContent = badge.title;
    const d = document.createElement("p");
    d.className = "badge-tile__desc";
    d.textContent = badge.description;
    body.append(t, d);
    if (!badge.unlocked) {
      const meter = document.createElement("div");
      meter.className = "badge-tile__meter";
      meter.setAttribute("role", "progressbar");
      meter.setAttribute("aria-valuemin", "0");
      meter.setAttribute("aria-valuemax", "100");
      meter.setAttribute("aria-valuenow", String(progress.percent));
      const fill = document.createElement("span");
      fill.className = "badge-tile__meter-fill";
      fill.style.width = `${progress.percent}%`;
      meter.append(fill);

      const meta = document.createElement("p");
      meta.className = "badge-tile__progress";
      meta.textContent = `${progress.current} / ${progress.target} · ${progress.hint}`;
      body.append(meter, meta);
    }
    tile.append(body);

    const status = document.createElement("span");
    status.className = "badge-tile__status";
    status.textContent = badge.unlocked ? "Obtenu" : `${progress.percent}%`;
    tile.append(status);

    return tile;
  }

  function start() {
    if (start._called) return;
    start._called = true;
    void poll({ silent: true });
    window.PokedexCollection?.subscribeCaught?.(() => {
      void poll();
    });
    document.addEventListener("pokevault:cards-changed", () => {
      void poll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.PokevaultBadges = {
    poll,
    subscribe,
    renderInto,
    nearest: nearestBadge,
    get state() {
      return cachedState;
    },
  };
  if (window.__POKEVAULT_BADGES_TESTS__) {
    window.PokevaultBadges._test = {
      nearestBadge,
      normalizeProgress,
    };
  }
})();
