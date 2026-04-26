/**
 * Pokevault — Focus session MVP.
 *
 * A short, local-first checklist of missing Pokemon. The session is a UI aid:
 * progression still comes from PokedexCollection status state.
 */
(function initFocusSession() {
  "use strict";

  const STORAGE_KEY = "pokevault_focus_session_v1";
  const SESSION_SIZE = 6;

  function slugOf(p) {
    return String(p?.slug || "");
  }

  function displayName(p) {
    const names = p?.names || {};
    return names.fr || names.en || names.ja || p?.slug || "?";
  }

  function displayNumber(p) {
    const raw = String(p?.number || "").replace(/^#/, "");
    const clean = raw.replace(/^0+/, "") || raw || "?";
    return `#${clean}`;
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

  function fallbackRankTargets(pool, caughtMap, statusMap, regionDefinitions, limit) {
    const missing = (pool || []).filter((p) => {
      const slug = slugOf(p);
      return slug && !caughtMap?.[slug];
    });
    if (!missing.length) return null;
    const target = missing.sort((a, b) => nationalNum(a) - nationalNum(b)).slice(0, limit);
    const first = target[0];
    const rid = first ? regionIdFor(first, regionDefinitions || []) : "all";
    const label = regionLabel(rid, regionDefinitions || []);
    return {
      targetRegionId: rid,
      targetLabel: label,
      reason: `${label} est proche d'etre completee.`,
      rows: target,
    };
  }

  function buildSessionPlan(pool, caughtMap, regionDefinitions, statusMap = {}) {
    const recommender = window.PokevaultRecommendations?.rankTargets;
    const ranked = recommender
      ? recommender({
          pool,
          caughtMap: caughtMap || {},
          statusMap: statusMap || {},
          huntMap: window.PokevaultHunts?.state?.hunts || {},
          regionDefinitions: regionDefinitions || [],
          limit: SESSION_SIZE,
        })
      : fallbackRankTargets(pool, caughtMap || {}, statusMap || {}, regionDefinitions || [], SESSION_SIZE);
    if (!ranked?.rows?.length) return null;
    return {
      version: 1,
      startedAt: new Date().toISOString(),
      targetRegion: ranked.targetRegionId || "all",
      targetLabel: ranked.targetLabel || ranked.targetRegion || "National",
      reason: ranked.reason || "Session courte pour garder le fil.",
      slugs: ranked.rows.slice(0, SESSION_SIZE).map(slugOf).filter(Boolean),
      completed: [],
    };
  }

  function sameStringArray(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }

  function normalizeSession(raw) {
    if (!raw || typeof raw !== "object") return null;
    const slugs = Array.isArray(raw.slugs)
      ? raw.slugs.map((s) => String(s || "").trim()).filter(Boolean).slice(0, SESSION_SIZE)
      : [];
    if (!slugs.length) return null;
    const completed = Array.isArray(raw.completed)
      ? raw.completed.map((s) => String(s || "").trim()).filter((s) => slugs.includes(s))
      : [];
    return {
      version: 1,
      startedAt: typeof raw.startedAt === "string" ? raw.startedAt : new Date().toISOString(),
      targetRegion: typeof raw.targetRegion === "string" ? raw.targetRegion : "all",
      targetLabel: typeof raw.targetLabel === "string" ? raw.targetLabel : "National",
      reason: typeof raw.reason === "string" ? raw.reason : "Session courte pour garder le fil.",
      slugs,
      completed,
    };
  }

  function readSession() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      return raw ? normalizeSession(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    const normalized = normalizeSession(session);
    if (!normalized) return null;
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      /* private mode */
    }
    return normalized;
  }

  function clearSession() {
    try {
      window.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
  }

  function resetSession() {
    clearSession();
    refresh();
  }

  function syncSessionCompletion(session, caughtMap, pool) {
    const normalized = normalizeSession(session);
    if (!normalized) return null;
    let slugs = normalized.slugs;
    if (Array.isArray(pool)) {
      const valid = new Set(pool.map(slugOf).filter(Boolean));
      slugs = slugs.filter((slug) => valid.has(slug));
    }
    if (!slugs.length) return null;
    const completed = slugs.filter((slug) => Boolean(caughtMap?.[slug]));
    return {
      ...normalized,
      slugs,
      completed,
      done: completed.length,
      total: slugs.length,
    };
  }

  function pokemonBySlug(slug) {
    const all = window.PokedexCollection?.allPokemon || [];
    return all.find((p) => slugOf(p) === slug) || null;
  }

  function currentCollectionState() {
    const PC = window.PokedexCollection;
    if (!PC) return null;
    const pool = typeof PC.poolForCollectionScope === "function"
      ? PC.poolForCollectionScope()
      : PC.allPokemon || [];
    return {
      pool: Array.isArray(pool) ? pool : [],
      caughtMap: PC.caughtMap || {},
      statusMap: PC.statusMap || {},
      huntMap: window.PokevaultHunts?.state?.hunts || {},
      regionDefinitions: PC.regionDefinitions || [],
    };
  }

  function startSession() {
    const state = currentCollectionState();
    if (!state) return null;
    const plan = buildSessionPlan(state.pool, state.caughtMap, state.regionDefinitions, state.statusMap);
    if (!plan) {
      resetSession();
      return null;
    }
    const saved = writeSession(plan);
    const T = window.PokevaultToast;
    if (T?.show) {
      T.show("Session focus", `${saved.slugs.length} cible${saved.slugs.length > 1 ? "s" : ""} dans ${saved.targetLabel}`, {
        icon: "flag",
        tone: "ok",
      });
    }
    refresh();
    return saved;
  }

  function setSearchToPokemon(p) {
    const input = document.getElementById("search");
    if (!input || !p) return;
    input.value = displayName(p);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function scrollToTarget(slug) {
    const escaped = window.CSS?.escape ? window.CSS.escape(slug) : String(slug).replace(/["\\]/g, "\\$&");
    const card = document.querySelector?.(`.card[data-slug="${escaped}"]`);
    if (!card) return;
    card.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    card.classList.add("is-focus-pulse");
    setTimeout(() => card.classList.remove("is-focus-pulse"), 900);
  }

  function openTarget(slug) {
    const session = readSession();
    const p = pokemonBySlug(slug);
    const region = session?.targetRegion && session.targetRegion !== "unknown"
      ? `?region=${encodeURIComponent(session.targetRegion)}`
      : "";
    window.location.hash = `#/liste${region}`;
    setTimeout(() => {
      setSearchToPokemon(p);
      setTimeout(() => scrollToTarget(slug), 80);
    }, 80);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function button(className, text, onClick) {
    const b = el("button", className, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function renderShell(host, title, meta) {
    host.replaceChildren();
    const header = el("div", "focus-panel__header");
    header.append(el("h2", "focus-panel__title", title));
    if (meta) header.append(el("span", "focus-panel__meta", meta));
    host.append(header);
    return host;
  }

  function renderIdle(host, plan) {
    renderShell(host, "Session focus", "");
    host.append(el("p", "focus-panel__body", "Six cibles, pas plus. Le but est de finir une petite boucle sans perdre le fil."));
    if (plan?.reason) host.append(el("p", "focus-panel__why", `Pourquoi ? ${plan.reason}`));
    const actions = el("div", "focus-panel__actions");
    actions.append(button("focus-panel__btn", "Lancer", () => startSession()));
    if (plan) actions.append(el("span", "focus-panel__hint", plan.targetLabel));
    host.append(actions);
  }

  function renderAllCaught(host) {
    renderShell(host, "Session focus", "");
    host.append(el("p", "focus-panel__body", "Pokédex complet sur ce périmètre."));
  }

  function renderActive(host, session, state) {
    const complete = session.done >= session.total;
    renderShell(host, complete ? "Session terminée" : "Session focus", `${session.done} / ${session.total}`);
    const meter = el("div", "focus-panel__meter");
    const bar = el("div", "focus-panel__bar");
    bar.style.width = `${session.total ? Math.round((session.done / session.total) * 100) : 0}%`;
    meter.append(bar);
    host.append(meter);
    host.append(el("p", "focus-panel__body", complete ? "Boucle terminée. Tu peux relancer une session courte." : `Pourquoi ? ${session.reason}`));

    const list = el("div", "focus-panel__targets");
    for (const slug of session.slugs) {
      const p = state.pool.find((item) => slugOf(item) === slug) || pokemonBySlug(slug);
      const done = session.completed.includes(slug);
      const row = button(`focus-panel__target${done ? " is-complete" : ""}`, "", () => openTarget(slug));
      row.dataset.slug = slug;
      row.append(el("span", "focus-panel__target-num", p ? displayNumber(p) : "—"));
      row.append(el("span", "focus-panel__target-name", p ? displayName(p) : slug));
      row.append(el("span", "focus-panel__target-state", done ? "check" : "radio_button_unchecked"));
      list.append(row);
    }
    host.append(list);

    const actions = el("div", "focus-panel__actions");
    actions.append(button("focus-panel__btn focus-panel__btn--ghost", complete ? "Nouvelle session" : "Repartir", () => {
      resetSession();
      if (complete) startSession();
    }));
    host.append(actions);
  }

  function renderPanel(host, state, session, plan) {
    if (!host) return;
    if (!state) {
      renderShell(host, "Session focus", "");
      host.append(el("p", "focus-panel__body", "Chargement du Pokédex."));
      return;
    }
    if (!state.pool.length) {
      renderShell(host, "Session focus", "");
      host.append(el("p", "focus-panel__body", "Chargement du Pokédex."));
      return;
    }
    if (session) {
      renderActive(host, session, state);
      return;
    }
    if (!plan) {
      renderAllCaught(host);
      return;
    }
    renderIdle(host, plan);
  }

  function paintGridFocus(session) {
    const cards = document.querySelectorAll?.(".card[data-slug]") || [];
    const active = new Set(session?.slugs || []);
    const completed = new Set(session?.completed || []);
    for (const card of cards) {
      const slug = card.dataset.slug || "";
      const on = active.has(slug);
      card.classList.toggle("is-focus-target", on);
      card.classList.toggle("is-focus-complete", on && completed.has(slug));
    }
  }

  function refresh() {
    const state = currentCollectionState();
    let session = readSession();
    let plan = null;
    if (state) {
      if (session) {
        const synced = syncSessionCompletion(session, state.caughtMap, state.pool);
        if (synced) {
          if (
            !sameStringArray(synced.slugs, session.slugs) ||
            !sameStringArray(synced.completed, session.completed)
          ) {
            writeSession(synced);
          }
          session = synced;
        } else {
          clearSession();
          session = null;
        }
      }
      if (!session) {
        plan = buildSessionPlan(state.pool, state.caughtMap, state.regionDefinitions, state.statusMap);
      }
    }

    renderPanel(document.getElementById("focusPanelList"), state, session, plan);
    renderPanel(document.getElementById("focusPanelStats"), state, session, plan);
    paintGridFocus(session);
  }

  function start() {
    refresh();
    window.PokedexCollection?.subscribeCaught?.(() => refresh());
    window.PokevaultHunts?.subscribe?.(() => refresh());
  }

  const api = {
    refresh,
    startSession,
    resetSession,
    openTarget,
    get state() {
      return readSession();
    },
  };

  if (window.__POKEVAULT_FOCUS_TESTS__) {
    api._test = {
      buildSessionPlan,
      normalizeSession,
      readSession,
      writeSession,
      syncSessionCompletion,
    };
  }

  window.PokevaultFocus = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
