/**
 * Onboarding wizard (F00).
 *
 * Three-step intro dialog that:
 *   1. Positions Pokevault as a Pokédex-first tracker ;
 *   2. Asks the collector profile (dex / hybrid / card) ;
 *   3. Captures starting form scope + dim mode.
 *
 * The result is persisted under `localStorage["pokevault.ui.profile"]`
 * with the shape :
 *   {
 *     version: 1,
 *     completed_at: ISO string | null,
 *     profile: "dex" | "hybrid" | "card",
 *     form_scope: "all" | "base_only" | "base_regional",
 *     dim_mode: "caught" | "missing",
 *     skipped: boolean
 *   }
 *
 * On first load, the dialog opens automatically. Users can re-launch it
 * from Réglages → Profil via the `#replayOnboardingBtn` button.
 */

(function onboardingModule() {
  const STORAGE_KEY = "pokevault.ui.profile";
  const TOTAL_STEPS = 3;

  const PROFILE_COPY = {
    dex: "Pokédex pur",
    hybrid: "Hybride (dex + cartes)",
    card: "TCG physique",
  };

  /** @returns {null | {profile: string; form_scope: string; dim_mode: string; completed_at: string | null; skipped: boolean}} */
  function readProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return {
        version: data.version === 1 ? 1 : 1,
        profile: typeof data.profile === "string" ? data.profile : "dex",
        form_scope: typeof data.form_scope === "string" ? data.form_scope : "all",
        dim_mode: data.dim_mode === "missing" ? "missing" : "caught",
        completed_at: typeof data.completed_at === "string" ? data.completed_at : null,
        skipped: Boolean(data.skipped),
      };
    } catch {
      return null;
    }
  }

  function writeProfile(payload) {
    const body = {
      version: 1,
      profile: payload.profile,
      form_scope: payload.form_scope,
      dim_mode: payload.dim_mode,
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

  function applyPreferences(profile) {
    if (!profile) return;
    if (profile.form_scope && profile.form_scope !== "all") {
      try {
        localStorage.setItem("pokedexFormFilter", profile.form_scope);
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.removeItem("pokedexFormFilter");
      } catch {
        /* ignore */
      }
    }
    const PC = window.PokedexCollection;
    if (PC && typeof PC.setDimMode === "function") {
      PC.setDimMode(profile.dim_mode);
    } else {
      try {
        localStorage.setItem("pokedexDimMode", profile.dim_mode);
      } catch {
        /* ignore */
      }
    }
  }

  function updateSettingsProfileLabel() {
    const el = document.getElementById("settingsProfileLabel");
    if (!el) return;
    const p = readProfile();
    if (!p || p.skipped) {
      el.textContent = "Profil : non défini — rejoue l'onboarding pour personnaliser.";
      return;
    }
    const label = PROFILE_COPY[p.profile] || "Inconnu";
    const forms =
      p.form_scope === "base_only"
        ? "formes de base"
        : p.form_scope === "base_regional"
          ? "base + régionales"
          : "tout le dex";
    const dim = p.dim_mode === "missing" ? "atténue les manquants" : "atténue les attrapés";
    el.textContent = `Profil : ${label} · ${forms} · ${dim}.`;
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
      this.nextBtn.textContent = this.step >= TOTAL_STEPS ? "Terminer" : "Continuer";
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
      const profileInput = /** @type {HTMLInputElement | null} */ (
        this.form.querySelector('input[name="onboardingProfile"]:checked')
      );
      const forms = /** @type {HTMLSelectElement | null} */ (
        this.form.querySelector("#onboardingForms")
      );
      const dim = /** @type {HTMLSelectElement | null} */ (
        this.form.querySelector("#onboardingDim")
      );
      return {
        profile: profileInput?.value || "dex",
        form_scope: forms?.value || "all",
        dim_mode: dim?.value === "missing" ? "missing" : "caught",
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
    if (profile && profile.completed_at) return false;
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

  function bootstrap() {
    wireReplayButton();
    updateSettingsProfileLabel();
    openIfNeeded();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
