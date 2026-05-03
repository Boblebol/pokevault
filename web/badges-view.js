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
  const FALLBACK_I18N = {
    "badges.gallery.title": "Galerie de badges",
    "badges.gallery.empty": "Aucun badge pour l'instant.",
    "badges.gallery.count": "{unlocked} / {total} obtenus",
    "badges.toast.title": "Badge debloque",
    "badges.status.unlocked": "Obtenu",
    "badges.status.sealed": "{percent}%",
    "badges.filter.status": "Statut des badges",
    "badges.filter.category": "Categorie de badges",
    "badges.filter.region": "Region des badges",
    "badges.filter.all": "Tous",
    "badges.filter.unlocked": "Obtenus",
    "badges.filter.locked": "Scelles",
    "badges.category.milestone": "Paliers",
    "badges.category.card": "Cartes",
    "badges.category.gym": "Arenes",
    "badges.category.elite_four": "Conseil 4",
    "badges.category.champion": "Maitres",
    "badges.category.rival": "Rivaux",
    "badges.region.global": "Global",
    "badges.region.kanto": "Kanto",
    "badges.region.johto": "Johto",
    "badges.region.hoenn": "Hoenn",
    "badges.region.sinnoh": "Sinnoh",
    "badges.region.unova": "Unys",
    "badges.region.kalos": "Kalos",
    "badges.region.alola": "Alola",
    "badges.region.galar": "Galar",
    "badges.region.paldea": "Paldea",
    "badges.detail.open": "Ouvrir la fiche du badge {title}",
    "badges.detail.close": "Fermer",
    "badges.detail.progress": "{current} / {target}",
    "badges.detail.requirements": "Pokemon concernes",
    "badges.detail.caught": "Capture",
    "badges.detail.missing": "A chercher",
    "badges.detail.more": "+{count}",
  };
  const FILTER_OPTIONS = {
    status: [
      ["all", "badges.filter.all"],
      ["unlocked", "badges.filter.unlocked"],
      ["locked", "badges.filter.locked"],
    ],
    category: [
      ["all", "badges.filter.all"],
      ["milestone", "badges.category.milestone"],
      ["card", "badges.category.card"],
      ["gym", "badges.category.gym"],
      ["elite_four", "badges.category.elite_four"],
      ["champion", "badges.category.champion"],
      ["rival", "badges.category.rival"],
    ],
    region: [
      ["all", "badges.filter.all"],
      ["global", "badges.region.global"],
      ["kanto", "badges.region.kanto"],
      ["johto", "badges.region.johto"],
      ["hoenn", "badges.region.hoenn"],
      ["sinnoh", "badges.region.sinnoh"],
      ["unova", "badges.region.unova"],
      ["kalos", "badges.region.kalos"],
      ["alola", "badges.region.alola"],
      ["galar", "badges.region.galar"],
      ["paldea", "badges.region.paldea"],
    ],
  };

  let cachedState = null;
  let inflight = null;
  let lastHost = null;
  const galleryFilters = { status: "all", category: "all", region: "all" };
  const listeners = new Set();

  function tr(key, params = {}) {
    const raw = window.PokevaultI18n?.t?.(key, params) || FALLBACK_I18N[key] || key;
    return String(raw).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => (
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
    ));
  }

  function activeLocale() {
    return window.PokevaultI18n?.getLocale?.() || "fr";
  }

  function localizedBadgeEntry(badge) {
    const i18n = badge?.i18n && typeof badge.i18n === "object" ? badge.i18n : {};
    return i18n[activeLocale()] || i18n.fr || i18n.en || null;
  }

  function displayBadgeCopy(badge, { forceReveal = false } = {}) {
    const entry = localizedBadgeEntry(badge);
    const hidden = !forceReveal && !badge?.unlocked && badge?.reveal === "mystery";
    if (hidden) {
      return {
        title: entry?.mystery_title || entry?.title || badge?.title || "Badge scelle",
        description: entry?.mystery_hint || badge?.hint || "",
      };
    }
    return {
      title: entry?.title || badge?.title || "",
      description: entry?.description || badge?.description || "",
    };
  }

  function filterBadges(catalog, filters = galleryFilters) {
    return (Array.isArray(catalog) ? catalog : []).filter((badge) => {
      if (filters.status === "unlocked" && !badge?.unlocked) return false;
      if (filters.status === "locked" && badge?.unlocked) return false;
      if (filters.category !== "all" && badge?.category !== filters.category) return false;
      if (filters.region !== "all" && badge?.region !== filters.region) return false;
      return true;
    });
  }

  function badgeTileClassNames(badge) {
    const classes = ["badge-tile"];
    if (badge?.unlocked) classes.push("is-unlocked");
    if (badge?.category) classes.push(`badge-tile--${badge.category}`);
    if (badge?.effect) classes.push(`badge-tile--${badge.effect}`);
    if (badge?.reveal === "mystery") classes.push("badge-tile--mystery");
    return classes;
  }

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

  function badgeRequirements(badge) {
    const raw = Array.isArray(badge?.requirements) ? badge.requirements : [];
    return raw
      .map((item) => {
        const slug = String(item?.slug || "").trim();
        return slug ? { slug, caught: Boolean(item?.caught) } : null;
      })
      .filter(Boolean);
  }

  function pokemonBySlug(slug) {
    const all = window.PokedexCollection?.allPokemon || [];
    return all.find((p) => String(p?.slug || "") === slug) || null;
  }

  function displayPokemonName(p, slug) {
    const names = p?.names || {};
    return names.fr || names.en || names.ja || slug || "?";
  }

  function displayPokemonNumber(p) {
    const raw = String(p?.number || "").replace(/^#/, "");
    const clean = raw.replace(/^0+/, "") || raw || "";
    return clean ? `#${clean}` : "";
  }

  function normalizePokemonImagePath(img) {
    if (!img) return "";
    const raw = String(img).replace(/^\.\//, "");
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.startsWith("/") ? raw : `/${raw}`;
  }

  function attachRequirementImage(img, pokemon) {
    if (!img || !pokemon) return false;
    const artwork = window.PokevaultArtwork;
    if (typeof artwork?.resolve === "function") {
      const resolved = artwork.resolve(pokemon);
      if (resolved?.src) {
        if (typeof artwork.attach === "function") artwork.attach(img, resolved);
        else img.src = resolved.src;
        return true;
      }
    }
    const src = normalizePokemonImagePath(pokemon.image);
    if (!src) return false;
    img.src = src;
    return true;
  }

  function buildRequirementChip(requirement) {
    const pokemon = pokemonBySlug(requirement.slug);
    const name = displayPokemonName(pokemon, requirement.slug);
    const chip = document.createElement("span");
    chip.className = `badge-requirement-chip ${requirement.caught ? "is-caught" : "is-missing"}`;
    chip.title = name;
    chip.setAttribute(
      "aria-label",
      `${name} - ${requirement.caught ? tr("badges.detail.caught") : tr("badges.detail.missing")}`,
    );

    const img = document.createElement("img");
    img.className = "badge-requirement-chip__img";
    img.alt = "";
    img.loading = "lazy";
    if (attachRequirementImage(img, pokemon)) {
      chip.append(img);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "badge-requirement-chip__fallback";
      fallback.textContent = displayPokemonNumber(pokemon) || "?";
      chip.append(fallback);
    }

    const hiddenName = document.createElement("span");
    hiddenName.className = "badge-requirement-chip__name";
    hiddenName.textContent = name;
    chip.append(hiddenName);
    return chip;
  }

  function buildRequirementsPreview(badge) {
    const requirements = badgeRequirements(badge);
    if (!requirements.length) return null;

    const preview = document.createElement("div");
    preview.className = "badge-requirement-preview";
    preview.setAttribute("aria-label", tr("badges.detail.requirements"));
    for (const requirement of requirements.slice(0, 4)) {
      preview.append(buildRequirementChip(requirement));
    }
    if (requirements.length > 4) {
      const more = document.createElement("span");
      more.className = "badge-requirement-chip badge-requirement-chip--more";
      more.textContent = tr("badges.detail.more", { count: requirements.length - 4 });
      preview.append(more);
    }
    return preview;
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
      const copy = displayBadgeCopy(def, { forceReveal: true });
      const toast = T.show(tr("badges.toast.title"), copy.title, {
        icon: "★",
        tone: "ok",
        duration: 6500,
      });
      toast?.classList?.add("toast--badge-unlock", `toast--badge-${def.effect || "metal"}`);
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
    lastHost = host;
    host.replaceChildren();
    const section = document.createElement("section");
    section.className = "stats-badges";

    const title = document.createElement("h2");
    title.className = "stats-section-title";
    title.textContent = tr("badges.gallery.title");
    section.append(title);

    const state = cachedState || { catalog: [], unlocked: [] };
    if (state.catalog.length) {
      const total = state.catalog.length;
      const unlocked = state.catalog.filter((b) => b.unlocked).length;
      const sub = document.createElement("p");
      sub.className = "stats-kpi-sub";
      sub.textContent = tr("badges.gallery.count", { unlocked, total });
      section.append(sub);
      section.append(buildGalleryControls());
    }

    const grid = document.createElement("div");
    grid.className = "stats-badges-grid";
    section.append(grid);

    if (!state.catalog.length) {
      const empty = document.createElement("p");
      empty.className = "stats-badges-empty";
      empty.textContent = tr("badges.gallery.empty");
      section.append(empty);
    } else {
      const visibleCatalog = filterBadges(state.catalog, galleryFilters);
      for (const badge of visibleCatalog) {
        grid.append(buildBadgeTile(badge));
      }
      if (!visibleCatalog.length) {
        const empty = document.createElement("p");
        empty.className = "stats-badges-empty";
        empty.textContent = tr("badges.gallery.empty");
        section.append(empty);
      }
    }

    host.append(section);
  }

  function buildGalleryControls() {
    const controls = document.createElement("div");
    controls.className = "badge-gallery-controls";
    controls.append(
      buildSegmentedFilter("status", "badges.filter.status", FILTER_OPTIONS.status),
      buildSegmentedFilter("category", "badges.filter.category", FILTER_OPTIONS.category),
      buildRegionSelect(),
    );
    return controls;
  }

  function buildSegmentedFilter(name, labelKey, options) {
    const wrap = document.createElement("div");
    wrap.className = "badge-filter";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", tr(labelKey));
    for (const [value, optionKey] of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "badge-filter__btn";
      button.setAttribute("aria-pressed", galleryFilters[name] === value ? "true" : "false");
      if (galleryFilters[name] === value) button.classList.add("is-active");
      button.textContent = tr(optionKey);
      button.addEventListener("click", () => {
        galleryFilters[name] = value;
        if (lastHost) renderInto(lastHost);
      });
      wrap.append(button);
    }
    return wrap;
  }

  function buildRegionSelect() {
    const select = document.createElement("select");
    select.className = "badge-filter__select";
    select.setAttribute("aria-label", tr("badges.filter.region"));
    for (const [value, optionKey] of FILTER_OPTIONS.region) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = tr(optionKey);
      option.selected = galleryFilters.region === value;
      select.append(option);
    }
    select.addEventListener("change", () => {
      galleryFilters.region = select.value || "all";
      if (lastHost) renderInto(lastHost);
    });
    return select;
  }

  function buildDetailRequirement(requirement) {
    const pokemon = pokemonBySlug(requirement.slug);
    const name = displayPokemonName(pokemon, requirement.slug);
    const item = document.createElement("article");
    item.className = `badge-detail-requirement ${requirement.caught ? "is-caught" : "is-missing"}`;

    item.append(buildRequirementChip(requirement));

    const body = document.createElement("div");
    body.className = "badge-detail-requirement__body";
    const title = document.createElement("h4");
    title.className = "badge-detail-requirement__name";
    title.textContent = name;
    const meta = document.createElement("p");
    meta.className = "badge-detail-requirement__meta";
    const number = displayPokemonNumber(pokemon);
    const status = requirement.caught ? tr("badges.detail.caught") : tr("badges.detail.missing");
    meta.textContent = number ? `${number} · ${status}` : status;
    body.append(title, meta);
    item.append(body);
    return item;
  }

  function buildBadgeDetail(badge, { onClose = null } = {}) {
    const progress = normalizeProgress(badge);
    const copy = displayBadgeCopy(badge);
    const detail = document.createElement("section");
    detail.className = badgeTileClassNames(badge).join(" ").replace("badge-tile", "badge-detail");
    detail.setAttribute("role", "dialog");
    detail.setAttribute("aria-modal", "true");
    detail.setAttribute("aria-label", copy.title || tr("badges.gallery.title"));

    const header = document.createElement("div");
    header.className = "badge-detail__header";
    const icon = document.createElement("span");
    icon.className = "app-icon badge-detail__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = badge?.unlocked ? "★" : "□";
    const heading = document.createElement("h2");
    heading.className = "badge-detail__title";
    heading.textContent = copy.title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "badge-detail__close";
    close.setAttribute("aria-label", tr("badges.detail.close"));
    close.textContent = "×";
    if (typeof onClose === "function") close.addEventListener("click", onClose);
    header.append(icon, heading, close);
    detail.append(header);

    const desc = document.createElement("p");
    desc.className = "badge-detail__desc";
    desc.textContent = copy.description;
    detail.append(desc);

    const meta = document.createElement("div");
    meta.className = "badge-detail__meta";
    const values = [
      badge?.category ? tr(`badges.category.${badge.category}`) : "",
      badge?.region ? tr(`badges.region.${badge.region}`) : "",
      badge?.rarity || "",
      badge?.effect || "",
    ].filter(Boolean);
    for (const value of values) {
      const pill = document.createElement("span");
      pill.className = "badge-detail__meta-pill";
      pill.textContent = value;
      meta.append(pill);
    }
    detail.append(meta);

    const progressBlock = document.createElement("div");
    progressBlock.className = "badge-detail-progress";
    const progressText = document.createElement("p");
    progressText.className = "badge-detail-progress__text";
    progressText.textContent = `${tr("badges.detail.progress", progress)} · ${progress.hint}`;
    const meter = document.createElement("div");
    meter.className = "badge-detail-progress__meter";
    meter.setAttribute("role", "progressbar");
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "100");
    meter.setAttribute("aria-valuenow", String(progress.percent));
    const fill = document.createElement("span");
    fill.className = "badge-detail-progress__fill";
    fill.style.width = `${progress.percent}%`;
    meter.append(fill);
    progressBlock.append(progressText, meter);
    detail.append(progressBlock);

    const requirements = badgeRequirements(badge);
    if (requirements.length) {
      const section = document.createElement("section");
      section.className = "badge-detail__requirements-section";
      const subtitle = document.createElement("h3");
      subtitle.className = "badge-detail__subtitle";
      subtitle.textContent = tr("badges.detail.requirements");
      const grid = document.createElement("div");
      grid.className = "badge-detail-requirements";
      for (const requirement of requirements) {
        grid.append(buildDetailRequirement(requirement));
      }
      section.append(subtitle, grid);
      detail.append(section);
    }

    return detail;
  }

  let activeDetail = null;

  function closeBadgeDetail(overlay, onKeydown) {
    document.removeEventListener?.("keydown", onKeydown);
    overlay?.remove?.();
    if (activeDetail?.overlay === overlay) activeDetail = null;
  }

  function openBadgeDetail(badge) {
    if (activeDetail) closeBadgeDetail(activeDetail.overlay, activeDetail.onKeydown);
    const overlay = document.createElement("div");
    overlay.className = "badge-detail-overlay";
    const onKeydown = (event) => {
      if (event.key === "Escape") closeBadgeDetail(overlay, onKeydown);
    };
    const detail = buildBadgeDetail(badge, {
      onClose: () => closeBadgeDetail(overlay, onKeydown),
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeBadgeDetail(overlay, onKeydown);
    });
    overlay.append(detail);
    (document.body || lastHost || document.documentElement)?.append?.(overlay);
    document.addEventListener?.("keydown", onKeydown);
    activeDetail = { overlay, onKeydown };
    detail.querySelector?.(".badge-detail__close")?.focus?.();
    return overlay;
  }

  function buildBadgeTile(badge) {
    const tile = document.createElement("article");
    tile.className = badgeTileClassNames(badge).join(" ");
    const progress = normalizeProgress(badge);
    const copy = displayBadgeCopy(badge);
    tile.setAttribute("role", "button");
    tile.setAttribute("tabindex", "0");
    tile.setAttribute("aria-haspopup", "dialog");
    tile.setAttribute("aria-label", tr("badges.detail.open", { title: copy.title }));
    tile.addEventListener("click", () => openBadgeDetail(badge));
    tile.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault?.();
      openBadgeDetail(badge);
    });

    const icon = document.createElement("span");
    icon.className = "app-icon badge-tile__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = badge.unlocked ? "★" : "□";
    tile.append(icon);

    const body = document.createElement("div");
    body.className = "badge-tile__body";
    const t = document.createElement("h3");
    t.className = "badge-tile__title";
    t.textContent = copy.title;
    const d = document.createElement("p");
    d.className = "badge-tile__desc";
    d.textContent = copy.description;
    body.append(t, d);
    const preview = buildRequirementsPreview(badge);
    if (preview) body.append(preview);
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
    status.textContent = badge.unlocked
      ? tr("badges.status.unlocked")
      : tr("badges.status.sealed", { percent: progress.percent });
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
    displayCopy: displayBadgeCopy,
    labelForId(id, state = cachedState) {
      const catalog = Array.isArray(state?.catalog) ? state.catalog : [];
      const badge = catalog.find((item) => item?.id === id);
      if (!badge) return "";
      return displayBadgeCopy(
        { ...badge, unlocked: true },
        { forceReveal: true },
      ).title;
    },
    nearest: nearestBadge,
    get state() {
      return cachedState;
    },
  };
  window.PokevaultI18n?.subscribeLocale?.(() => {
    if (lastHost) renderInto(lastHost);
  });
  if (window.__POKEVAULT_BADGES_TESTS__) {
    window.PokevaultBadges._test = {
      nearestBadge,
      normalizeProgress,
      displayBadgeCopy,
      filterBadges,
      badgeTileClassNames,
      badgeRequirements,
      buildRequirementChip,
      buildBadgeTile,
      buildBadgeDetail,
      buildSegmentedFilter,
    };
  }
})();
