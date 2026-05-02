/**
 * Classeurs v2 — aperçu API + assistant si aucun classeur en config.
 * Option « par région » : aperçu d’ordre (natives puis formes importées en fin de section).
 */

const API_BINDER_ROOT = "/api/binder";
const API_BINDER_CONFIG = "/api/binder/config";
const API_BINDER_PLACEMENTS = "/api/binder/placements";

const LS_WIZARD_DISMISSED = "pokedexBinderWizardDismissed";

let binderV2Started = false;
let binderV2LocaleSubbed = false;
let wizardStep = 0;
const wizardLastStep = 3;

const WIZARD_STEP_LABELS = [
  "binder_wizard.step.organization",
  "binder_wizard.step.forms",
  "binder_wizard.step.format",
  "binder_wizard.step.summary",
];

const BINDER_WIZARD_FALLBACK_I18N = {
  "binder_wizard.step.organization": "Organisation",
  "binder_wizard.step.forms": "Formes à suivre",
  "binder_wizard.step.format": "Format du classeur",
  "binder_wizard.step.summary": "Récapitulatif",
  "binder_wizard.save": "Enregistrer",
  "binder_wizard.continue": "Continuer",
  "binder_wizard.choose_binder": "Classeur à régler (liste défilante)",
  "binder_wizard.choose_binder_aria": "Choisir le classeur à modifier",
  "binder_wizard.default_name": "Principal",
  "binder_wizard.form.base_only.title": "Base principale seule",
  "binder_wizard.form.base_regional.title": "Base + formes régionales (sans Méga / Gigamax)",
  "binder_wizard.form.full.title": "Complet — Méga, Gigamax, formes nommées",
  "binder_wizard.filter.all_regions": "Toutes les régions",
  "binder_wizard.filter.all": "Toutes",
  "binder_wizard.preview.hint": "Tri : régions (ordre national), natives puis formes importées en fin de bloc. Filtre : {filter} — {shown} / {filtered} entrées affichées ({total} au total).",
  "binder_wizard.preview.filter_all": "toutes",
  "binder_wizard.preview.regional_form": "forme régionale",
  "binder_wizard.org.lead": "Choisis comment les entrées seront ordonnées dans le classeur. Tu pourras ajuster la grille juste après.",
  "binder_wizard.org.national.title": "Tous à la suite",
  "binder_wizard.org.national.desc": "Ordre national du Pokédex, du premier au dernier numéro.",
  "binder_wizard.org.by_region.title": "Par région",
  "binder_wizard.org.by_region.desc": "Blocs par région : espèces natives d’abord, puis formes « importées » en fin de section.",
  "binder_wizard.org.family.title": "Familles",
  "binder_wizard.org.family.desc": "Lignes par famille d’évolution, avec des cases vides volontaires pour garder les stades alignés.",
  "binder_wizard.form.lead": "Les séries de cartes ne couvrent pas tout (Méga, Gigamax, Pikachu déguisé…). Choisis un périmètre réaliste pour ton suivi ; tu pourras l’éditer dans le JSON plus tard.",
  "binder_wizard.form.base_only.choice_title": "Base seule",
  "binder_wizard.form.base_only.desc": "Une entrée par forme « principale » du Pokédex, sans variantes régionales.",
  "binder_wizard.form.base_regional.choice_title": "Base + régionales",
  "binder_wizard.form.base_regional.desc": "Inclut Alola, Galar, Hisui, etc. — sans Méga, sans Gigamax, sans formes annexes type costumes.",
  "binder_wizard.form.full.choice_title": "Complet",
  "binder_wizard.form.full.desc": "Méga, Gigamax et autres formes nommées : plus de lignes, beaucoup de cartes n’existent pas pour tout le monde.",
  "binder_wizard.format.lead": "Même nombre de pochettes sur chaque face (recto / verso). Presets 3×3 ou 2×2 avec 10 feuillets, ou grille personnalisée.",
  "binder_wizard.format.3x3.title": "3 × 3",
  "binder_wizard.format.3x3.desc": "9 cases par page · 10 feuillets (recto + verso).",
  "binder_wizard.format.2x2.title": "2 × 2",
  "binder_wizard.format.2x2.desc": "4 cases par page · 10 feuillets.",
  "binder_wizard.format.custom.title": "Personnalisé",
  "binder_wizard.format.custom.desc": "Lignes, colonnes (1–12) et feuillets (1–200) au choix.",
  "binder_wizard.format.rows": "Lignes par page",
  "binder_wizard.format.cols": "Colonnes par page",
  "binder_wizard.format.sheets": "Nombre de feuillets",
  "binder_wizard.format.hint": "Un feuillet = une feuille plastique recto-verso. Emplacements totaux = cases par page × 2 × feuillets.",
  "binder_wizard.summary.org": "Organisation",
  "binder_wizard.summary.forms": "Formes",
  "binder_wizard.summary.format": "Format",
  "binder_wizard.summary.grid": "Grille",
  "binder_wizard.summary.capacity": "Capacité",
  "binder_wizard.summary.name": "Nom du classeur",
  "binder_wizard.summary.org_family": "Familles d'évolution (stades alignés avec trous volontaires)",
  "binder_wizard.summary.org_region": "Par région (natives puis formes importées en fin de bloc)",
  "binder_wizard.summary.org_national": "National (ordre du Pokédex)",
  "binder_wizard.summary.preset_3x3": "Preset 3 × 3 · 10 feuillets",
  "binder_wizard.summary.preset_2x2": "Preset 2 × 2 · 10 feuillets",
  "binder_wizard.summary.preset_custom": "Grille et feuillets personnalisés",
  "binder_wizard.summary.scope_base": "Base seule",
  "binder_wizard.summary.scope_full": "Complet (Méga, Gigamax, formes nommées)",
  "binder_wizard.summary.scope_regional": "Base + formes régionales",
  "binder_wizard.summary.grid_value": "{rows} × {cols} — {slots} cases par page",
  "binder_wizard.summary.capacity_value": "{sheets} feuillets → {pages} pages, {slots} emplacements au total",
  "binder_wizard.summary.family_name": "Un ou plusieurs classeurs Familles : les grandes familles gardent leurs lignes, les trous restent visibles.",
  "binder_wizard.summary.region_name": "Un ou plusieurs classeurs par région : si le format est trop petit, les sections sont nommées Kanto 1, Kanto 2, etc.",
  "binder_wizard.summary.default_name": "{name} (modifiable plus tard dans le fichier JSON)",
  "binder_wizard.summary.edit_note": "Enregistrement : le classeur existant et la règle de formes associée sont mis à jour dans binder-config.json.",
  "binder_wizard.summary.new_note": "Les placements restent vides jusqu’à l’UI de rangement. Le périmètre des formes est enregistré dans la config classeur.",
  "binder_wizard.error.config": "Enregistrement config refusé ({status}).",
  "binder_wizard.error.placements": "Config OK mais placements refusés ({status}).",
  "binder_wizard.error.choose_org": "Choisis une organisation : national ou par région.",
  "binder_wizard.error.choose_format": "Choisis un format de grille (preset ou personnalisé).",
  "binder_wizard.error.choose_forms": "Choisis un périmètre de formes (base, base + région, ou complet).",
  "binder_wizard.error.api": "Impossible de joindre l’API classeurs (réseau ou CORS).",
};

function tBinderWizard(key, params = {}) {
  const runtime = window.PokevaultI18n;
  if (runtime?.t) return runtime.t(key, params);
  const template = BINDER_WIZARD_FALLBACK_I18N[key] || key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
  );
}

/** @type {"base_only" | "base_regional" | "full"} */
const DEFAULT_FORM_SCOPE = "base_only";

/** @type {{ name: string; organization: string; formScope: string; formatPreset: string; rows: number; cols: number; sheetCount: number; editBinderId: string | null }} */
let wizardDraft = {
  name: tBinderWizard("binder_wizard.default_name"),
  organization: "national",
  formScope: DEFAULT_FORM_SCOPE,
  formatPreset: "3x3-10",
  rows: 3,
  cols: 3,
  sheetCount: 10,
  editBinderId: null,
};

let lastConfigJson = null;
/** @type {object | null} */
let lastPlacementsPayload = null;

/** @type {{ file_exists: boolean; binder_wizard_dismissed: boolean }} */
let trackerUiCache = {
  file_exists: false,
  binder_wizard_dismissed: false,
};
readTrackerUiFromStorage();
/** @type {unknown[]} */
let binderPreviewSortedFull = [];
/** @type {{ id: string; label_fr: string; low: number; high: number }[]} */
let binderPreviewDefs = [];
let binderRegionFilterId = "all";
/** @type {{ families?: unknown[] } | null} */
let binderEvolutionFamilies = null;

function setBinderHint(el, text, hidden) {
  if (!el) return;
  el.textContent = text;
  el.hidden = hidden;
}

function isBinderConfigEmpty(cfg) {
  return !cfg || !Array.isArray(cfg.binders) || cfg.binders.length === 0;
}

function shouldEnsureDefaultWorkspace(cfg) {
  return isBinderConfigEmpty(cfg);
}

function safeBinderIdPart(value) {
  return String(value || "classeur").replace(/[^a-z0-9_-]/gi, "-");
}

function normalizeFormScope(scope) {
  return scope === "base_only" || scope === "base_regional" || scope === "full"
    ? scope
    : DEFAULT_FORM_SCOPE;
}

function positiveInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizedBinderLayout(draft) {
  const rows = positiveInt(draft?.rows, 3);
  const cols = positiveInt(draft?.cols, 3);
  const sheetCount = positiveInt(draft?.sheetCount ?? draft?.sheet_count, 10);
  return { rows, cols, sheetCount };
}

function binderCapacity(layoutLike) {
  const layout = normalizedBinderLayout(layoutLike);
  return layout.rows * layout.cols * layout.sheetCount * 2;
}

function wizardSkipped() {
  return Boolean(trackerUiCache.binder_wizard_dismissed);
}

function readTrackerUiFromStorage() {
  try {
    trackerUiCache.binder_wizard_dismissed = localStorage.getItem(LS_WIZARD_DISMISSED) === "1";
  } catch {
    /* ignore */
  }
}

async function refreshTrackerUiCache() {
  readTrackerUiFromStorage();
}

async function setWizardSkipped(on) {
  try {
    localStorage.setItem(LS_WIZARD_DISMISSED, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  trackerUiCache.binder_wizard_dismissed = Boolean(on);
}

/**
 * @param {{ id: string }[]} summaries
 * @param {{ id: string; binder: object; form_rule: object | null; placements: Record<string, unknown> }[]} detailsList
 */
function mergeWorkspaceFromDetails(summaries, detailsList) {
  const byId = new Map();
  for (const d of detailsList) {
    if (d && d.id) byId.set(String(d.id), d);
  }
  const binders = [];
  for (const s of summaries) {
    if (!s?.id) continue;
    const d = byId.get(String(s.id));
    if (d?.binder) binders.push(d.binder);
  }
  const form_rules = [];
  const seenRule = new Set();
  for (const d of detailsList) {
    const fr = d?.form_rule;
    if (fr && typeof fr === "object" && fr.id) {
      const rid = String(fr.id);
      if (!seenRule.has(rid)) {
        seenRule.add(rid);
        form_rules.push(fr);
      }
    }
  }
  const by_binder = {};
  for (const d of detailsList) {
    if (!d?.id) continue;
    const raw = d.placements;
    by_binder[String(d.id)] = raw && typeof raw === "object" ? { ...raw } : {};
  }
  return {
    config: {
      version: 1,
      convention: "sheet_recto_verso",
      binders,
      form_rules,
    },
    placements: { version: 1, by_binder },
  };
}

async function fetchBinderWorkspaceMerged() {
  const listRes = await fetch(API_BINDER_ROOT);
  if (!listRes.ok) throw new Error(String(listRes.status));
  const summaries = await listRes.json();
  if (!Array.isArray(summaries)) throw new Error("bad list");
  if (summaries.length === 0) {
    return {
      config: {
        version: 1,
        convention: "sheet_recto_verso",
        binders: [],
        form_rules: [],
      },
      placements: { version: 1, by_binder: {} },
    };
  }
  const detailsList = [];
  for (const s of summaries) {
    const id = s?.id;
    if (!id) continue;
    const dr = await fetch(`${API_BINDER_ROOT}/${encodeURIComponent(String(id))}`);
    if (!dr.ok) throw new Error(`${id} ${dr.status}`);
    detailsList.push(await dr.json());
  }
  return mergeWorkspaceFromDetails(summaries, detailsList);
}

async function onRegionPresetClick() {
  const hint = document.getElementById("binderV2Hint");
  const ok = await ensureRegionDefaultWorkspace();
  if (!ok) return;
  if (hint) setBinderHint(hint, "", true);
  location.hash = "#/classeur";
  await refreshBinderV2();
}

async function ensureRegionDefaultWorkspace() {
  const { defs, pokemon } = await fetchPokedexBinderData();
  if (!defs.length) return false;
  const { configBody, placementsBody } = buildRegionalBinderWorkspace(
    {
      name: "Principal",
      organization: "by_region",
      formScope: "base_regional",
      rows: 3,
      cols: 3,
      sheetCount: 10,
    },
    defs,
    pokemon,
  );
  if (!configBody.binders.length) return false;
  const cfgRes = await fetch(API_BINDER_CONFIG, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configBody),
  });
  if (!cfgRes.ok) return false;
  const plRes = await fetch(API_BINDER_PLACEMENTS, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(placementsBody),
  });
  return plRes.ok;
}

function wireRegionPresetOnce() {
  const btn = document.getElementById("binderRegionPresetBtn");
  const customize = document.getElementById("binderRegionPresetCustomize");
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => void onRegionPresetClick());
  }
  if (customize && !customize.dataset.wired) {
    customize.dataset.wired = "1";
    customize.addEventListener("click", (e) => {
      e.preventDefault();
      openWizard();
    });
  }
}

function onboardingCoversBinderWizard() {
  return false;
}

function toggleBinderViews(showWizard) {
  const wrap = document.getElementById("binderWizardWrap");
  const content = document.getElementById("binderContentWrap");
  const reopen = document.getElementById("binderWizardReopen");
  const settingsBtn = document.getElementById("binderWizardSettings");
  if (wrap) wrap.hidden = !showWizard;
  if (content) content.hidden = showWizard;
  const empty = lastConfigJson && isBinderConfigEmpty(lastConfigJson);
  if (reopen) {
    reopen.hidden = !(
      empty &&
      !showWizard &&
      wizardSkipped() &&
      !onboardingCoversBinderWizard()
    );
  }
  if (settingsBtn) {
    settingsBtn.hidden = showWizard || !lastConfigJson || isBinderConfigEmpty(lastConfigJson);
  }
}

function renderWizardDots() {
  const host = document.getElementById("binderWizardDots");
  if (!host) return;
  host.replaceChildren();
  for (let i = 0; i <= wizardLastStep; i++) {
    const d = document.createElement("span");
    d.className = "wizard-dot";
    if (i < wizardStep) d.classList.add("is-done");
    if (i === wizardStep) d.classList.add("is-current");
    host.append(d);
  }
}

function syncWizardChrome() {
  renderWizardDots();
  const meta = document.getElementById("binderWizardStepMeta");
  const back = document.getElementById("binderWizardBack");
  const next = document.getElementById("binderWizardNext");
  if (meta) {
    meta.textContent = `${tBinderWizard(WIZARD_STEP_LABELS[wizardStep])} — ${wizardStep + 1} / ${wizardLastStep + 1}`;
  }
  if (back) back.disabled = wizardStep === 0;
  if (next) next.textContent = wizardStep === wizardLastStep
    ? tBinderWizard("binder_wizard.save")
    : tBinderWizard("binder_wizard.continue");
}

function clearEl(el) {
  if (el) el.replaceChildren();
}

function readOrgSelectionFromDom() {
  const sel = document.querySelector(".wizard-org-card.is-selected");
  if (!sel) return null;
  const org = sel.dataset.org || "";
  if (org === "by_region" || org === "family") return org;
  return "national";
}

function readFormScopeFromDom() {
  const sel = document.querySelector(".wizard-form-card.is-selected");
  if (!sel) return null;
  const v = sel.dataset.formScope || "";
  if (v === "base_only" || v === "base_regional" || v === "full") return v;
  return null;
}

/**
 * @param {string} scope
 */
function formRuleFromScope(scope) {
  const full = scope === "full";
  const baseOnly = scope === "base_only";
  const id = `wizard-forms-${scope}`;
  const labels = {
    base_only: tBinderWizard("binder_wizard.form.base_only.title"),
    base_regional: tBinderWizard("binder_wizard.form.base_regional.title"),
    full: tBinderWizard("binder_wizard.form.full.title"),
  };
  return {
    id,
    label: labels[scope] || labels.base_regional,
    include_base: true,
    include_mega: full,
    include_gigamax: full,
    include_regional: !baseOnly,
    include_other_named_forms: full,
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} rule
 * @returns {"base_only" | "base_regional" | "full"}
 */
function inferFormScopeFromRule(rule) {
  if (!rule || typeof rule !== "object") return DEFAULT_FORM_SCOPE;
  const mega = Boolean(rule.include_mega);
  const giga = Boolean(rule.include_gigamax);
  const other = Boolean(rule.include_other_named_forms);
  if (mega || giga || other) return "full";
  if (rule.include_regional === false) return "base_only";
  return "base_regional";
}

function normTxt(s) {
  return String(s || "").toLowerCase();
}

function isMegaFormPokemon(p) {
  const f = normTxt(p.form);
  const slug = normTxt(p.slug);
  if (/\bméga\b/.test(f) || /\bmega\b/.test(f)) return true;
  if (slug.includes("-mega-")) return true;
  if (/-mega-x$/.test(slug) || /-mega-y$/.test(slug) || /-mega$/.test(slug)) return true;
  return false;
}

function isGigamaxPokemon(p) {
  const f = normTxt(p.form);
  const slug = normTxt(p.slug);
  return (
    f.includes("gigamax") ||
    f.includes("g-max") ||
    slug.includes("gmax") ||
    slug.includes("gigantamax")
  );
}

function isRegionalFormPokemon(p) {
  const f = normTxt(p.form);
  const slug = normTxt(p.slug);
  if (isMegaFormPokemon(p) || isGigamaxPokemon(p)) return false;
  if (
    /\bd'?alola\b/.test(f) ||
    f.includes("de galar") ||
    /\bde\s+galar\b/.test(f) ||
    f.includes("hisui") ||
    f.includes("hisu") ||
    f.includes("paldea")
  ) {
    return true;
  }
  if (/(^|-)(alola|galar|hisui|paldea)(-|$)/.test(slug)) return true;
  if (slug.includes("alolan") || slug.includes("galarian") || slug.includes("hisuian")) return true;
  return false;
}

function isOtherNamedFormPokemon(p) {
  const number = String(p?.number || "");
  const slug = normTxt(p?.slug || "");
  if (number === "0025" && slug && slug !== "0025-pikachu") {
    // Certaines variantes Pikachu peuvent remonter sans libellé `form` fiable.
    return true;
  }
  const fo = String(p.form || "").trim();
  if (!fo) return false;
  if (isMegaFormPokemon(p) || isGigamaxPokemon(p) || isRegionalFormPokemon(p)) return false;
  return true;
}

/**
 * Exclusions métier spécifiques aux classeurs :
 * - Zarbi lettres
 * - Arceus types
 */
function isExcludedSpecialFormForBinder(p) {
  const number = String(p?.number || "");
  const slug = normTxt(p?.slug || "");
  const form = normTxt(p?.form || "");
  if (
    number === "0201" &&
    (form.startsWith("lettre ") || slug.includes("zarbi-") || slug.includes("unown-"))
  ) {
    return true;
  }
  if (
    number === "0493" &&
    (form.startsWith("type ") || slug.startsWith("0493-arceus-"))
  ) {
    return true;
  }
  return false;
}

/**
 * Indique si une entrée Pokédex respecte la règle de formes du classeur (liste + album).
 * @param {Record<string, unknown>} p
 * @param {Record<string, unknown> | null | undefined} rule
 */
function pokemonMatchesFormRule(p, rule) {
  if (!rule || typeof rule !== "object") return true;
  const mega = Boolean(rule.include_mega);
  const giga = Boolean(rule.include_gigamax);
  const regional = rule.include_regional !== false;
  const other = Boolean(rule.include_other_named_forms);
  if (isMegaFormPokemon(p) && !mega) return false;
  if (isGigamaxPokemon(p) && !giga) return false;
  if (isRegionalFormPokemon(p) && !regional) return false;
  if (isOtherNamedFormPokemon(p) && !other) return false;
  return rule.include_base !== false;
}

function pokemonMatchesBinderRule(p, rule) {
  if (isExcludedSpecialFormForBinder(p)) return false;
  return pokemonMatchesFormRule(p, rule);
}

function isBaseFormPokemon(p) {
  return !String(p?.form || "").trim();
}

/**
 * Classeur: ne garder qu'une seule entrée par numéro national,
 * en privilégiant la forme classique (sans form).
 */
function keepSingleClassicFormPerNumber(pokemon) {
  const byNumber = new Map();
  for (const p of pokemon) {
    const number = String(p?.number || "");
    if (!number) continue;
    const cur = byNumber.get(number);
    if (!cur) {
      byNumber.set(number, p);
      continue;
    }
    if (!isBaseFormPokemon(cur) && isBaseFormPokemon(p)) {
      byNumber.set(number, p);
    }
  }
  const out = [];
  for (const p of pokemon) {
    const number = String(p?.number || "");
    if (!number) continue;
    if (byNumber.get(number) === p) out.push(p);
  }
  return out;
}

function selectBinderPokemonPool(pokemon, rule) {
  const scoped = pokemon.filter((p) => pokemonMatchesBinderRule(p, rule));
  return keepSingleClassicFormPerNumber(scoped);
}

/**
 * @param {object | null | undefined} cfg
 * @param {object | null | undefined} binder
 */
function getFormRuleForBinder(cfg, binder) {
  const fallback = formRuleFromScope(DEFAULT_FORM_SCOPE);
  if (!binder || typeof binder !== "object") return fallback;
  const rules = Array.isArray(cfg?.form_rules) ? cfg.form_rules : [];
  const r = rules.find((x) => x && x.id === binder.form_rule_id);
  return r && typeof r === "object" ? r : fallback;
}

/**
 * Règle pour liste + stats : premier classeur de la config, sinon périmètre site par défaut.
 */
function getEffectiveFormRuleForCollection() {
  const cfg = lastConfigJson;
  const binders = cfg && Array.isArray(cfg.binders) ? cfg.binders : [];
  const b0 = binders.find((x) => x && x.id) || null;
  if (b0) return getFormRuleForBinder(cfg, b0);
  return formRuleFromScope(DEFAULT_FORM_SCOPE);
}

/** @param {object | null} cfg */
function setConfigCache(cfg) {
  lastConfigJson = cfg && typeof cfg === "object" ? cfg : null;
}

function syncWizardBinderBar() {
  const bar = document.getElementById("binderWizardBinderBar");
  if (!bar) return;
  bar.replaceChildren();
  const binders = lastConfigJson && Array.isArray(lastConfigJson.binders) ? lastConfigJson.binders : [];
  const real = binders.filter((b) => b && b.id);
  if (!wizardDraft.editBinderId || real.length < 2) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const lab = document.createElement("span");
  lab.className = "binder-wizard-binder-bar-label";
  lab.textContent = tBinderWizard("binder_wizard.choose_binder");
  const sel = document.createElement("select");
  sel.className = "binder-wizard-binder-select";
  sel.setAttribute("aria-label", tBinderWizard("binder_wizard.choose_binder_aria"));
  const n = real.length;
  sel.size = Math.min(12, Math.max(3, n));
  for (const b of real) {
    const o = document.createElement("option");
    o.value = String(b.id);
    o.textContent = String(b.name || b.id);
    sel.append(o);
  }
  const cur = wizardDraft.editBinderId;
  sel.value = [...sel.options].some((o) => o.value === cur) ? cur : String(real[0].id);
  sel.addEventListener("change", () => {
    const id = sel.value;
    if (!lastConfigJson || !id) return;
    prefillWizardDraftFromConfig(lastConfigJson, id);
    renderWizardStep();
  });
  bar.append(lab, sel);
}

function inferFormatPreset(rows, cols, sheets) {
  const r = Number(rows);
  const c = Number(cols);
  const s = Number(sheets);
  if (r === 3 && c === 3 && s === 10) return "3x3-10";
  if (r === 2 && c === 2 && s === 10) return "2x2-10";
  return "custom";
}

/**
 * @param {object} cfg
 * @param {string | null} binderIdOpt
 */
function prefillWizardDraftFromConfig(cfg, binderIdOpt) {
  const binders = Array.isArray(cfg.binders) ? cfg.binders : [];
  const b = binderIdOpt ? binders.find((x) => x && x.id === binderIdOpt) : binders[0];
  if (!b) {
    wizardDraft.editBinderId = null;
    return;
  }
  const rules = Array.isArray(cfg.form_rules) ? cfg.form_rules : [];
  const rule = rules.find((r) => r && r.id === b.form_rule_id);
  const rows = Number(b.rows) || 3;
  const cols = Number(b.cols) || 3;
  const sheetCount = Number(b.sheet_count) || 10;
  const hasScope = Boolean(b.region_scope || b.region_id);
  const org = b.organization === "family"
    ? "family"
    : hasScope
      ? "national"
      : b.organization === "by_region"
        ? "by_region"
        : "national";
  wizardDraft = {
    name: String(b.name || tBinderWizard("binder_wizard.default_name")),
    organization: org,
    formScope: inferFormScopeFromRule(rule),
    formatPreset: inferFormatPreset(rows, cols, sheetCount),
    rows,
    cols,
    sheetCount,
    editBinderId: String(b.id),
  };
}

function configUsesRegionalBinders(cfg) {
  const binders = Array.isArray(cfg?.binders) ? cfg.binders : [];
  return binders.some((b) => b && (b.region_scope || b.region_id));
}

function prefillWizardDraftForRebuild(cfg, binderIdOpt) {
  prefillWizardDraftFromConfig(cfg, binderIdOpt);
  wizardDraft.editBinderId = null;
  wizardDraft.name = tBinderWizard("binder_wizard.default_name");
  if (configUsesRegionalBinders(cfg)) {
    wizardDraft.organization = "by_region";
  }
}

/**
 * @returns {boolean} false si rien n’est sélectionné ou custom invalide
 */
function readFormatSelectionFromDom() {
  const sel = document.querySelector(".wizard-format-card.is-selected");
  if (!sel) return false;
  const key = sel.dataset.formatKey || "";
  wizardDraft.formatPreset = key;
  if (key === "3x3-10") {
    wizardDraft.rows = 3;
    wizardDraft.cols = 3;
    wizardDraft.sheetCount = 10;
    return true;
  }
  if (key === "2x2-10") {
    wizardDraft.rows = 2;
    wizardDraft.cols = 2;
    wizardDraft.sheetCount = 10;
    return true;
  }
  if (key === "custom") {
    const r = document.getElementById("wizardRows");
    const c = document.getElementById("wizardCols");
    const s = document.getElementById("wizardSheets");
    const rows = Math.min(12, Math.max(1, Number.parseInt(r?.value || "1", 10) || 1));
    const cols = Math.min(12, Math.max(1, Number.parseInt(c?.value || "1", 10) || 1));
    const sheets = Math.min(200, Math.max(1, Number.parseInt(s?.value || "1", 10) || 1));
    wizardDraft.rows = rows;
    wizardDraft.cols = cols;
    wizardDraft.sheetCount = sheets;
    return true;
  }
  return false;
}

function appendRecapLine(container, strongText, restText) {
  const line = document.createElement("div");
  line.className = "wizard-recap-line";
  const s = document.createElement("strong");
  s.textContent = strongText;
  const span = document.createElement("span");
  span.textContent = restText;
  line.append(s, span);
  container.append(line);
}

function nationalIntFromPokemon(p) {
  const s = String(p.number || "").replace(/^#/, "").replace(/^0+/, "") || "0";
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function inferRegionFromDefs(n, defs) {
  for (const r of defs) {
    if (r.low <= n && n <= r.high) return r.id;
  }
  return "unknown";
}

function effectiveRegionId(p, defs) {
  if (p.region) return p.region;
  return inferRegionFromDefs(nationalIntFromPokemon(p), defs);
}

function sortBinderNationalOrder(pokemon) {
  return [...pokemon].sort((a, b) => {
    const na = nationalIntFromPokemon(a);
    const nb = nationalIntFromPokemon(b);
    if (na !== nb) return na - nb;
    return String(a.slug || "").localeCompare(String(b.slug || ""));
  });
}

function setEvolutionFamilyData(data) {
  binderEvolutionFamilies = data && typeof data === "object" ? data : null;
}

async function ensureEvolutionFamiliesLoaded() {
  if (binderEvolutionFamilies) return binderEvolutionFamilies;
  try {
    const r = await fetch("/data/evolution-families.json");
    if (!r.ok) return null;
    const data = await r.json();
    setEvolutionFamilyData(data);
    return binderEvolutionFamilies;
  } catch {
    return null;
  }
}

function familyLayoutBlocks(pokemon, familyData, cols) {
  const bySlug = new Map();
  for (const p of pokemon) {
    const slug = String(p?.slug || "");
    if (slug) bySlug.set(slug, p);
  }
  const emitted = new Set();
  const columns = Math.max(1, Number(cols) || 3);
  const families = Array.isArray(familyData?.families) ? familyData.families : [];
  const blocks = [];

  for (const family of families) {
    const rows = Array.isArray(family?.layout_rows) ? family.layout_rows : [];
    const block = [];
    for (const rawRow of rows) {
      if (!Array.isArray(rawRow)) continue;
      const line = [];
      let hasPokemon = false;
      for (const slugRaw of rawRow) {
        if (!slugRaw) {
          line.push(null);
          continue;
        }
        const slug = String(slugRaw);
        const p = bySlug.get(slug);
        if (!p || emitted.has(slug)) {
          line.push(null);
          continue;
        }
        line.push(p);
        emitted.add(slug);
        hasPokemon = true;
      }
      if (!hasPokemon) continue;
      while (line.length % columns !== 0) line.push(null);
      block.push(...line);
    }
    if (block.length) blocks.push(block);
  }

  const leftovers = sortBinderNationalOrder(
    pokemon.filter((p) => p?.slug && !emitted.has(String(p.slug))),
  );
  for (const p of leftovers) {
    const block = [p];
    while (block.length % columns !== 0) block.push(null);
    blocks.push(block);
  }
  return blocks;
}

function sortBinderFamilyOrder(pokemon, binder, familyData = binderEvolutionFamilies) {
  if (!familyData || !Array.isArray(familyData.families)) {
    return sortBinderNationalOrder(pokemon);
  }
  return familyLayoutBlocks(pokemon, familyData, binder?.cols || 3).flat();
}

function applyBinderRange(sorted, binder) {
  const startRaw = Number(binder?.range_start);
  const limitRaw = Number(binder?.range_limit);
  const start = Number.isFinite(startRaw) && startRaw > 0 ? Math.floor(startRaw) : 0;
  const hasLimit = Number.isFinite(limitRaw) && limitRaw > 0;
  if (start === 0 && !hasLimit) return sorted;
  const limit = hasLimit ? Math.floor(limitRaw) : sorted.length;
  return sorted.slice(start, start + limit);
}

/**
 * Ordre d’affichage pour un classeur : national ou par région (meta.regions).
 * Si le classeur a `region_scope` / `region_id`, seuls les Pokémon de cette région d’affichage sont inclus
 * (cases et pages restantes vides dans la capacité du classeur).
 */
function orderPokemonForBinder(binder, pokemon, defs) {
  if (!binder) return sortBinderNationalOrder(pokemon);
  const scope = String(binder.region_scope || binder.region_id || "").trim();
  const pool = scope
    ? pokemon.filter((p) => effectiveRegionId(p, defs) === scope)
    : pokemon;
  const org =
    binder.organization === "by_region" || binder.organization === "family"
      ? binder.organization
      : "national";
  const sorted =
    org === "family"
      ? sortBinderFamilyOrder(pool, binder)
      : org === "by_region" && defs.length
        ? sortBinderRegionOrder(pool, defs)
        : sortBinderNationalOrder(pool);
  return applyBinderRange(sorted, binder);
}

/**
 * Ordre classeur « par région » : ordre des régions = meta.regions, puis natives
 * (n° dans la tranche) puis formes importées (ex. Rattata d'Alola en fin Alola).
 */
function sortBinderRegionOrder(pokemon, defs) {
  const orderIdx = Object.fromEntries(defs.map((r, i) => [r.id, i]));
  return [...pokemon].sort((a, b) => {
    const ra = effectiveRegionId(a, defs);
    const rb = effectiveRegionId(b, defs);
    const ia = orderIdx[ra] ?? 999;
    const ib = orderIdx[rb] ?? 999;
    if (ia !== ib) return ia - ib;
    const fa = a.region_native === false ? 1 : 0;
    const fb = b.region_native === false ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const na = nationalIntFromPokemon(a);
    const nb = nationalIntFromPokemon(b);
    if (na !== nb) return na - nb;
    return String(a.slug || "").localeCompare(String(b.slug || ""));
  });
}

function displayNumBinder(p) {
  const n = String(p.number || "").replace(/^#/, "");
  const stripped = n.replace(/^0+/, "") || "0";
  return `#${stripped}`;
}

function nameBinder(p) {
  const n = p.names || {};
  return n.fr || n.en || n.ja || p.slug || "?";
}

function setBinderRegionFilterEnabled(on) {
  const sel = document.getElementById("binderRegionFilter");
  if (!sel) return;
  sel.disabled = !on;
}

function fillBinderRegionFilterOptions(defs) {
  const sel = document.getElementById("binderRegionFilter");
  if (!sel) return;
  const keep = binderRegionFilterId;
  sel.replaceChildren();
  const o0 = document.createElement("option");
  o0.value = "all";
  o0.textContent = tBinderWizard("binder_wizard.filter.all_regions");
  sel.append(o0);
  for (const r of defs) {
    const o = document.createElement("option");
    o.value = r.id;
    o.textContent = `${r.label_fr} (${r.low}–${r.high})`;
    sel.append(o);
  }
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : "all";
  binderRegionFilterId = sel.value;
}

function renderBinderPreviewListContents() {
  const hintEl = document.getElementById("binderRegionPreviewHint");
  const listEl = document.getElementById("binderRegionPreviewList");
  if (!hintEl || !listEl) return;
  const defs = binderPreviewDefs;
  const sorted = binderPreviewSortedFull;
  const filtered =
    binderRegionFilterId === "all"
      ? sorted
      : sorted.filter((p) => effectiveRegionId(p, defs) === binderRegionFilterId);
  const shown = Math.min(filtered.length, 100);
  hintEl.textContent = tBinderWizard("binder_wizard.preview.hint", {
    filter: binderRegionFilterId === "all" ? tBinderWizard("binder_wizard.preview.filter_all") : binderRegionFilterId,
    shown,
    filtered: filtered.length,
    total: sorted.length,
  });
  listEl.replaceChildren();
  let i = 0;
  for (const p of filtered) {
    if (i++ >= 100) break;
    const li = document.createElement("li");
    const foreign = p.region_native === false;
    const reg = p.region_label_fr || p.region || "?";
    li.textContent = `${displayNumBinder(p)} ${nameBinder(p)} — ${reg}${foreign ? ` (${tBinderWizard("binder_wizard.preview.regional_form")})` : ""}`;
    listEl.append(li);
  }
}

function wireBinderRegionFilterOnce() {
  const sel = document.getElementById("binderRegionFilter");
  if (!sel || sel.dataset.wired) return;
  sel.dataset.wired = "1";
  sel.addEventListener("change", () => {
    binderRegionFilterId = sel.value || "all";
    renderBinderPreviewListContents();
  });
}

async function updateRegionPreview(cfg) {
  const wrap = document.getElementById("binderRegionPreviewWrap");
  const listEl = document.getElementById("binderRegionPreviewList");
  if (!wrap || !listEl) return;
  const binders = Array.isArray(cfg.binders) ? cfg.binders : [];
  const binder =
    binders.find((b) => b && b.organization === "by_region") ||
    binders.find((b) => b && (b.region_scope || b.region_id)) ||
    binders[0];
  binderPreviewSortedFull = [];
  binderPreviewDefs = [];
  const scopeId = String(binder?.region_scope || binder?.region_id || "").trim();
  const scoped = Boolean(scopeId);
  const showPreview = binder && (binder.organization === "by_region" || scoped);
  if (!showPreview) {
    wrap.hidden = true;
    setBinderRegionFilterEnabled(false);
    const sel = document.getElementById("binderRegionFilter");
    if (sel) {
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "all";
      o.textContent = tBinderWizard("binder_wizard.filter.all");
      sel.append(o);
    }
    return;
  }
  wrap.hidden = false;
  try {
    const r = await fetch("/data/pokedex.json");
    if (!r.ok) {
      wrap.hidden = true;
      setBinderRegionFilterEnabled(false);
      return;
    }
    const dex = await r.json();
    const monsRaw = Array.isArray(dex) ? dex : dex.pokemon || [];
    const rule = getFormRuleForBinder(cfg, binder);
    const mons = selectBinderPokemonPool(monsRaw, rule);
    const defs = Array.isArray(dex.meta?.regions) ? dex.meta.regions : [];
    const sorted = orderPokemonForBinder(binder, mons, defs);
    binderPreviewSortedFull = sorted;
    binderPreviewDefs = defs;
    if (scoped) {
      binderRegionFilterId = scopeId;
    }
    fillBinderRegionFilterOptions(defs);
    setBinderRegionFilterEnabled(!scoped);
    const sel = document.getElementById("binderRegionFilter");
    if (sel && scoped) {
      sel.value = [...sel.options].some((o) => o.value === scopeId) ? scopeId : "all";
      binderRegionFilterId = sel.value;
    }
    renderBinderPreviewListContents();
  } catch {
    wrap.hidden = true;
    setBinderRegionFilterEnabled(false);
  }
}

function syncCustomPanelVisibility(body) {
  const panel = body.querySelector(".wizard-custom-panel");
  if (!panel) return;
  panel.hidden = wizardDraft.formatPreset !== "custom";
}

function renderWizardStep() {
  const body = document.getElementById("binderWizardBody");
  if (!body) return;
  clearEl(body);

  if (wizardStep === 0) {
    const lead = document.createElement("p");
    lead.className = "wizard-lead";
    lead.textContent = tBinderWizard("binder_wizard.org.lead");
    body.append(lead);

    const grid = document.createElement("div");
    grid.className = "wizard-choice-grid wizard-choice-grid--3";

    const mkOrg = (org, title, desc) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wizard-choice wizard-org-card";
      btn.dataset.org = org;
      if (wizardDraft.organization === org) btn.classList.add("is-selected");
      const h = document.createElement("h3");
      h.className = "wizard-choice-title";
      h.textContent = title;
      const p = document.createElement("p");
      p.className = "wizard-choice-desc";
      p.textContent = desc;
      btn.append(h, p);
      btn.addEventListener("click", () => {
        grid.querySelectorAll(".wizard-org-card").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        wizardDraft.organization = org;
      });
      return btn;
    };

    grid.append(
      mkOrg(
        "national",
        tBinderWizard("binder_wizard.org.national.title"),
        tBinderWizard("binder_wizard.org.national.desc"),
      ),
      mkOrg(
        "by_region",
        tBinderWizard("binder_wizard.org.by_region.title"),
        tBinderWizard("binder_wizard.org.by_region.desc"),
      ),
      mkOrg(
        "family",
        tBinderWizard("binder_wizard.org.family.title"),
        tBinderWizard("binder_wizard.org.family.desc"),
      ),
    );
    body.append(grid);
  }

  if (wizardStep === 1) {
    const lead = document.createElement("p");
    lead.className = "wizard-lead";
    lead.textContent = tBinderWizard("binder_wizard.form.lead");
    body.append(lead);

    const grid = document.createElement("div");
    grid.className = "wizard-choice-grid wizard-choice-grid--3";

    const mkForm = (scope, title, desc) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wizard-choice wizard-form-card";
      btn.dataset.formScope = scope;
      if (wizardDraft.formScope === scope) btn.classList.add("is-selected");
      const h = document.createElement("h3");
      h.className = "wizard-choice-title";
      h.textContent = title;
      const p = document.createElement("p");
      p.className = "wizard-choice-desc";
      p.textContent = desc;
      btn.append(h, p);
      btn.addEventListener("click", () => {
        grid.querySelectorAll(".wizard-form-card").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        wizardDraft.formScope = scope;
      });
      return btn;
    };

    grid.append(
      mkForm(
        "base_only",
        tBinderWizard("binder_wizard.form.base_only.choice_title"),
        tBinderWizard("binder_wizard.form.base_only.desc"),
      ),
      mkForm(
        "base_regional",
        tBinderWizard("binder_wizard.form.base_regional.choice_title"),
        tBinderWizard("binder_wizard.form.base_regional.desc"),
      ),
      mkForm(
        "full",
        tBinderWizard("binder_wizard.form.full.choice_title"),
        tBinderWizard("binder_wizard.form.full.desc"),
      ),
    );
    body.append(grid);
  }

  if (wizardStep === 2) {
    const lead = document.createElement("p");
    lead.className = "wizard-lead";
    lead.textContent = tBinderWizard("binder_wizard.format.lead");
    body.append(lead);

    const fmtGrid = document.createElement("div");
    fmtGrid.className = "wizard-choice-grid wizard-choice-grid--3";

    const mkFmt = (key, title, desc) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wizard-choice wizard-format-card";
      btn.dataset.formatKey = key;
      if (wizardDraft.formatPreset === key) btn.classList.add("is-selected");
      const h = document.createElement("h3");
      h.className = "wizard-choice-title";
      h.textContent = title;
      const p = document.createElement("p");
      p.className = "wizard-choice-desc";
      p.textContent = desc;
      btn.append(h, p);
      btn.addEventListener("click", () => {
        fmtGrid.querySelectorAll(".wizard-format-card").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        wizardDraft.formatPreset = key;
        if (key === "3x3-10") {
          wizardDraft.rows = 3;
          wizardDraft.cols = 3;
          wizardDraft.sheetCount = 10;
        } else if (key === "2x2-10") {
          wizardDraft.rows = 2;
          wizardDraft.cols = 2;
          wizardDraft.sheetCount = 10;
        }
        syncCustomPanelVisibility(body);
      });
      return btn;
    };

    fmtGrid.append(
      mkFmt("3x3-10", tBinderWizard("binder_wizard.format.3x3.title"), tBinderWizard("binder_wizard.format.3x3.desc")),
      mkFmt("2x2-10", tBinderWizard("binder_wizard.format.2x2.title"), tBinderWizard("binder_wizard.format.2x2.desc")),
      mkFmt("custom", tBinderWizard("binder_wizard.format.custom.title"), tBinderWizard("binder_wizard.format.custom.desc")),
    );
    body.append(fmtGrid);

    const panel = document.createElement("div");
    panel.className = "wizard-custom-panel";
    panel.hidden = wizardDraft.formatPreset !== "custom";

    const rowcols = document.createElement("div");
    rowcols.className = "wizard-custom-fields";

    const mkNumField = (id, label, min, max, val) => {
      const wrap = document.createElement("div");
      wrap.className = "binder-wizard-field";
      const lab = document.createElement("label");
      lab.htmlFor = id;
      lab.textContent = label;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.id = id;
      inp.min = String(min);
      inp.max = String(max);
      inp.value = String(val);
      wrap.append(lab, inp);
      return wrap;
    };

    rowcols.append(
      mkNumField("wizardRows", tBinderWizard("binder_wizard.format.rows"), 1, 12, wizardDraft.rows),
      mkNumField("wizardCols", tBinderWizard("binder_wizard.format.cols"), 1, 12, wizardDraft.cols),
      mkNumField("wizardSheets", tBinderWizard("binder_wizard.format.sheets"), 1, 200, wizardDraft.sheetCount),
    );
    const hint = document.createElement("p");
    hint.className = "wizard-custom-hint";
    hint.textContent = tBinderWizard("binder_wizard.format.hint");
    panel.append(rowcols, hint);
    body.append(panel);
    syncCustomPanelVisibility(body);
  }

  if (wizardStep === 3) {
    const slots = wizardDraft.rows * wizardDraft.cols;
    const pages = 2 * wizardDraft.sheetCount;
    const totalSlots = slots * pages;
    const orgLabel =
      wizardDraft.organization === "family"
        ? tBinderWizard("binder_wizard.summary.org_family")
        : wizardDraft.organization === "by_region"
        ? tBinderWizard("binder_wizard.summary.org_region")
        : tBinderWizard("binder_wizard.summary.org_national");
    const presetLabel =
      wizardDraft.formatPreset === "3x3-10"
        ? tBinderWizard("binder_wizard.summary.preset_3x3")
        : wizardDraft.formatPreset === "2x2-10"
          ? tBinderWizard("binder_wizard.summary.preset_2x2")
          : tBinderWizard("binder_wizard.summary.preset_custom");
    const scopeLabel =
      wizardDraft.formScope === "base_only"
        ? tBinderWizard("binder_wizard.summary.scope_base")
        : wizardDraft.formScope === "full"
          ? tBinderWizard("binder_wizard.summary.scope_full")
          : tBinderWizard("binder_wizard.summary.scope_regional");

    const div = document.createElement("div");
    div.className = "wizard-recap";
    appendRecapLine(div, tBinderWizard("binder_wizard.summary.org"), orgLabel);
    appendRecapLine(div, tBinderWizard("binder_wizard.summary.forms"), scopeLabel);
    appendRecapLine(div, tBinderWizard("binder_wizard.summary.format"), presetLabel);
    appendRecapLine(
      div,
      tBinderWizard("binder_wizard.summary.grid"),
      tBinderWizard("binder_wizard.summary.grid_value", {
        rows: wizardDraft.rows,
        cols: wizardDraft.cols,
        slots,
      }),
    );
    appendRecapLine(
      div,
      tBinderWizard("binder_wizard.summary.capacity"),
      tBinderWizard("binder_wizard.summary.capacity_value", {
        sheets: wizardDraft.sheetCount,
        pages,
        slots: totalSlots,
      }),
    );
    const nameRecap =
      wizardDraft.organization === "family" && !wizardDraft.editBinderId
        ? tBinderWizard("binder_wizard.summary.family_name")
        : wizardDraft.organization === "by_region" && !wizardDraft.editBinderId
        ? tBinderWizard("binder_wizard.summary.region_name")
        : tBinderWizard("binder_wizard.summary.default_name", { name: wizardDraft.name });
    appendRecapLine(div, tBinderWizard("binder_wizard.summary.name"), nameRecap);
    const note = document.createElement("p");
    note.className = "wizard-recap-note";
    note.textContent = wizardDraft.editBinderId
      ? tBinderWizard("binder_wizard.summary.edit_note")
      : tBinderWizard("binder_wizard.summary.new_note");
    div.append(note);
    body.append(div);
  }

  syncWizardChrome();
  syncWizardBinderBar();
}

async function fetchPokedexBinderData() {
  try {
    const r = await fetch("/data/pokedex.json");
    if (!r.ok) return { defs: [], pokemon: [] };
    const dex = await r.json();
    return {
      defs: Array.isArray(dex.meta?.regions) ? dex.meta.regions : [],
      pokemon: Array.isArray(dex) ? dex : dex.pokemon || [],
    };
  } catch {
    return { defs: [], pokemon: [] };
  }
}

/**
 * Un classeur unique (vue nationale ou une seule album « par région » globale).
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number }} draft
 */
function buildPersistNewPayloads(draft) {
  const binderId = `classeur-${Date.now().toString(36)}`;
  const scope = normalizeFormScope(draft.formScope);
  const layout = normalizedBinderLayout(draft);
  const formRule = formRuleFromScope(scope);
  const org =
    draft.organization === "by_region" || draft.organization === "family"
      ? draft.organization
      : "national";
  const configBody = {
    version: 1,
    convention: "sheet_recto_verso",
    binders: [
      {
        id: binderId,
        name: draft.name,
        cols: layout.cols,
        rows: layout.rows,
        sheet_count: layout.sheetCount,
        form_rule_id: formRule.id,
        organization: org,
      },
    ],
    form_rules: [formRule],
  };
  const placementsBody = {
    version: 1,
    by_binder: {
      [binderId]: {},
    },
  };
  return { configBody, placementsBody };
}

/**
 * Classeurs régionaux découpés selon la capacité physique choisie.
 * Si une région dépasse rows × cols × feuillets × 2, elle devient Kanto 1, Kanto 2, etc.
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number }} draft
 * @param {{ id: string; label_fr?: string; low?: number; high?: number }[]} defs
 * @param {Record<string, unknown>[]} pokemon
 * @param {string} [seed]
 */
function buildRegionalBinderWorkspace(draft, defs, pokemon, seed = Date.now().toString(36)) {
  const scope = normalizeFormScope(draft.formScope);
  const formRule = formRuleFromScope(scope);
  const layout = normalizedBinderLayout(draft);
  const capacity = binderCapacity(layout);
  const binders = [];
  const byBinder = {};
  const selectedPokemon = selectBinderPokemonPool(Array.isArray(pokemon) ? pokemon : [], formRule);

  for (const reg of Array.isArray(defs) ? defs : []) {
    if (!reg || !reg.id) continue;
    const regionId = String(reg.id);
    const label = String(reg.label_fr || reg.id);
    const regionPokemon = orderPokemonForBinder(
      { organization: "national", region_scope: regionId },
      selectedPokemon,
      defs,
    );
    const chunkCount = Math.max(1, Math.ceil(regionPokemon.length / capacity));
    for (let i = 0; i < chunkCount; i++) {
      const idSuffix = chunkCount > 1 ? `${safeBinderIdPart(regionId)}-${i + 1}` : safeBinderIdPart(regionId);
      const id = `classeur-${seed}-${idSuffix}`;
      binders.push({
        id,
        name: chunkCount > 1 ? `${label} ${i + 1}` : label,
        cols: layout.cols,
        rows: layout.rows,
        sheet_count: layout.sheetCount,
        form_rule_id: formRule.id,
        organization: "national",
        region_scope: regionId,
        range_start: i * capacity,
        range_limit: capacity,
      });
      byBinder[id] = {};
    }
  }

  return {
    configBody: {
      version: 1,
      convention: "sheet_recto_verso",
      binders,
      form_rules: [formRule],
    },
    placementsBody: {
      version: 1,
      by_binder: byBinder,
    },
  };
}

function buildFamilyBinderWorkspace(draft, pokemon, familyData, seed = Date.now().toString(36)) {
  const scope = normalizeFormScope(draft.formScope);
  const formRule = formRuleFromScope(scope);
  const layout = normalizedBinderLayout(draft);
  const capacity = binderCapacity(layout);
  const selectedPokemon = selectBinderPokemonPool(Array.isArray(pokemon) ? pokemon : [], formRule);
  const blocks = familyLayoutBlocks(selectedPokemon, familyData, layout.cols);
  const binders = [];
  const byBinder = {};
  let currentStart = 0;
  let currentLength = 0;

  const closeChunk = () => {
    if (currentLength <= 0) return;
    const idx = binders.length + 1;
    const id = `classeur-${seed}-familles-${idx}`;
    binders.push({
      id,
      name: `Familles ${idx}`,
      cols: layout.cols,
      rows: layout.rows,
      sheet_count: layout.sheetCount,
      form_rule_id: formRule.id,
      organization: "family",
      range_start: currentStart,
      range_limit: currentLength,
    });
    byBinder[id] = {};
    currentStart += currentLength;
    currentLength = 0;
  };

  for (const block of blocks) {
    const blockLength = Array.isArray(block) ? block.length : 0;
    if (!blockLength) continue;
    if (blockLength > capacity) {
      if (currentLength > 0) closeChunk();
      let remaining = blockLength;
      while (remaining > 0) {
        const chunkLength = Math.min(capacity, remaining);
        currentLength = chunkLength;
        closeChunk();
        remaining -= chunkLength;
      }
      continue;
    }
    if (currentLength > 0 && currentLength + blockLength > capacity) {
      closeChunk();
    }
    currentLength += blockLength;
  }
  closeChunk();

  if (binders.length === 1) binders[0].name = "Familles";

  return {
    configBody: {
      version: 1,
      convention: "sheet_recto_verso",
      binders,
      form_rules: [formRule],
    },
    placementsBody: {
      version: 1,
      by_binder: byBinder,
    },
  };
}

/**
 * Un classeur par entrée de meta.regions (même grille / feuillets), chacun filtré sur sa région.
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number }} draft
 */
async function buildPersistNewPayloadsMultiRegion(draft) {
  const { defs, pokemon } = await fetchPokedexBinderData();
  if (!defs.length) {
    return buildPersistNewPayloads(draft);
  }

  const workspace = buildRegionalBinderWorkspace(draft, defs, pokemon);
  if (!workspace.configBody.binders.length) {
    return buildPersistNewPayloads(draft);
  }
  return workspace;
}

/**
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number }} draft
 */
async function buildPersistNewPayloadsFromDraft(draft) {
  if (draft.organization === "by_region") {
    return buildPersistNewPayloadsMultiRegion(draft);
  }
  if (draft.organization === "family") {
    const { pokemon } = await fetchPokedexBinderData();
    const familyData = await ensureEvolutionFamiliesLoaded();
    const workspace = buildFamilyBinderWorkspace(draft, pokemon, familyData);
    if (workspace.configBody.binders.length) return workspace;
  }
  return buildPersistNewPayloads(draft);
}

/**
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number; editBinderId: string }} draft
 * @param {object} cfg
 * @param {object} placementsPayload
 */
function buildPersistEditPayloads(draft, cfg, placementsPayload) {
  const binderId = draft.editBinderId;
  const scope = normalizeFormScope(draft.formScope);
  const layout = normalizedBinderLayout(draft);
  const formRule = formRuleFromScope(scope);
  const org =
    draft.organization === "by_region" || draft.organization === "family"
      ? draft.organization
      : "national";
  const oldBinder = (cfg.binders || []).find((x) => x && x.id === binderId);
  const oldRuleId = oldBinder && oldBinder.form_rule_id;
  const dropIds = new Set([formRule.id]);
  if (oldRuleId && oldRuleId !== formRule.id) dropIds.add(oldRuleId);
  const form_rules = (cfg.form_rules || []).filter((r) => r && !dropIds.has(r.id));
  form_rules.push(formRule);
  const binders = (cfg.binders || []).map((b) => {
    if (!b || b.id !== binderId) return b;
    return {
      ...b,
      name: draft.name,
      cols: layout.cols,
      rows: layout.rows,
      sheet_count: layout.sheetCount,
      organization: org,
      form_rule_id: formRule.id,
    };
  });
  const configBody = {
    version: cfg.version ?? 1,
    convention: cfg.convention || "sheet_recto_verso",
    binders,
    form_rules,
  };
  const placementsBody = JSON.parse(JSON.stringify(placementsPayload || { version: 1, by_binder: {} }));
  return { configBody, placementsBody };
}

/**
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number }} draft
 * @param {{ silent?: boolean }} [opts]
 */
async function persistWizardDraft(draft, opts = {}) {
  const silent = Boolean(opts.silent);
  const hint = document.getElementById("binderV2Hint");
  if (!silent) setBinderHint(hint, "", true);
  let configBody;
  let placementsBody;
  if (draft.editBinderId && lastConfigJson && lastPlacementsPayload) {
    const merged = buildPersistEditPayloads(draft, lastConfigJson, lastPlacementsPayload);
    configBody = merged.configBody;
    placementsBody = merged.placementsBody;
  } else {
    const merged = await buildPersistNewPayloadsFromDraft(draft);
    configBody = merged.configBody;
    placementsBody = merged.placementsBody;
  }

  const cfgRes = await fetch(API_BINDER_CONFIG, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configBody),
  });
  if (!cfgRes.ok) {
    if (!silent) setBinderHint(hint, tBinderWizard("binder_wizard.error.config", { status: cfgRes.status }), false);
    return false;
  }
  const plRes = await fetch(API_BINDER_PLACEMENTS, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(placementsBody),
  });
  if (!plRes.ok) {
    if (!silent) setBinderHint(hint, tBinderWizard("binder_wizard.error.placements", { status: plRes.status }), false);
    return false;
  }
  await setWizardSkipped(false);
  return true;
}

async function persistWizardConfig() {
  return persistWizardDraft(wizardDraft, {});
}

function validateWizardOrgStep() {
  const v = readOrgSelectionFromDom();
  const hint = document.getElementById("binderV2Hint");
  if (!v) {
    setBinderHint(hint, tBinderWizard("binder_wizard.error.choose_org"), false);
    return false;
  }
  wizardDraft.organization = v;
  setBinderHint(hint, "", true);
  return true;
}

function validateWizardFormatStep() {
  const hint = document.getElementById("binderV2Hint");
  if (!readFormatSelectionFromDom()) {
    setBinderHint(hint, tBinderWizard("binder_wizard.error.choose_format"), false);
    return false;
  }
  setBinderHint(hint, "", true);
  return true;
}

function validateWizardFormStep() {
  const v = readFormScopeFromDom();
  const hint = document.getElementById("binderV2Hint");
  if (!v) {
    setBinderHint(hint, tBinderWizard("binder_wizard.error.choose_forms"), false);
    return false;
  }
  wizardDraft.formScope = v;
  setBinderHint(hint, "", true);
  return true;
}

async function onWizardNext() {
  if (wizardStep === 0 && !validateWizardOrgStep()) return;
  if (wizardStep === 1 && !validateWizardFormStep()) return;
  if (wizardStep === 2 && !validateWizardFormatStep()) return;

  if (wizardStep < wizardLastStep) {
    wizardStep += 1;
    renderWizardStep();
    return;
  }

  const nextBtn = document.getElementById("binderWizardNext");
  if (nextBtn) nextBtn.disabled = true;
  try {
    const ok = await persistWizardConfig();
    if (ok) await refreshBinderV2();
  } finally {
    if (nextBtn) nextBtn.disabled = false;
  }
}

function onWizardBack() {
  if (wizardStep === 0) return;
  if (wizardStep === 3) readFormatSelectionFromDom();
  if (wizardStep === 2) readFormatSelectionFromDom();
  if (wizardStep === 1) {
    const v = readFormScopeFromDom();
    if (v) wizardDraft.formScope = v;
  }
  wizardStep -= 1;
  renderWizardStep();
}

/**
 * @param {{ edit?: boolean; binderId?: string | null }} [options]
 */
function openWizard(options) {
  const opt = options || {};
  wizardStep = 0;
  if (opt.edit && lastConfigJson && !isBinderConfigEmpty(lastConfigJson)) {
    const fromDom = document.getElementById("binderIdSelect")?.value;
    const chosen = opt.binderId || fromDom || null;
    prefillWizardDraftFromConfig(lastConfigJson, chosen);
  } else {
    wizardDraft = {
      name: tBinderWizard("binder_wizard.default_name"),
      organization: "national",
      formScope: DEFAULT_FORM_SCOPE,
      formatPreset: "3x3-10",
      rows: 3,
      cols: 3,
      sheetCount: 10,
      editBinderId: null,
    };
  }
  void setWizardSkipped(false);
  renderWizardStep();
  toggleBinderViews(true);
}

function onWizardSkip() {
  void setWizardSkipped(true);
  toggleBinderViews(false);
}

async function refreshBinderV2() {
  const hint = document.getElementById("binderV2Hint");
  const preConfig = document.getElementById("binderConfigPreview");
  const prePlacements = document.getElementById("binderPlacementsPreview");
  const shell = document.getElementById("binderCollectionShell");
  const emptyPh = document.getElementById("binderEmptyPlaceholder");
  const presetWrap = document.getElementById("binderRegionPresetWrap");
  if (!preConfig || !prePlacements) return;

  setBinderHint(hint, "", true);
  await refreshTrackerUiCache();

  try {
    let ws = await fetchBinderWorkspaceMerged();
    let cfg = ws.config;
    let pl = ws.placements;
    if (shouldEnsureDefaultWorkspace(cfg)) {
      const ok = await ensureRegionDefaultWorkspace();
      if (ok) {
        ws = await fetchBinderWorkspaceMerged();
        cfg = ws.config;
        pl = ws.placements;
      }
    }
    setConfigCache(cfg);
    lastPlacementsPayload = pl;
    trackerUiCache.file_exists = !isBinderConfigEmpty(cfg);
    if (Array.isArray(cfg.binders) && cfg.binders.some((b) => b?.organization === "family")) {
      await ensureEvolutionFamiliesLoaded();
    }
    preConfig.textContent = JSON.stringify(cfg, null, 2);
    prePlacements.textContent = JSON.stringify(pl, null, 2);
    toggleBinderViews(false);
    if (shell) shell.hidden = false;
    if (emptyPh) emptyPh.hidden = true;
    if (presetWrap) presetWrap.hidden = true;
    window.PokedexBinderShell?.syncFromConfig?.(cfg);
    await updateRegionPreview(cfg);
  } catch {
    setBinderHint(
      hint,
      tBinderWizard("binder_wizard.error.api"),
      false,
    );
  }
}

function wireWizardOnce() {
  const next = document.getElementById("binderWizardNext");
  const back = document.getElementById("binderWizardBack");
  const skip = document.getElementById("binderWizardSkip");
  const reopen = document.getElementById("binderWizardReopen");
  if (next && !next.dataset.wired) {
    next.dataset.wired = "1";
    next.addEventListener("click", () => onWizardNext());
  }
  if (back && !back.dataset.wired) {
    back.dataset.wired = "1";
    back.addEventListener("click", () => onWizardBack());
  }
  if (skip && !skip.dataset.wired) {
    skip.dataset.wired = "1";
    skip.addEventListener("click", () => onWizardSkip());
  }
  if (reopen && !reopen.dataset.wired) {
    reopen.dataset.wired = "1";
    reopen.addEventListener("click", () => openWizard());
  }
  const settings = document.getElementById("binderWizardSettings");
  if (settings && !settings.dataset.wired) {
    settings.dataset.wired = "1";
    settings.addEventListener("click", () => {
      const id = document.getElementById("binderIdSelect")?.value || null;
      if (lastConfigJson && !isBinderConfigEmpty(lastConfigJson)) {
        wizardStep = 0;
        prefillWizardDraftForRebuild(lastConfigJson, id || undefined);
        void setWizardSkipped(false);
        renderWizardStep();
        toggleBinderViews(true);
        return;
      }
      openWizard();
    });
  }
}

/**
 * Appelé à l’affichage de la vue classeurs (hash #/classeur).
 */
function startBinderV2IfNeeded() {
  void (async () => {
    if (window.PokedexCollection?.ensureLoaded) {
      try {
        await window.PokedexCollection.ensureLoaded();
      } catch {
        /* la grille utilisera une liste vide si le Pokédex n’est pas dispo */
      }
    }
    if (binderV2Started) {
      await refreshBinderV2();
      return;
    }
    binderV2Started = true;
    wireWizardOnce();
    wireBinderRegionFilterOnce();
    const btn = document.getElementById("binderV2Refresh");
    if (btn) btn.addEventListener("click", () => void refreshBinderV2());
    if (!binderV2LocaleSubbed) {
      binderV2LocaleSubbed = true;
      window.PokevaultI18n?.subscribeLocale?.(() => {
        renderWizardStep();
        void refreshBinderV2();
      });
    }
    window.PokedexBinderShell?.init?.();
    await refreshBinderV2();
  })();
}

window.startBinderV2IfNeeded = startBinderV2IfNeeded;

window.PokedexBinder = {
  persistWizardDraft: (draft = wizardDraft, opts) => persistWizardDraft(draft, opts),
  refreshBinderV2,
  isBinderConfigEmpty,
  shouldEnsureDefaultWorkspace,
  setWizardSkipped,
  setConfigCache,
  DEFAULT_FORM_SCOPE,
  orderPokemonForBinder,
  ensureEvolutionFamiliesLoaded,
  setEvolutionFamilyData,
  formRuleFromScope,
  pokemonMatchesFormRule,
  pokemonMatchesBinderRule,
  selectBinderPokemonPool,
  getFormRuleForBinder,
  getEffectiveFormRuleForCollection,
  get cachedConfig() {
    return lastConfigJson;
  },
  _test: {
    binderCapacity,
    buildFamilyBinderWorkspace,
    buildRegionalBinderWorkspace,
    orderPokemonForBinder,
    setEvolutionFamilyData,
    shouldEnsureDefaultWorkspace,
    formRuleFromScope,
  },
};
