/**
 * Pokevault — active badge mission.
 *
 * A badge mission replaces the older generic focus session: the player follows
 * one Pokemon-team badge, then the collection view highlights the missing
 * Pokemon needed to unlock it.
 */
(function initBadgeMission() {
  "use strict";

  const STORAGE_KEY = "pokevault_badge_mission_v1";
  const FALLBACK_I18N = {
    "badge_mission.title": "Mission badge",
    "badge_mission.empty": "Choisis un badge d'equipe dans la galerie pour guider ta prochaine chasse.",
    "badge_mission.open_gallery": "Voir les badges",
    "badge_mission.progress": "{current} / {target}",
    "badge_mission.clear": "Arreter",
    "badge_mission.open": "Ouvrir {name}",
    "badge_mission.caught": "Capture",
    "badge_mission.missing": "A chercher",
  };

  let lastHost = null;
  let lastOptions = {};
  const listeners = new Set();

  function tr(key, params = {}) {
    const raw = window.PokevaultI18n?.t?.(key, params) || FALLBACK_I18N[key] || key;
    return String(raw).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => (
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
    ));
  }

  function readActiveId() {
    try {
      return String(localStorage.getItem(STORAGE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function writeActiveId(id) {
    const clean = String(id || "").trim();
    try {
      if (clean) localStorage.setItem(STORAGE_KEY, clean);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore private mode / quota */
    }
    notify();
    refresh();
    return clean;
  }

  function setActiveBadge(id) {
    return writeActiveId(id);
  }

  function clear() {
    return writeActiveId("");
  }

  function badgeRequirements(badge) {
    const raw = Array.isArray(badge?.requirements) ? badge.requirements : [];
    return raw
      .map((item) => {
        const slug = String(item?.slug || "").trim();
        return slug ? { slug, caught: Boolean(item?.caught) } : null;
      })
      .filter(Boolean);
  }

  function activeBadge(state = window.PokevaultBadges?.state) {
    const id = readActiveId();
    const catalog = Array.isArray(state?.catalog) ? state.catalog : [];
    const badge = id ? catalog.find((item) => item?.id === id) : null;
    if (!badge || !badgeRequirements(badge).length) return null;
    return badge;
  }

  function statusCaught(slug, requirement) {
    const status = window.PokedexCollection?.getStatus?.(slug);
    if (status?.state === "caught") return true;
    return Boolean(requirement?.caught);
  }

  function activeTargetSlugs(state = window.PokevaultBadges?.state) {
    const badge = activeBadge(state);
    if (!badge) return [];
    return badgeRequirements(badge)
      .filter((requirement) => !statusCaught(requirement.slug, requirement))
      .map((requirement) => requirement.slug);
  }

  function pokemonBySlug(slug) {
    const all = window.PokedexCollection?.allPokemon || [];
    return all.find((p) => String(p?.slug || "") === slug) || null;
  }

  function displayName(p, slug) {
    const names = p?.names || {};
    return names.fr || names.en || names.ja || slug || "?";
  }

  function displayNumber(p) {
    const raw = String(p?.number || "").replace(/^#/, "");
    const clean = raw.replace(/^0+/, "") || raw || "";
    return clean ? `#${clean}` : "";
  }

  function imageSrc(p) {
    const raw = String(p?.image || "").replace(/^\.\//, "");
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.startsWith("/") ? raw : `/${raw}`;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function openTarget(slug, trigger, onOpen) {
    if (typeof onOpen === "function") {
      onOpen(slug, trigger);
      return;
    }
    if (window.PokevaultDrawer?.open) {
      window.PokevaultDrawer.open(slug, trigger || null);
      return;
    }
    location.hash = `#/pokemon/${encodeURIComponent(slug)}`;
  }

  function buildTarget(requirement, onOpen) {
    const pokemon = pokemonBySlug(requirement.slug);
    const caught = statusCaught(requirement.slug, requirement);
    const name = displayName(pokemon, requirement.slug);
    const row = el("button", `badge-mission-target ${caught ? "is-caught" : "is-missing"}`);
    row.type = "button";
    row.dataset.slug = requirement.slug;
    row.setAttribute("aria-label", tr("badge_mission.open", { name }));
    row.addEventListener("click", () => openTarget(requirement.slug, row, onOpen));

    const thumb = el("span", "badge-mission-target__thumb");
    const src = imageSrc(pokemon);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      thumb.append(img);
    } else {
      thumb.textContent = displayNumber(pokemon) || "?";
    }

    const body = el("span", "badge-mission-target__body");
    body.append(el("strong", "badge-mission-target__name", name));
    body.append(
      el(
        "span",
        "badge-mission-target__state",
        caught ? tr("badge_mission.caught") : tr("badge_mission.missing"),
      ),
    );
    row.append(thumb, body);
    return row;
  }

  function renderEmpty(host) {
    const shell = el("section", "badge-mission");
    shell.append(el("h2", "badge-mission__title", tr("badge_mission.title")));
    shell.append(el("p", "badge-mission__body", tr("badge_mission.empty")));
    const link = el("a", "badge-mission__link", tr("badge_mission.open_gallery"));
    link.href = "#/stats";
    shell.append(link);
    host.replaceChildren(shell);
  }

  function renderActive(host, badge, options) {
    const requirements = badgeRequirements(badge);
    const shell = el("section", "badge-mission is-active");
    const header = el("div", "badge-mission__header");
    header.append(el("h2", "badge-mission__title", tr("badge_mission.title")));
    header.append(el("span", "badge-mission__progress", tr("badge_mission.progress", {
      current: badge.current || 0,
      target: badge.target || requirements.length || 1,
    })));
    shell.append(header);

    shell.append(el("p", "badge-mission__badge-title", badge.title || badge.id || ""));

    const list = el("div", "badge-mission__targets");
    for (const requirement of requirements) {
      list.append(buildTarget(requirement, options.onOpen));
    }
    shell.append(list);

    const actions = el("div", "badge-mission__actions");
    const clearBtn = el("button", "badge-mission__clear", tr("badge_mission.clear"));
    clearBtn.type = "button";
    clearBtn.addEventListener("click", clear);
    actions.append(clearBtn);
    shell.append(actions);
    host.replaceChildren(shell);
  }

  function renderInto(host, options = {}) {
    if (!host) return null;
    lastHost = host;
    lastOptions = options;
    const badge = activeBadge();
    if (!badge) {
      renderEmpty(host);
    } else {
      renderActive(host, badge, options);
    }
    paintGridMission();
    return badge;
  }

  function paintGridMission() {
    const targets = new Set(activeTargetSlugs());
    const active = activeBadge();
    const completed = new Set(
      active ? badgeRequirements(active).filter((r) => statusCaught(r.slug, r)).map((r) => r.slug) : [],
    );
    const cards = document.querySelectorAll?.(".card[data-slug]") || [];
    for (const card of cards) {
      const slug = card.dataset?.slug || "";
      card.classList?.toggle?.("is-badge-mission-target", targets.has(slug));
      card.classList?.toggle?.("is-badge-mission-complete", completed.has(slug));
    }
  }

  function refresh() {
    if (lastHost) renderInto(lastHost, lastOptions);
    else paintGridMission();
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    for (const fn of listeners) {
      try {
        fn(readActiveId());
      } catch (err) {
        console.error("badge mission: listener failed", err);
      }
    }
  }

  function start() {
    renderInto(document.getElementById("badgeMissionPanel"), {
      onOpen: (slug, trigger) => openTarget(slug, trigger),
    });
    window.PokedexCollection?.subscribeCaught?.(() => refresh());
    window.PokevaultBadges?.subscribe?.(() => refresh());
    window.PokevaultI18n?.subscribeLocale?.(() => refresh());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  const api = {
    setActiveBadge,
    clear,
    activeBadge,
    activeTargetSlugs,
    renderInto,
    refresh,
    subscribe,
    get activeId() {
      return readActiveId();
    },
  };
  window.PokevaultBadgeMission = api;

  if (window.__POKEVAULT_BADGE_MISSION_TESTS__) {
    api._test = {
      setActiveBadge,
      clear,
      readActiveId,
      activeBadge,
      activeTargetSlugs,
      renderInto,
      paintGridMission,
    };
  }
})();
