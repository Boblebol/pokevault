/**
 * Onboarding wizard (F00).
 *
 * Five-step intro dialog that:
 *   1. Positions Pokevault as a Pokédex-first tracker ;
 *   2. Explains optional local Trainer Card trade matching ;
 *   3. Captures the favorite region ;
 *   4. Captures simple or advanced tracking mode ;
 *   5. Clarifies the local-first file workflow.
 *
 * The result is persisted under `localStorage["pokevault.ui.profile"]`
 * with the shape :
 *   {
 *     version: 2,
 *     completed_at: ISO string | null,
 *     goal: "complete_pokedex",
 *     favorite_region: "all" | region id,
 *     tracking_mode: "simple" | "advanced",
 *     skipped: boolean
 *   }
 *
 * On first load, the dialog opens automatically. Users can re-launch it
 * from Réglages → Profil via the `#replayOnboardingBtn` button.
 */

(function onboardingModule() {
  const STORAGE_KEY = "pokevault.ui.profile";
  const PREFERRED_REGION_STORAGE_KEY = "pokedexPreferredRegion";
  const FORM_FILTER_STORAGE_KEY = "pokedexFormFilter";
  const DIM_STORAGE_KEY = "pokedexDimMode";
  const TOTAL_STEPS = 5;

  const REGION_LABELS = {
    all: "National",
    kanto: "Kanto",
    johto: "Johto",
    hoenn: "Hoenn",
    sinnoh: "Sinnoh",
    unys: "Unys",
    kalos: "Kalos",
    alola: "Alola",
    galar: "Galar",
    hisui: "Hisui",
    paldea: "Paldea",
  };
  const FALLBACK_I18N = {
    "onboarding.profile.undefined": "Profil : non défini — rejoue l'onboarding pour personnaliser.",
    "onboarding.profile.summary": "Profil : Compléter mon Pokédex · {region} · {t} / {s} / {g} · classeurs locaux.",
    "onboarding.org.infinite": "Grand",
    "onboarding.org.finite": "Petits (10f)",
    "onboarding.org.sep_yes": "Sép.",
    "onboarding.org.sep_no": "Continu",
    "onboarding.org.group_aligned": "Isolé",
    "onboarding.org.group_compact": "Compact",
    "onboarding.done": "Terminer",
    "onboarding.continue": "Continuer",
  };

  function t(key, params = {}) {
    const runtime = window.PokevaultI18n;
    if (runtime?.t) return runtime.t(key, params);
    const template = FALLBACK_I18N[key] || key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
    );
  }

  function normalizeGoal(value) {
    void value;
    return "complete_pokedex";
  }

  function normalizeRegion(value) {
    const id = typeof value === "string" && value.trim() ? value.trim() : "all";
    return REGION_LABELS[id] ? id : "all";
  }

  function normalizeBinderType(value) {
    return value === "finite_10" ? "finite_10" : "infinite";
  }

  function normalizeBinderRegionSep(value) {
    return value === "yes" ? "yes" : "no";
  }

  function normalizeBinderFamilyGroup(value) {
    return value === "aligned" ? "aligned" : "compact";
  }

  function migrateLegacyProfile(data) {
    return {
      version: 2,
      goal: "complete_pokedex",
      favorite_region: "all",
      binder_type: "infinite",
      binder_region_sep: "no",
      binder_family_group: "compact",
      completed_at: typeof data.completed_at === "string" ? data.completed_at : null,
      skipped: Boolean(data.skipped),
    };
  }

  /** @returns {null | {version: number; goal: string; favorite_region: string; binder_type: string; binder_region_sep: string; binder_family_group: string; completed_at: string | null; skipped: boolean}} */
  function readProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      if (data.version !== 2) return migrateLegacyProfile(data);
      return {
        version: 2,
        goal: normalizeGoal(data.goal),
        favorite_region: normalizeRegion(data.favorite_region),
        binder_type: normalizeBinderType(data.binder_type),
        binder_region_sep: normalizeBinderRegionSep(data.binder_region_sep),
        binder_family_group: normalizeBinderFamilyGroup(data.binder_family_group),
        completed_at: typeof data.completed_at === "string" ? data.completed_at : null,
        skipped: Boolean(data.skipped),
      };
    } catch {
      return null;
    }
  }

  function writeProfile(payload) {
    const body = {
      version: 2,
      goal: normalizeGoal(payload.goal),
      favorite_region: normalizeRegion(payload.favorite_region),
      binder_type: normalizeBinderType(payload.binder_type),
      binder_region_sep: normalizeBinderRegionSep(payload.binder_region_sep),
      binder_family_group: normalizeBinderFamilyGroup(payload.binder_family_group),
      completed_at: payload.skipped ? null : new Date().toISOString(),
      skipped: Boolean(payload.skipped),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(body));
    } catch {
      /* private mode */
    }
    return body;
  }

  function listHashParts() {
    const raw = location.hash || "#/liste";
    const clean = raw.replace(/^#/, "");
    const [path = "/liste", query = ""] = clean.split("?");
    const route = path.replace(/^\//, "") || "liste";
    return { route, query };
  }

  function writeListFiltersToHash(profile, formScope) {
    const { route, query } = listHashParts();
    if (route !== "liste") return;
    const params = new URLSearchParams(query);
    const hasExplicitRegion = params.has("region");
    const hasExplicitForms = params.has("forms");
    if (hasExplicitRegion && hasExplicitForms) return;

    const filters = {
      status: params.get("status") || "all",
      region: hasExplicitRegion ? params.get("region") || "all" : profile.favorite_region,
      forms: hasExplicitForms ? params.get("forms") || "all" : formScope,
      type: params.get("type") || "all",
      tags: params.get("tags") ? params.get("tags").split(",").filter(Boolean) : [],
    };
    const next = window.PokevaultFilters?.buildFilterHash?.(
      location.hash || "#/liste",
      filters,
    ) || fallbackFilterHash(filters);
    if (next && next !== location.hash) {
      history.replaceState(null, "", next);
    }
  }

  function fallbackFilterHash(filters) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (filters.region && filters.region !== "all") params.set("region", filters.region);
    if (filters.forms && filters.forms !== "all") params.set("forms", filters.forms);
    if (filters.type && filters.type !== "all") params.set("type", filters.type);
    if (filters.tags?.length) params.set("tags", filters.tags.join(","));
    const qs = params.toString();
    return `#/liste${qs ? `?${qs}` : ""}`;
  }

  function applyPreferences(profile) {
    if (!profile) return;
    const clean = {
      goal: normalizeGoal(profile.goal),
      favorite_region: normalizeRegion(profile.favorite_region),
      binder_type: normalizeBinderType(profile.binder_type),
      binder_region_sep: normalizeBinderRegionSep(profile.binder_region_sep),
      binder_family_group: normalizeBinderFamilyGroup(profile.binder_family_group),
    };

    const formScope = "base_regional";
    const dimMode = "caught";

    try {
      localStorage.setItem(FORM_FILTER_STORAGE_KEY, formScope);
    } catch {
      /* ignore */
    }

    if (clean.favorite_region !== "all") {
      try {
        localStorage.setItem(PREFERRED_REGION_STORAGE_KEY, clean.favorite_region);
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.removeItem(PREFERRED_REGION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    const PC = window.PokedexCollection;
    if (PC && typeof PC.setDimMode === "function") {
      PC.setDimMode(dimMode);
    } else {
      try {
        localStorage.setItem(DIM_STORAGE_KEY, dimMode);
      } catch {
        /* ignore */
      }
    }
    writeListFiltersToHash(clean, formScope);
  }

  function formatSettingsProfileLabel(p) {
    if (!p || p.skipped) {
      return t("onboarding.profile.undefined");
    }
    const region = REGION_LABELS[p.favorite_region] || "National";
    const t_label = p.binder_type === "finite_10" ? t("onboarding.org.finite") : t("onboarding.org.infinite");
    const s_label = p.binder_region_sep === "yes" ? t("onboarding.org.sep_yes") : t("onboarding.org.sep_no");
    const g_label = p.binder_family_group === "aligned" ? t("onboarding.org.group_aligned") : t("onboarding.org.group_compact");

    return t("onboarding.profile.summary", { region, t: t_label, s: s_label, g: g_label });
  }

  function updateSettingsProfileLabel() {
    const el = document.getElementById("settingsProfileLabel");
    if (!el) return;
    el.textContent = formatSettingsProfileLabel(readProfile());
  }

  class Wizard {
    constructor(dialog) {
      this.dialog = dialog;
      this.step = 1;
      this.form = dialog.querySelector("#onboardingForm");
      this.nextBtn = dialog.querySelector("#onboardingNext");
      this.backBtn = dialog.querySelector("#onboardingBack");
      this.skipBtn = dialog.querySelector("#onboardingSkip");
      this.wire();
    }

    wire() {
      this.nextBtn.addEventListener("click", () => this.advance());
      this.backBtn.addEventListener("click", () => this.rewind());
      this.skipBtn.addEventListener("click", () => this.skip());
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (this.step >= TOTAL_STEPS) this.finish();
        else this.advance();
      });
    }

    open() {
      this.step = 1;
      this.paint();
      if (typeof this.dialog.showModal === "function" && !this.dialog.open) {
        this.dialog.showModal();
      } else {
        this.dialog.setAttribute("open", "");
      }
    }

    close() {
      if (typeof this.dialog.close === "function" && this.dialog.open) {
        this.dialog.close();
      } else {
        this.dialog.removeAttribute("open");
      }
    }

    paint() {
      for (const section of this.dialog.querySelectorAll(".onboarding__step")) {
        const n = Number(section.dataset.step);
        const on = n === this.step;
        section.classList.toggle("is-active", on);
        section.hidden = !on;
      }
      for (const dot of this.dialog.querySelectorAll(".onboarding__dot")) {
        const n = Number(dot.dataset.stepDot);
        dot.classList.toggle("is-active", n === this.step);
        dot.classList.toggle("is-done", n < this.step);
      }
      this.backBtn.disabled = this.step === 1;
      this.backBtn.style.visibility = this.step === 1 ? "hidden" : "visible";
      this.nextBtn.textContent = this.step >= TOTAL_STEPS ? t("onboarding.done") : t("onboarding.continue");
    }

    advance() {
      if (this.step >= TOTAL_STEPS) {
        this.finish();
        return;
      }
      this.step += 1;
      this.paint();
    }

    rewind() {
      if (this.step <= 1) return;
      this.step -= 1;
      this.paint();
    }

    readSelections() {
      const goal = /** @type {HTMLInputElement | null} */ (
        this.form.querySelector("#onboardingGoal")
      );
      const region = /** @type {HTMLSelectElement | null} */ (
        this.form.querySelector("#onboardingFavoriteRegion")
      );
      const bType = /** @type {HTMLInputElement | null} */ (
        this.form.querySelector('input[name="binder_type"]:checked')
      );
      const bSep = /** @type {HTMLInputElement | null} */ (
        this.form.querySelector('input[name="binder_region_sep"]:checked')
      );
      const bGroup = /** @type {HTMLInputElement | null} */ (
        this.form.querySelector('input[name="binder_family_group"]:checked')
      );
      return {
        goal: goal?.value || "complete_pokedex",
        favorite_region: region?.value || "all",
        binder_type: bType?.value || "infinite",
        binder_region_sep: bSep?.value || "no",
        binder_family_group: bGroup?.value || "compact",
      };
    }

    finish() {
      const selections = this.readSelections();
      const saved = writeProfile({ ...selections, skipped: false });
      applyPreferences(saved);
      updateSettingsProfileLabel();
      this.close();
      window.dispatchEvent(
        new CustomEvent("pokevault:onboarded", { detail: saved }),
      );
    }

    skip() {
      const selections = this.readSelections();
      writeProfile({ ...selections, skipped: true });
      updateSettingsProfileLabel();
      this.close();
    }
  }

  function shouldOpen(profile) {
    if (!profile) return true;
    if (profile.skipped) return false;
    return !profile.completed_at;
  }

  /** @type {Wizard | null} */
  let instance = null;

  function ensure() {
    if (instance) return instance;
    const dlg = document.getElementById("onboardingWizard");
    if (!dlg) return null;
    instance = new Wizard(dlg);
    return instance;
  }

  function openIfNeeded() {
    const profile = readProfile();
    if (!shouldOpen(profile)) return false;
    const w = ensure();
    if (!w) return false;
    w.open();
    return true;
  }

  function relaunch() {
    const w = ensure();
    if (!w) return;
    w.open();
  }

  function wireReplayButton() {
    const btn = document.getElementById("replayOnboardingBtn");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => relaunch());
  }

  window.PokevaultOnboarding = {
    openIfNeeded,
    relaunch,
    readProfile,
    refreshSettings: updateSettingsProfileLabel,
  };
  if (window.__POKEVAULT_ONBOARDING_TESTS__) {
    window.PokevaultOnboarding._test = {
      readProfile,
      writeProfile,
      applyPreferences,
      shouldOpen,
      formatSettingsProfileLabel,
    };
  }

  function bootstrap() {
    const profile = readProfile();
    if (profile && !profile.skipped) applyPreferences(profile);
    wireReplayButton();
    updateSettingsProfileLabel();
    window.PokevaultI18n?.subscribeLocale?.(() => {
      updateSettingsProfileLabel();
      instance?.paint?.();
    });
    openIfNeeded();
  }

  const storedProfile = readProfile();
  if (storedProfile && !storedProfile.skipped) applyPreferences(storedProfile);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
