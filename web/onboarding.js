/**
 * Assistant de démarrage plein écran — présentation du site, périmètre des formes,
 * création du classeur si la config est vide (sinon parcours court).
 */

const LS_ONBOARDING_DONE = "pokedexOnboardingCompleted";

let binderEmpty = true;
/** Bloque l’ouverture automatique du mini-assistant v2 pendant ce flux. */
let blockingBinderAuto = false;
let obStep = 0;
let skipBinder = false;
/** @type {{ name: string; organization: string; formScope: string; formatPreset: string; rows: number; cols: number; sheetCount: number }} */
let obDraft = {
  name: "Principal",
  organization: "national",
  formScope: "base_only",
  formatPreset: "3x3-10",
  rows: 3,
  cols: 3,
  sheetCount: 10,
};

function readOnboardingUiState() {
  try {
    return {
      onboarding_completed: localStorage.getItem(LS_ONBOARDING_DONE) === "1",
    };
  } catch {
    return { onboarding_completed: false };
  }
}

async function markOnboardingDone() {
  try {
    localStorage.setItem(LS_ONBOARDING_DONE, "1");
  } catch {
    /* ignore */
  }
  document.documentElement.classList.remove("site-onboarding-pending");
}

function obLastIndex() {
  return binderEmpty ? 5 : 2;
}

function clearEl(el) {
  if (el) el.replaceChildren();
}

function syncCustomPanel(root) {
  const panel = root.querySelector(".wizard-custom-panel");
  if (!panel) return;
  panel.hidden = obDraft.formatPreset !== "custom";
}

function renderObDots(root) {
  const host = root.querySelector("#siteOnboardingDots");
  if (!host) return;
  clearEl(host);
  const last = obLastIndex();
  for (let i = 0; i <= last; i++) {
    const d = document.createElement("span");
    d.className = "wizard-dot";
    if (i < obStep) d.classList.add("is-done");
    if (i === obStep) d.classList.add("is-current");
    host.append(d);
  }
}

function readObOrg(root) {
  const sel = root.querySelector(".wizard-org-card.is-selected");
  if (!sel) return null;
  return sel.dataset.org === "by_region" ? "by_region" : "national";
}

function readObForm(root) {
  const sel = root.querySelector(".wizard-form-card.is-selected");
  if (!sel) return null;
  const v = sel.dataset.formScope || "";
  if (v === "base_only" || v === "base_regional" || v === "full") return v;
  return null;
}

function readObFormat(root) {
  const sel = root.querySelector(".wizard-format-card.is-selected");
  if (!sel) return false;
  const key = sel.dataset.formatKey || "";
  obDraft.formatPreset = key;
  if (key === "3x3-10") {
    obDraft.rows = 3;
    obDraft.cols = 3;
    obDraft.sheetCount = 10;
    return true;
  }
  if (key === "2x2-10") {
    obDraft.rows = 2;
    obDraft.cols = 2;
    obDraft.sheetCount = 10;
    return true;
  }
  if (key === "custom") {
    const r = root.querySelector("#obWizardRows");
    const c = root.querySelector("#obWizardCols");
    const s = root.querySelector("#obWizardSheets");
    obDraft.rows = Math.min(12, Math.max(1, Number.parseInt(r?.value || "1", 10) || 1));
    obDraft.cols = Math.min(12, Math.max(1, Number.parseInt(c?.value || "1", 10) || 1));
    obDraft.sheetCount = Math.min(200, Math.max(1, Number.parseInt(s?.value || "1", 10) || 1));
    return true;
  }
  return false;
}

function setObError(root, text) {
  const el = root.querySelector("#siteOnboardingError");
  if (!el) return;
  el.textContent = text || "";
  el.hidden = !text;
}

function appendP(body, className, text) {
  const p = document.createElement("p");
  if (className) p.className = className;
  p.textContent = text;
  body.append(p);
}

function appendRecapLine(div, label, value) {
  const line = document.createElement("div");
  line.className = "wizard-recap-line";
  const s = document.createElement("strong");
  s.textContent = label;
  const span = document.createElement("span");
  span.textContent = value;
  line.append(s, span);
  div.append(line);
}

function renderShortPathStep(body, step) {
  if (step === 0) {
    appendP(body, "site-onboarding__hero-lead", "Un suivi de collection local, pensé pour coller aux cartes que tu possèdes vraiment.");
    appendP(
      body,
      "wizard-lead",
      "Pas de compte : tout vit dans ton dépôt (make web) et des fichiers JSON.",
    );
    return;
  }
  if (step === 1) {
    const grid = document.createElement("div");
    grid.className = "site-onboarding__split";
    const t1 = document.createElement("div");
    t1.className = "site-onboarding__tile";
    const h1 = document.createElement("h3");
    h1.className = "site-onboarding__tile-title";
    h1.textContent = "Liste";
    const p1 = document.createElement("p");
    p1.className = "site-onboarding__tile-text";
    p1.textContent = "Filtres par région, recherche, coches rapides. Idéal pour « qu’est-ce qu’il me manque ? ».";
    t1.append(h1, p1);
    const t2 = document.createElement("div");
    t2.className = "site-onboarding__tile";
    const h2 = document.createElement("h3");
    h2.className = "site-onboarding__tile-title";
    h2.textContent = "Classeurs";
    const p2 = document.createElement("p");
    p2.className = "site-onboarding__tile-text";
    p2.textContent = "Grilles façon album : feuillets, cases, ordre national ou par région. Déjà configuré chez toi.";
    t2.append(h2, p2);
    grid.append(t1, t2);
    body.append(grid);
    return;
  }
  appendP(
    body,
    "wizard-lead",
    "Tu as déjà un classeur dans binder-config.json. Tu peux l’affiner plus tard ou passer à la liste pour cocher tes attrapés.",
  );
  appendP(body, "wizard-lead wizard-lead--tight", "Utilise l’onglet en haut pour basculer entre les vues.");
}

function renderOnboardingStep(root) {
  const body = root.querySelector("#siteOnboardingBody");
  const title = root.querySelector("#siteOnboardingTitle");
  const meta = root.querySelector("#siteOnboardingMeta");
  const back = root.querySelector("#siteOnboardingBack");
  const next = root.querySelector("#siteOnboardingNext");
  const skipBinderBtn = root.querySelector("#siteOnboardingSkipBinder");
  if (!body || !title || !meta || !back || !next) return;

  setObError(root, "");
  clearEl(body);
  renderObDots(root);

  const last = obLastIndex();
  if (back) back.disabled = obStep === 0;
  if (next) next.textContent = obStep === last ? "Terminer" : "Continuer";
  if (skipBinderBtn) {
    skipBinderBtn.hidden = !(binderEmpty && obStep >= 3 && obStep <= 4);
  }

  if (!binderEmpty) {
    if (obStep === 0) {
      title.textContent = "Bienvenue";
      meta.textContent = "Découverte — 1 / 3";
      renderShortPathStep(body, 0);
    } else if (obStep === 1) {
      title.textContent = "Deux façons de voir ta collection";
      meta.textContent = "Découverte — 2 / 3";
      renderShortPathStep(body, 1);
    } else {
      title.textContent = "C’est parti";
      meta.textContent = "Découverte — 3 / 3";
      renderShortPathStep(body, 2);
    }
    return;
  }

  const labels = [
    "Bienvenue",
    "Les deux vues",
    "Formes à suivre",
    "Organisation du classeur",
    "Format des pages",
    "Récapitulatif",
  ];
  title.textContent = labels[obStep] || "Assistant";
  meta.textContent = `${labels[obStep]} — ${obStep + 1} / ${last + 1}`;

  if (obStep === 0) {
    appendP(body, "site-onboarding__hero-lead", "Pokédex Tracker — collection claire, locale, sans bruit.");
    appendP(
      body,
      "wizard-lead",
      "En quelques écrans : ce que tu suis, comment ton classeur est rangé, et un périmètre de formes réaliste (les cartes Méga / Gigamax ne couvrent pas tout le Pokédex).",
    );
  } else if (obStep === 1) {
    const grid = document.createElement("div");
    grid.className = "site-onboarding__split";
    const t1 = document.createElement("div");
    t1.className = "site-onboarding__tile";
    const h1 = document.createElement("h3");
    h1.className = "site-onboarding__tile-title";
    h1.textContent = "Liste";
    const p1 = document.createElement("p");
    p1.className = "site-onboarding__tile-text";
    p1.textContent = "Vue grille avec filtres région et statut attrapé / manquant. Synchro collection-progress.json.";
    t1.append(h1, p1);
    const t2 = document.createElement("div");
    t2.className = "site-onboarding__tile";
    const h2 = document.createElement("h3");
    h2.className = "site-onboarding__tile-title";
    h2.textContent = "Classeurs";
    const p2 = document.createElement("p");
    p2.className = "site-onboarding__tile-text";
    p2.textContent = "Pages et cases comme un vrai album. Configuration binder-config.json — on te guide pour la créer.";
    t2.append(h2, p2);
    grid.append(t1, t2);
    body.append(grid);
  } else if (obStep === 2) {
    appendP(
      body,
      "wizard-lead",
      "Par défaut : forme de base seule (sans variantes régionales). Tu peux élargir ici ; plus tard, l’onglet Classeurs → Réglages permet de changer — à chaque enregistrement, la liste et les stats se recalculent.",
    );
    const g = document.createElement("div");
    g.className = "wizard-choice-grid wizard-choice-grid--3";
    const mk = (scope, t, d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wizard-choice wizard-form-card";
      b.dataset.formScope = scope;
      if (obDraft.formScope === scope) b.classList.add("is-selected");
      const ht = document.createElement("h3");
      ht.className = "wizard-choice-title";
      ht.textContent = t;
      const pd = document.createElement("p");
      pd.className = "wizard-choice-desc";
      pd.textContent = d;
      b.append(ht, pd);
      b.addEventListener("click", () => {
        g.querySelectorAll(".wizard-form-card").forEach((x) => x.classList.remove("is-selected"));
        b.classList.add("is-selected");
        obDraft.formScope = scope;
      });
      return b;
    };
    g.append(
      mk("base_only", "Base seule", "Défaut : une entrée « principale » par espèce, sans formes régionales."),
      mk(
        "base_regional",
        "Base + régionales",
        "Inclut Alola, Galar, Hisui… — sans Méga / Gigamax / formes annexes rares.",
      ),
      mk("full", "Complet", "Méga, Gigamax et formes nommées — beaucoup plus d’entrées."),
    );
    body.append(g);
  } else if (obStep === 3) {
    appendP(body, "wizard-lead", "Ordre des entrées dans ton classeur (tu pourras changer plus tard dans le JSON).");
    const grid = document.createElement("div");
    grid.className = "wizard-choice-grid wizard-choice-grid--2";
    const mkOrg = (org, t, d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wizard-choice wizard-org-card";
      b.dataset.org = org;
      if (obDraft.organization === org) b.classList.add("is-selected");
      const ht = document.createElement("h3");
      ht.className = "wizard-choice-title";
      ht.textContent = t;
      const pd = document.createElement("p");
      pd.className = "wizard-choice-desc";
      pd.textContent = d;
      b.append(ht, pd);
      b.addEventListener("click", () => {
        grid.querySelectorAll(".wizard-org-card").forEach((x) => x.classList.remove("is-selected"));
        b.classList.add("is-selected");
        obDraft.organization = org;
      });
      return b;
    };
    grid.append(
      mkOrg("national", "Tous à la suite", "Ordre national du Pokédex."),
      mkOrg("by_region", "Par région", "Blocs par région : natives puis formes importées en fin de section."),
    );
    body.append(grid);
  } else if (obStep === 4) {
    appendP(body, "wizard-lead", "Presets courants 3×3 ou 2×2 (10 feuillets), ou personnalise grille et feuillets.");
    const fmtGrid = document.createElement("div");
    fmtGrid.className = "wizard-choice-grid wizard-choice-grid--3";
    const mkFmt = (key, t, d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wizard-choice wizard-format-card";
      b.dataset.formatKey = key;
      if (obDraft.formatPreset === key) b.classList.add("is-selected");
      const ht = document.createElement("h3");
      ht.className = "wizard-choice-title";
      ht.textContent = t;
      const pd = document.createElement("p");
      pd.className = "wizard-choice-desc";
      pd.textContent = d;
      b.append(ht, pd);
      b.addEventListener("click", () => {
        fmtGrid.querySelectorAll(".wizard-format-card").forEach((x) => x.classList.remove("is-selected"));
        b.classList.add("is-selected");
        obDraft.formatPreset = key;
        if (key === "3x3-10") {
          obDraft.rows = 3;
          obDraft.cols = 3;
          obDraft.sheetCount = 10;
        } else if (key === "2x2-10") {
          obDraft.rows = 2;
          obDraft.cols = 2;
          obDraft.sheetCount = 10;
        }
        syncCustomPanel(root);
      });
      return b;
    };
    fmtGrid.append(
      mkFmt("3x3-10", "3 × 3", "9 cases / page · 10 feuillets."),
      mkFmt("2x2-10", "2 × 2", "4 cases / page · 10 feuillets."),
      mkFmt("custom", "Personnalisé", "Lignes, colonnes, feuillets au choix."),
    );
    body.append(fmtGrid);
    const panel = document.createElement("div");
    panel.className = "wizard-custom-panel";
    panel.hidden = obDraft.formatPreset !== "custom";
    const rowcols = document.createElement("div");
    rowcols.className = "wizard-custom-fields";
    const mkField = (id, label, min, max, val) => {
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
      mkField("obWizardRows", "Lignes", 1, 12, obDraft.rows),
      mkField("obWizardCols", "Colonnes", 1, 12, obDraft.cols),
      mkField("obWizardSheets", "Feuillets", 1, 200, obDraft.sheetCount),
    );
    const hint = document.createElement("p");
    hint.className = "wizard-custom-hint";
    hint.textContent = "Emplacements totaux = cases × 2 × feuillets.";
    panel.append(rowcols, hint);
    body.append(panel);
    syncCustomPanel(root);
  } else if (obStep === 5) {
    const slots = obDraft.rows * obDraft.cols;
    const pages = 2 * obDraft.sheetCount;
    const total = slots * pages;
    const orgL =
      obDraft.organization === "by_region"
        ? "Par région (natives puis importées en fin de bloc)"
        : "National";
    const formL =
      obDraft.formScope === "base_only"
        ? "Base seule"
        : obDraft.formScope === "full"
          ? "Complet"
          : "Base + régionales";
    const fmtL =
      obDraft.formatPreset === "3x3-10"
        ? "3 × 3 · 10 feuillets"
        : obDraft.formatPreset === "2x2-10"
          ? "2 × 2 · 10 feuillets"
          : "Personnalisé";
    const div = document.createElement("div");
    div.className = "wizard-recap";
    if (skipBinder) {
      appendRecapLine(
        div,
        "Classeur",
        "Non créé pour l’instant — tu pourras lancer l’assistant depuis l’onglet Classeurs.",
      );
      appendRecapLine(div, "Formes (info)", `${formL} — sera appliqué quand tu créeras un classeur.`);
    } else {
      appendRecapLine(div, "Organisation", orgL);
      appendRecapLine(div, "Formes", formL);
      appendRecapLine(div, "Format", `${fmtL} — ${slots} cases/page, ${total} emplacements au total`);
      appendRecapLine(div, "Nom", obDraft.name);
    }
    const note = document.createElement("p");
    note.className = "wizard-recap-note";
    note.textContent = skipBinder
      ? "Aucun fichier classeur modifié. La liste fonctionne tout de suite."
      : "Enregistrement des fichiers classeur locaux, puis tu arrives sur l’app.";
    div.append(note);
    body.append(div);
  }
}

function validateObStep(root) {
  if (!binderEmpty) return true;
  if (obStep === 2) {
    const v = readObForm(root);
    if (!v) {
      setObError(root, "Choisis un périmètre de formes.");
      return false;
    }
    obDraft.formScope = v;
  }
  if (obStep === 3) {
    const v = readObOrg(root);
    if (!v) {
      setObError(root, "Choisis national ou par région.");
      return false;
    }
    obDraft.organization = v;
  }
  if (obStep === 4) {
    if (!readObFormat(root)) {
      setObError(root, "Choisis un format ou complète la grille personnalisée.");
      return false;
    }
  }
  return true;
}

async function finishOnboarding(root) {
  const B = window.PokedexBinder;
  if (binderEmpty && B && !skipBinder) {
    const ok = await B.persistWizardDraft(obDraft, { silent: true });
    if (!ok) {
      setObError(
        root,
        "Impossible d’enregistrer le classeur — vérifie que « make web » tourne et réessaie.",
      );
      return;
    }
  }
  if (binderEmpty && skipBinder && B) {
    await B.setWizardSkipped(true);
  }
  await markOnboardingDone();
  blockingBinderAuto = false;
  root.classList.remove("site-onboarding--open");
  root.hidden = true;
  if (typeof B?.refreshBinderV2 === "function") {
    await B.refreshBinderV2();
  }
  if (typeof window.applyPokedexAppRoute === "function") {
    window.applyPokedexAppRoute();
  }
}

async function onObNext(root) {
  const last = obLastIndex();
  if (obStep < last) {
    if (!validateObStep(root)) return;
    if (obStep === 4) readObFormat(root);
    obStep += 1;
    renderOnboardingStep(root);
    return;
  }
  const nextBtn = root.querySelector("#siteOnboardingNext");
  if (nextBtn) nextBtn.disabled = true;
  try {
    await finishOnboarding(root);
  } finally {
    if (nextBtn) nextBtn.disabled = false;
  }
}

function onObBack(root) {
  if (obStep === 0) return;
  if (binderEmpty && obStep === 5) skipBinder = false;
  if (binderEmpty && obStep === 4) readObFormat(root);
  obStep -= 1;
  renderOnboardingStep(root);
}

async function bootstrapOnboarding() {
  document.documentElement.classList.add("site-onboarding-pending");
  const ui = readOnboardingUiState();
  if (ui.onboarding_completed) {
    document.documentElement.classList.remove("site-onboarding-pending");
    return;
  }

  const root = document.getElementById("siteOnboarding");
  if (!root) {
    document.documentElement.classList.remove("site-onboarding-pending");
    return;
  }

  blockingBinderAuto = true;
  root.hidden = false;
  root.classList.add("site-onboarding--open");

  try {
    const r = await fetch("/api/binder");
    if (r.ok) {
      const list = await r.json();
      binderEmpty = !Array.isArray(list) || list.length === 0;
    } else {
      binderEmpty = true;
    }
  } catch {
    binderEmpty = true;
  }

  obStep = 0;
  skipBinder = false;
  obDraft = {
    name: "Principal",
    organization: "national",
    formScope: window.PokedexBinder?.DEFAULT_FORM_SCOPE || "base_only",
    formatPreset: "3x3-10",
    rows: 3,
    cols: 3,
    sheetCount: 10,
  };

  renderOnboardingStep(root);

  const back = root.querySelector("#siteOnboardingBack");
  const next = root.querySelector("#siteOnboardingNext");
  const skipBinderBtn = root.querySelector("#siteOnboardingSkipBinder");

  if (back && !back.dataset.obWired) {
    back.dataset.obWired = "1";
    back.addEventListener("click", () => onObBack(root));
  }
  if (next && !next.dataset.obWired) {
    next.dataset.obWired = "1";
    next.addEventListener("click", () => onObNext(root));
  }
  if (skipBinderBtn && !skipBinderBtn.dataset.obWired) {
    skipBinderBtn.dataset.obWired = "1";
    skipBinderBtn.addEventListener("click", () => {
      skipBinder = true;
      obStep = 5;
      renderOnboardingStep(root);
    });
  }
}

function isBlockingBinderWizard() {
  return blockingBinderAuto;
}

window.PokedexOnboarding = {
  bootstrapOnboarding,
  isBlockingBinderWizard,
};
