/**
 * Classeurs v2 — aperçu API + assistant si aucun classeur en config.
 * Option « par région » : aperçu d’ordre (natives puis formes importées en fin de section).
 */

const API_BINDER_ROOT = "/api/binder";
const API_BINDER_CONFIG = "/api/binder/config";
const API_BINDER_PLACEMENTS = "/api/binder/placements";

const LS_WIZARD_DISMISSED = "pokedexBinderWizardDismissed";

let binderV2Started = false;
let wizardStep = 0;
const wizardLastStep = 3;

const WIZARD_STEP_LABELS = [
  "Organisation",
  "Formes à suivre",
  "Format du classeur",
  "Récapitulatif",
];

/** @type {"base_only" | "base_regional" | "full"} */
const DEFAULT_FORM_SCOPE = "base_only";

/** @type {{ name: string; organization: string; formScope: string; formatPreset: string; rows: number; cols: number; sheetCount: number; editBinderId: string | null }} */
let wizardDraft = {
  name: "Principal",
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

function setBinderHint(el, text, hidden) {
  if (!el) return;
  el.textContent = text;
  el.hidden = hidden;
}

function isBinderConfigEmpty(cfg) {
  return !cfg || !Array.isArray(cfg.binders) || cfg.binders.length === 0;
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
  const defs = await fetchPokedexRegionDefs();
  if (!defs.length) return false;
  const t = Date.now().toString(36);
  const formRule = formRuleFromScope("base_regional");
  const binders = [];
  const byBinder = {};
  for (const reg of defs) {
    if (!reg?.id) continue;
    const id = `classeur-${t}-${String(reg.id).replace(/[^a-z0-9_-]/gi, "-")}`;
    binders.push({
      id,
      name: String(reg.label_fr || reg.id),
      cols: 3,
      rows: 3,
      sheet_count: 10,
      form_rule_id: formRule.id,
      organization: "national",
      region_scope: String(reg.id),
    });
    byBinder[id] = {};
  }
  if (!binders.length) return false;
  const configBody = {
    version: 1,
    convention: "sheet_recto_verso",
    binders,
    form_rules: [formRule],
  };
  const placementsBody = { version: 1, by_binder: byBinder };
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

function isStrictRegionDefaultConfig(cfg) {
  const binders = Array.isArray(cfg?.binders) ? cfg.binders : [];
  if (!binders.length) return false;
  return binders.every(
    (b) =>
      b &&
      b.region_scope &&
      Number(b.rows) === 3 &&
      Number(b.cols) === 3 &&
      Number(b.sheet_count) === 10,
  );
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
    meta.textContent = `${WIZARD_STEP_LABELS[wizardStep]} — ${wizardStep + 1} / ${wizardLastStep + 1}`;
  }
  if (back) back.disabled = wizardStep === 0;
  if (next) next.textContent = wizardStep === wizardLastStep ? "Enregistrer" : "Continuer";
}

function clearEl(el) {
  if (el) el.replaceChildren();
}

function readOrgSelectionFromDom() {
  const sel = document.querySelector(".wizard-org-card.is-selected");
  if (!sel) return null;
  return sel.dataset.org === "by_region" ? "by_region" : "national";
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
    base_only: "Base principale seule",
    base_regional: "Base + formes régionales (sans Méga / Gigamax)",
    full: "Complet — Méga, Gigamax, formes nommées",
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
  lab.textContent = "Classeur à régler (liste défilante)";
  const sel = document.createElement("select");
  sel.className = "binder-wizard-binder-select";
  sel.setAttribute("aria-label", "Choisir le classeur à modifier");
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
  wizardDraft = {
    name: String(b.name || "Principal"),
    organization: hasScope ? "national" : b.organization === "by_region" ? "by_region" : "national",
    formScope: inferFormScopeFromRule(rule),
    formatPreset: inferFormatPreset(rows, cols, sheetCount),
    rows,
    cols,
    sheetCount,
    editBinderId: String(b.id),
  };
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
  const org = binder.organization === "by_region" ? "by_region" : "national";
  if (org === "by_region" && defs.length) return sortBinderRegionOrder(pool, defs);
  return sortBinderNationalOrder(pool);
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
  o0.textContent = "Toutes les régions";
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
  hintEl.textContent =
    "Tri : régions (ordre national), natives puis formes importées en fin de bloc. " +
    `Filtre : ${binderRegionFilterId === "all" ? "toutes" : binderRegionFilterId} — ${shown} / ${filtered.length} entrées affichées (${sorted.length} au total).`;
  listEl.replaceChildren();
  let i = 0;
  for (const p of filtered) {
    if (i++ >= 100) break;
    const li = document.createElement("li");
    const foreign = p.region_native === false;
    const reg = p.region_label_fr || p.region || "?";
    li.textContent = `${displayNumBinder(p)} ${nameBinder(p)} — ${reg}${foreign ? " (forme régionale)" : ""}`;
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
      o.textContent = "Toutes";
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
    lead.textContent =
      "Choisis comment les entrées seront ordonnées dans le classeur. Tu pourras ajuster la grille juste après.";
    body.append(lead);

    const grid = document.createElement("div");
    grid.className = "wizard-choice-grid wizard-choice-grid--2";

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
        "Tous à la suite",
        "Ordre national du Pokédex, du premier au dernier numéro.",
      ),
      mkOrg(
        "by_region",
        "Par région",
        "Blocs par région : espèces natives d’abord, puis formes « importées » en fin de section.",
      ),
    );
    body.append(grid);
  }

  if (wizardStep === 1) {
    const lead = document.createElement("p");
    lead.className = "wizard-lead";
    lead.textContent =
      "Les séries de cartes ne couvrent pas tout (Méga, Gigamax, Pikachu déguisé…). Choisis un périmètre réaliste pour ton suivi ; tu pourras l’éditer dans le JSON plus tard.";
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
        "Base seule",
        "Une entrée par forme « principale » du Pokédex, sans variantes régionales.",
      ),
      mkForm(
        "base_regional",
        "Base + régionales",
        "Inclut Alola, Galar, Hisui, etc. — sans Méga, sans Gigamax, sans formes annexes type costumes.",
      ),
      mkForm(
        "full",
        "Complet",
        "Méga, Gigamax et autres formes nommées : plus de lignes, beaucoup de cartes n’existent pas pour tout le monde.",
      ),
    );
    body.append(grid);
  }

  if (wizardStep === 2) {
    const lead = document.createElement("p");
    lead.className = "wizard-lead";
    lead.textContent =
      "Même nombre de pochettes sur chaque face (recto / verso). Presets 3×3 ou 2×2 avec 10 feuillets, ou grille personnalisée.";
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
      mkFmt("3x3-10", "3 × 3", "9 cases par page · 10 feuillets (recto + verso)."),
      mkFmt("2x2-10", "2 × 2", "4 cases par page · 10 feuillets."),
      mkFmt("custom", "Personnalisé", "Lignes, colonnes (1–12) et feuillets (1–200) au choix."),
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
      mkNumField("wizardRows", "Lignes par page", 1, 12, wizardDraft.rows),
      mkNumField("wizardCols", "Colonnes par page", 1, 12, wizardDraft.cols),
      mkNumField("wizardSheets", "Nombre de feuillets", 1, 200, wizardDraft.sheetCount),
    );
    const hint = document.createElement("p");
    hint.className = "wizard-custom-hint";
    hint.textContent =
      "Un feuillet = une feuille plastique recto-verso. Emplacements totaux = cases par page × 2 × feuillets.";
    panel.append(rowcols, hint);
    body.append(panel);
    syncCustomPanelVisibility(body);
  }

  if (wizardStep === 3) {
    const slots = wizardDraft.rows * wizardDraft.cols;
    const pages = 2 * wizardDraft.sheetCount;
    const totalSlots = slots * pages;
    const orgLabel =
      wizardDraft.organization === "by_region"
        ? "Par région (natives puis formes importées en fin de bloc)"
        : "National (ordre du Pokédex)";
    const presetLabel =
      wizardDraft.formatPreset === "3x3-10"
        ? "Preset 3 × 3 · 10 feuillets"
        : wizardDraft.formatPreset === "2x2-10"
          ? "Preset 2 × 2 · 10 feuillets"
          : "Grille et feuillets personnalisés";
    const scopeLabel =
      wizardDraft.formScope === "base_only"
        ? "Base seule"
        : wizardDraft.formScope === "full"
          ? "Complet (Méga, Gigamax, formes nommées)"
          : "Base + formes régionales";

    const div = document.createElement("div");
    div.className = "wizard-recap";
    appendRecapLine(div, "Organisation", orgLabel);
    appendRecapLine(div, "Formes", scopeLabel);
    appendRecapLine(div, "Format", presetLabel);
    appendRecapLine(
      div,
      "Grille",
      `${wizardDraft.rows} × ${wizardDraft.cols} — ${slots} cases par page`,
    );
    appendRecapLine(
      div,
      "Capacité",
      `${wizardDraft.sheetCount} feuillets → ${pages} pages, ${totalSlots} emplacements au total`,
    );
    const nameRecap =
      wizardDraft.organization === "by_region" && !wizardDraft.editBinderId
        ? `Un album par région (libellés issus du Pokédex), grille identique — le nom « ${wizardDraft.name} » sert de référence interne seulement si tu exportes la config.`
        : `${wizardDraft.name} (modifiable plus tard dans le fichier JSON)`;
    appendRecapLine(div, "Nom du classeur", nameRecap);
    const note = document.createElement("p");
    note.className = "wizard-recap-note";
    note.textContent = wizardDraft.editBinderId
      ? "Enregistrement : le classeur existant et la règle de formes associée sont mis à jour dans binder-config.json."
      : "Les placements restent vides jusqu’à l’UI de rangement. Le périmètre des formes est enregistré dans la config classeur.";
    div.append(note);
    body.append(div);
  }

  syncWizardChrome();
  syncWizardBinderBar();
}

async function fetchPokedexRegionDefs() {
  try {
    const r = await fetch("/data/pokedex.json");
    if (!r.ok) return [];
    const dex = await r.json();
    return Array.isArray(dex.meta?.regions) ? dex.meta.regions : [];
  } catch {
    return [];
  }
}

/**
 * Un classeur unique (vue nationale ou une seule album « par région » globale).
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number }} draft
 */
function buildPersistNewPayloads(draft) {
  const binderId = `classeur-${Date.now().toString(36)}`;
  const scope =
    draft.formScope === "base_only" ||
    draft.formScope === "base_regional" ||
    draft.formScope === "full"
      ? draft.formScope
      : DEFAULT_FORM_SCOPE;
  const formRule = formRuleFromScope(scope);
  const org = draft.organization === "by_region" ? "by_region" : "national";
  const configBody = {
    version: 1,
    convention: "sheet_recto_verso",
    binders: [
      {
        id: binderId,
        name: draft.name,
        cols: draft.cols,
        rows: draft.rows,
        sheet_count: draft.sheetCount,
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
 * Un classeur par entrée de meta.regions (même grille / feuillets), chacun filtré sur sa région.
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number }} draft
 */
async function buildPersistNewPayloadsMultiRegion(draft) {
  const defs = await fetchPokedexRegionDefs();
  if (!defs.length) {
    return buildPersistNewPayloads(draft);
  }

  const scope =
    draft.formScope === "base_only" ||
    draft.formScope === "base_regional" ||
    draft.formScope === "full"
      ? draft.formScope
      : DEFAULT_FORM_SCOPE;
  const formRule = formRuleFromScope(scope);
  const t = Date.now().toString(36);
  const binders = [];
  const byBinder = {};

  for (const reg of defs) {
    if (!reg || !reg.id) continue;
    const id = `classeur-${t}-${String(reg.id).replace(/[^a-z0-9_-]/gi, "-")}`;
    const label = reg.label_fr || reg.id;
    binders.push({
      id,
      name: String(label),
      cols: draft.cols,
      rows: draft.rows,
      sheet_count: draft.sheetCount,
      form_rule_id: formRule.id,
      organization: "national",
      region_scope: String(reg.id),
    });
    byBinder[id] = {};
  }

  if (!binders.length) {
    return buildPersistNewPayloads(draft);
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

/**
 * @param {{ name: string; organization: string; formScope: string; rows: number; cols: number; sheetCount: number }} draft
 */
async function buildPersistNewPayloadsFromDraft(draft) {
  if (draft.organization === "by_region") {
    return buildPersistNewPayloadsMultiRegion(draft);
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
  const scope =
    draft.formScope === "base_only" ||
    draft.formScope === "base_regional" ||
    draft.formScope === "full"
      ? draft.formScope
      : DEFAULT_FORM_SCOPE;
  const formRule = formRuleFromScope(scope);
  const org = draft.organization === "by_region" ? "by_region" : "national";
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
      cols: draft.cols,
      rows: draft.rows,
      sheet_count: draft.sheetCount,
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
    if (!silent) setBinderHint(hint, `Enregistrement config refusé (${cfgRes.status}).`, false);
    return false;
  }
  const plRes = await fetch(API_BINDER_PLACEMENTS, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(placementsBody),
  });
  if (!plRes.ok) {
    if (!silent) setBinderHint(hint, `Config OK mais placements refusés (${plRes.status}).`, false);
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
    setBinderHint(hint, "Choisis une organisation : national ou par région.", false);
    return false;
  }
  wizardDraft.organization = v;
  setBinderHint(hint, "", true);
  return true;
}

function validateWizardFormatStep() {
  const hint = document.getElementById("binderV2Hint");
  if (!readFormatSelectionFromDom()) {
    setBinderHint(hint, "Choisis un format de grille (preset ou personnalisé).", false);
    return false;
  }
  setBinderHint(hint, "", true);
  return true;
}

function validateWizardFormStep() {
  const v = readFormScopeFromDom();
  const hint = document.getElementById("binderV2Hint");
  if (!v) {
    setBinderHint(hint, "Choisis un périmètre de formes (base, base + région, ou complet).", false);
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
      name: "Principal",
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
    if (!isStrictRegionDefaultConfig(cfg)) {
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
      "Impossible de joindre l’API classeurs (réseau ou CORS).",
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
      openWizard({ edit: true, binderId: id || undefined });
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
    // Wizard supprimé : mode unique classeur 3x3 par région.
    wireBinderRegionFilterOnce();
    const btn = document.getElementById("binderV2Refresh");
    if (btn) btn.addEventListener("click", () => void refreshBinderV2());
    window.PokedexBinderShell?.init?.();
    await refreshBinderV2();
  })();
}

window.startBinderV2IfNeeded = startBinderV2IfNeeded;

window.PokedexBinder = {
  persistWizardDraft: async () => ensureRegionDefaultWorkspace(),
  refreshBinderV2,
  isBinderConfigEmpty,
  setWizardSkipped,
  setConfigCache,
  DEFAULT_FORM_SCOPE,
  orderPokemonForBinder,
  formRuleFromScope,
  pokemonMatchesFormRule,
  pokemonMatchesBinderRule,
  selectBinderPokemonPool,
  getFormRuleForBinder,
  getEffectiveFormRuleForCollection,
  get cachedConfig() {
    return lastConfigJson;
  },
};
