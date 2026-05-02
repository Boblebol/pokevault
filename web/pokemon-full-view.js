/**
 * Pokevault — full-screen Pokédex fiche (roadmap F10).
 *
 * Route ``#/pokemon/:slug`` — rendered into ``#viewPokemon``.
 * Sections:
 *   1. hero (artwork + identity + Pokédex status shortcut);
 *   2. types & weaknesses (computed from ``web/type-chart.js``);
 *   3. other forms of the same national number (clickable);
 *   4. « Mes cartes » list driven by ``GET /api/cards/by-pokemon/{slug}``.
 *
 * Descriptions are intentionally omitted for now — the roadmap accepts
 * a type-only fallback while the scraper does not expose a
 * ``description_fr`` field.
 */
(function initFullView() {
  "use strict";

  const CONDITION_LABELS = {
    mint: "Mint",
    near_mint: "Near mint",
    excellent: "Excellent",
    good: "Good",
    played: "Played",
    poor: "Poor",
  };
  const FALLBACK_I18N = {
    "pokemon_full.back": "← Retour à la collection",
    "pokemon_full.name_and": "et",
    "pokemon_full.exchange.match": "Match possible avec {names}.",
    "pokemon_full.exchange.seen": "Vu chez {names}.",
    "pokemon_full.exchange.wanted_by": "{names} cherche ce Pokémon.",
    "pokemon_full.legacy_seen": "Vu manuel existant; les prochains statuts passent par Cherche, Capturé ou Double.",
    "pokemon_full.hunt.high": "Recherche prioritaire",
    "pokemon_full.hunt.normal": "Dans mes recherches",
    "pokemon_full.hunt.empty": "Active Cherche pour l'ajouter au focus.",
    "pokemon_full.hunt.priority_normal": "Priorite normale",
    "pokemon_full.hunt.priority_high": "Priorite haute",
    "pokemon_full.note.empty": "Aucune note personnelle pour l'instant.",
    "pokemon_full.defense": "Efficacité défensive",
    "pokemon_full.weaknesses": "Faiblesses",
    "pokemon_full.resistances": "Résistances",
    "pokemon_full.immunities": "Immunités",
    "pokemon_full.forms.empty": "Aucune autre forme dans le Pokédex local.",
    "pokemon_full.cards.loading": "Chargement…",
    "pokemon_full.cards.empty": "Aucune carte pour l'instant. Ouvre le drawer (bouton « Fiche & cartes » ou touche i) pour en ajouter.",
    "pokemon_full.cards.failed": "Impossible de charger les cartes pour l'instant.",
    "pokemon_full.table.set": "Set",
    "pokemon_full.table.number": "N°",
    "pokemon_full.table.variant": "Variante",
    "pokemon_full.table.lang": "Langue",
    "pokemon_full.table.condition": "Condition",
    "pokemon_full.table.qty": "Qté",
    "pokemon_full.table.note": "Note",
    "pokemon_full.missing.slug": "Aucun Pokémon trouvé pour « {slug} ».",
    "pokemon_full.missing.none": "Aucun Pokémon sélectionné.",
  };

  function t(key, params = {}) {
    const runtime = window.PokevaultI18n;
    if (runtime?.t) return runtime.t(key, params);
    const template = FALLBACK_I18N[key] || key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
    );
  }

  function ficheHelpers() {
    return window.PokevaultPokemonFiche || {};
  }

  function createFullSection(id, title, options = {}) {
    const helper = ficheHelpers();
    if (typeof helper.createFicheSection === "function") {
      return helper.createFicheSection({
        id,
        title,
        headingLevel: 2,
        className: "fullview-section",
        headingClassName: "fullview-section__title",
        secondary: options.secondary,
      });
    }
    const section = document.createElement("section");
    section.className = "fullview-section";
    section.dataset.section = id;
    const h = document.createElement("h2");
    h.className = "fullview-section__title";
    h.textContent = title;
    section.append(h);
    return section;
  }

  function decorateFicheSection(element, id, options = {}) {
    const helper = ficheHelpers();
    if (typeof helper.decorateFicheSection === "function") {
      return helper.decorateFicheSection(element, id, options);
    }
    element.dataset.section = id;
    return element;
  }

  function normalizeImgPath(img) {
    const helper = ficheHelpers();
    if (typeof helper.normalizeImgPath === "function") return helper.normalizeImgPath(img);
    if (!img) return null;
    const s = String(img).replace(/^\.\//, "");
    if (s.startsWith("http")) return s;
    return s.startsWith("/") ? s : `/${s}`;
  }

  function displayName(p) {
    const helper = ficheHelpers();
    if (typeof helper.displayName === "function") return helper.displayName(p);
    const n = p?.names || {};
    return n.fr || n.en || p?.slug || "?";
  }

  function displayNumber(num) {
    const helper = ficheHelpers();
    if (typeof helper.displayNumber === "function") {
      return helper.displayNumber(num, { compact: true, blank: "#—" });
    }
    if (!num) return "#—";
    const s = String(num).replace(/^#/, "").replace(/^0+/, "") || "0";
    return `#${s}`;
  }

  function findPokemon(slug) {
    const all = window.PokedexCollection?.allPokemon || [];
    for (const p of all) {
      if ((p?.slug || "") === slug) return p;
    }
    return null;
  }

  function findForms(pokemon) {
    const helper = ficheHelpers();
    const all = window.PokedexCollection?.allPokemon || [];
    if (typeof helper.findForms === "function") return helper.findForms(pokemon, all);
    if (!pokemon) return [];
    const number = String(pokemon.number || "");
    if (!number) return [];
    return all.filter((p) => String(p?.number || "") === number && (p?.slug || "") !== pokemon.slug);
  }

  function statusLabel(status) {
    const helper = ficheHelpers();
    if (typeof helper.statusLabel === "function") return helper.statusLabel(status);
    return status.state === "caught"
      ? status.shiny ? "Attrapé shiny" : "Attrapé"
      : status.state === "seen" ? "Aperçu" : "Non rencontré";
  }

  function ownershipState(slug) {
    const collection = window.PokedexCollection;
    if (typeof collection?.ownershipStateForSlug === "function") {
      return collection.ownershipStateForSlug(slug);
    }
    const helper = ficheHelpers();
    if (typeof helper.ownershipStateFromSources === "function") {
      return helper.ownershipStateFromSources(slug, {
        status: collection?.getStatus?.(slug),
        wanted: Boolean(window.PokevaultHunts?.isWanted?.(slug)),
        ownCard: window.PokevaultTrainerContacts?.getOwnCard?.() || null,
      });
    }
    const status = collection?.getStatus?.(slug) || { state: "not_met" };
    return { wanted: false, caught: status.state === "caught", duplicate: false };
  }

  function tradeSummary(slug) {
    try {
      return window.PokedexCollection?.tradeSummaryForSlug?.(slug)
        || window.PokevaultTrainerContacts?.tradeSummary?.(slug)
        || { availableFrom: [], wantedBy: [], matchCount: 0, canHelpCount: 0 };
    } catch {
      return { availableFrom: [], wantedBy: [], matchCount: 0, canHelpCount: 0 };
    }
  }

  function formatNameList(names) {
    const clean = (Array.isArray(names) ? names : []).filter(Boolean);
    if (!clean.length) return "";
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} ${t("pokemon_full.name_and")} ${clean[1]}`;
    return `${clean.slice(0, 2).join(", ")} +${clean.length - 2}`;
  }

  function buildExchangeContext(slug) {
    const summary = tradeSummary(slug);
    if (!summary.availableFrom.length && !summary.wantedBy.length) return null;
    const box = document.createElement("div");
    box.className = "pokemon-exchange-context";
    if (summary.matchCount > 0) {
      const line = document.createElement("p");
      line.textContent = t("pokemon_full.exchange.match", { names: formatNameList(summary.availableFrom) });
      box.append(line);
    } else if (summary.availableFrom.length > 0) {
      const line = document.createElement("p");
      line.textContent = t("pokemon_full.exchange.seen", { names: formatNameList(summary.availableFrom) });
      box.append(line);
    }
    if (summary.canHelpCount > 0) {
      const line = document.createElement("p");
      line.textContent = t("pokemon_full.exchange.wanted_by", { names: formatNameList(summary.wantedBy) });
      box.append(line);
    }
    return box;
  }

  function listReturnHash() {
    const helper = ficheHelpers();
    if (typeof helper.listReturnHash === "function") {
      return helper.listReturnHash(location.hash || "");
    }
    return "#/liste";
  }

  function pokemonRouteHref(slug) {
    const helper = ficheHelpers();
    if (typeof helper.pokemonRouteHref === "function") {
      return helper.pokemonRouteHref(slug, listReturnHash());
    }
    return `#/pokemon/${encodeURIComponent(slug)}`;
  }

  function buildBackBar(root) {
    const bar = document.createElement("div");
    bar.className = "fullview-topbar";
    const back = document.createElement("a");
    back.className = "fullview-back";
    back.href = listReturnHash();
    back.textContent = t("pokemon_full.back");
    bar.append(back);
    root.append(bar);
  }

  function buildHero(root, p) {
    const hero = document.createElement("section");
    hero.className = "fullview-hero";
    decorateFicheSection(hero, "identity");

    const imgWrap = document.createElement("div");
    imgWrap.className = "fullview-hero__img";
    const src = normalizeImgPath(p.image);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = displayName(p);
      imgWrap.append(img);
    }
    hero.append(imgWrap);

    const meta = document.createElement("div");
    meta.className = "fullview-hero__meta";

    const num = document.createElement("div");
    num.className = "fullview-hero__num";
    num.textContent = displayNumber(p.number);
    meta.append(num);

    const title = document.createElement("h1");
    title.className = "fullview-hero__title";
    title.textContent = displayName(p);
    meta.append(title);

    const namesRow = document.createElement("p");
    namesRow.className = "fullview-hero__names";
    const parts = [];
    if (p.names?.en) parts.push(`EN · ${p.names.en}`);
    if (p.names?.ja) parts.push(`JA · ${p.names.ja}`);
    if (p.form) parts.push(`Forme · ${p.form}`);
    namesRow.textContent = parts.join("  ·  ");
    if (namesRow.textContent) meta.append(namesRow);

    const types = document.createElement("div");
    types.className = "fullview-hero__types";
    const tList = Array.isArray(p.types) ? p.types.filter(Boolean) : [];
    for (const t of tList) {
      const b = document.createElement("span");
      b.className = "drawer-type-badge";
      b.textContent = t;
      types.append(b);
    }
    if (tList.length) meta.append(types);

    const region = document.createElement("p");
    region.className = "fullview-hero__region";
    region.textContent = p.region_label_fr || p.region || "";
    if (region.textContent) meta.append(region);

    hero.append(meta);
    root.append(hero);
  }

  function buildStatusSection(root, p) {
    const section = createFullSection("pokedex_status");
    const status = window.PokedexCollection?.getStatus?.(p.slug) || {
      state: "not_met",
      shiny: false,
    };
    const ownership = ownershipState(p.slug);
    const label = document.createElement("span");
    label.className = "fullview-hero__status-label";
    label.textContent = ficheHelpers().ownershipLabel?.(ownership) || statusLabel(status);
    label.dataset.state = ownership.duplicate
      ? "duplicate"
      : ownership.wanted
        ? "wanted"
        : ownership.caught
          ? "owned"
          : "none";
    section.append(label);

    const helper = ficheHelpers();
    if (typeof helper.createOwnershipActions === "function") {
      section.append(helper.createOwnershipActions(ownership, async (next) => {
        await window.PokedexCollection?.setPokemonOwnershipState?.(p.slug, next);
        renderInto(document.getElementById("viewPokemon"), p.slug);
      }));
    }
    if (status.state === "seen") {
      const legacy = document.createElement("p");
      legacy.className = "pokemon-status-legacy";
      legacy.textContent = t("pokemon_full.legacy_seen");
      section.append(legacy);
    }
    const exchange = buildExchangeContext(p.slug);
    if (exchange) section.append(exchange);

    root.append(section);
  }

  function buildProgressSection(root, p) {
    const section = createFullSection("personal_progress");
    const huntBox = document.createElement("div");
    huntBox.className = "fullview-hero__status";
    const hunt = window.PokevaultHunts?.entry?.(p.slug);
    const huntLabel = document.createElement("span");
    huntLabel.className = "fullview-hero__status-label";
    huntLabel.textContent = hunt
      ? hunt.priority === "high" ? t("pokemon_full.hunt.high") : t("pokemon_full.hunt.normal")
      : t("pokemon_full.hunt.empty");
    huntLabel.dataset.state = hunt ? "seen" : "not_met";
    huntBox.append(huntLabel);

    const priorityHunt = document.createElement("button");
    priorityHunt.type = "button";
    priorityHunt.className = "fullview-status-btn";
    priorityHunt.textContent = hunt?.priority === "high" ? t("pokemon_full.hunt.priority_normal") : t("pokemon_full.hunt.priority_high");
    priorityHunt.disabled = !hunt;
    priorityHunt.addEventListener("click", async () => {
      await window.PokevaultHunts?.patch?.(p.slug, {
        wanted: true,
        priority: hunt?.priority === "high" ? "normal" : "high",
        note: hunt?.note || "",
      });
      renderInto(document.getElementById("viewPokemon"), p.slug);
    });
    huntBox.append(priorityHunt);
    section.append(huntBox);
    root.append(section);
  }

  function buildNotesSection(root, p) {
    const section = createFullSection("notes");
    const note = window.PokedexCollection?.getNote?.(p.slug) || "";
    const helper = ficheHelpers();
    if (typeof helper.createNoteEditor === "function") {
      section.append(helper.createNoteEditor(note, async (text) => {
        await window.PokedexCollection?.setNote?.(p.slug, text);
      }));
    } else {
      const empty = document.createElement("p");
      empty.className = "drawer-empty";
      empty.textContent = note || t("pokemon_full.note.empty");
      section.append(empty);
    }
    root.append(section);
  }

  function buildWeaknessGrid(root, p) {
    const chart = window.PokevaultTypeChart;
    const tList = Array.isArray(p.types) ? p.types.filter(Boolean) : [];
    if (!chart || !tList.length) return;
    const rows = chart.computeWeaknesses(tList);
    const section = document.createElement("section");
    section.className = "fullview-section";

    const h = document.createElement("h2");
    h.className = "fullview-section__title";
    h.textContent = t("pokemon_full.defense");
    section.append(h);

    const groups = [
      { label: t("pokemon_full.weaknesses"), test: (m) => m > 1 },
      { label: t("pokemon_full.resistances"), test: (m) => m < 1 && m > 0 },
      { label: t("pokemon_full.immunities"), test: (m) => m === 0 },
    ];
    const wrap = document.createElement("div");
    wrap.className = "fullview-weakness-wrap";
    for (const g of groups) {
      const block = document.createElement("div");
      block.className = "fullview-weakness-block";
      const title = document.createElement("h3");
      title.textContent = g.label;
      block.append(title);
      const bucket = rows.filter((r) => g.test(r.mult));
      if (!bucket.length) {
        const empty = document.createElement("p");
        empty.className = "fullview-weakness-empty";
        empty.textContent = "—";
        block.append(empty);
      } else {
        const list = document.createElement("ul");
        list.className = "fullview-weakness-list";
        for (const row of bucket) {
          const li = document.createElement("li");
          const badge = document.createElement("span");
          badge.className = "drawer-type-badge";
          badge.textContent = row.type;
          li.append(badge);
          const mult = document.createElement("span");
          mult.className = "fullview-weakness-mult";
          mult.textContent = formatMult(row.mult);
          li.append(mult);
          list.append(li);
        }
        block.append(list);
      }
      wrap.append(block);
    }
    section.append(wrap);
    root.append(section);
  }

  function formatMult(m) {
    if (m === 0) return "0×";
    if (m === 0.25) return "¼×";
    if (m === 0.5) return "½×";
    if (Number.isInteger(m)) return `${m}×`;
    return `${m}×`;
  }

  function buildForms(root, p) {
    const helper = ficheHelpers();
    const all = window.PokedexCollection?.allPokemon || [];
    const entries = typeof helper.buildFormEntries === "function"
      ? helper.buildFormEntries(p, all, (slug) => window.PokedexCollection?.getStatus?.(slug))
      : [p, ...findForms(p)].map((form) => {
          const status = window.PokedexCollection?.getStatus?.(form.slug) || {
            state: "not_met",
            shiny: false,
          };
          return {
            pokemon: form,
            slug: form.slug,
            label: form.form || displayName(form),
            current: form.slug === p.slug,
            status,
            statusLabel: statusLabel(status),
          };
        });
    const section = createFullSection("forms");
    if (entries.length <= 1) {
      const empty = document.createElement("p");
      empty.className = "drawer-empty";
      empty.textContent = t("pokemon_full.forms.empty");
      section.append(empty);
      root.append(section);
      return;
    }
    const list = document.createElement("div");
    list.className = "fullview-forms-grid";
    for (const entry of entries) {
      const f = entry.pokemon;
      const a = document.createElement("a");
      a.className = "fullview-form-tile";
      a.href = pokemonRouteHref(entry.slug);
      a.dataset.current = entry.current ? "true" : "false";
      if (entry.current) a.setAttribute("aria-current", "page");
      const src = normalizeImgPath(f.image);
      if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        a.append(img);
      }
      const label = document.createElement("span");
      label.className = "fullview-form-tile__label";
      label.textContent = entry.label;
      a.append(label);
      const status = document.createElement("span");
      status.className = "fullview-form-tile__status";
      status.dataset.state = entry.status.state;
      if (entry.status.shiny) status.dataset.shiny = "true";
      status.textContent = entry.statusLabel;
      a.append(status);
      list.append(a);
    }
    section.append(list);
    root.append(section);
  }

  async function buildCardsSection(root, slug) {
    const section = createFullSection("cards", undefined, { secondary: true });
    const helper = ficheHelpers();
    const disclosureBody = typeof helper.createCollapsibleBody === "function"
      ? helper.createCollapsibleBody(section, {
          collapsed: true,
          bodyClassName: "fullview-cards-disclosure",
        })
      : section;

    const body = document.createElement("div");
    body.className = "fullview-cards-body";
    body.textContent = t("pokemon_full.cards.loading");
    disclosureBody.append(body);
    root.append(section);

    try {
      const r = await fetch(`/api/cards/by-pokemon/${encodeURIComponent(slug)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const cards = Array.isArray(data?.cards) ? data.cards : [];
      body.replaceChildren();
      if (!cards.length) {
        const empty = document.createElement("p");
        empty.className = "drawer-empty";
        empty.textContent = t("pokemon_full.cards.empty");
        body.append(empty);
        return;
      }
      const table = document.createElement("table");
      table.className = "fullview-cards-table";
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      for (const label of [
        t("pokemon_full.table.set"),
        t("pokemon_full.table.number"),
        t("pokemon_full.table.variant"),
        t("pokemon_full.table.lang"),
        t("pokemon_full.table.condition"),
        t("pokemon_full.table.qty"),
        t("pokemon_full.table.note"),
      ]) {
        const th = document.createElement("th");
        th.textContent = label;
        headRow.append(th);
      }
      thead.append(headRow);
      table.append(thead);
      const tbody = document.createElement("tbody");
      for (const c of cards) {
        const tr = document.createElement("tr");
        const cells = [
          c.set_id || "—",
          c.num || "—",
          c.variant || "—",
          c.lang ? c.lang.toUpperCase() : "—",
          CONDITION_LABELS[c.condition] || c.condition || "—",
          String(c.qty),
          c.note || "",
        ];
        for (const v of cells) {
          const td = document.createElement("td");
          td.textContent = v;
          tr.append(td);
        }
        tbody.append(tr);
      }
      table.append(tbody);
      body.append(table);
    } catch (err) {
      console.error("full-view: cards fetch failed", err);
      body.replaceChildren();
      const warn = document.createElement("p");
      warn.className = "drawer-empty";
      warn.textContent = t("pokemon_full.cards.failed");
      body.append(warn);
    }
  }

  function ensureRoot() {
    let root = document.getElementById("viewPokemon");
    if (root) return root;
    root = document.createElement("div");
    root.id = "viewPokemon";
    root.className = "app-view fullview";
    root.hidden = true;
    const canvas = document.querySelector(".stitch-canvas");
    if (canvas) canvas.append(root);
    else document.body.append(root);
    return root;
  }

  function renderMissing(root, slug) {
    root.replaceChildren();
    buildBackBar(root);
    const wrap = document.createElement("section");
    wrap.className = "fullview-section";
    const msg = document.createElement("p");
    msg.className = "drawer-empty";
    msg.textContent = slug
      ? t("pokemon_full.missing.slug", { slug })
      : t("pokemon_full.missing.none");
    wrap.append(msg);
    root.append(wrap);
  }

  function renderInto(root, slug) {
    if (!root) return;
    const p = slug ? findPokemon(slug) : null;
    if (!p) {
      renderMissing(root, slug);
      return;
    }
    root.replaceChildren();
    buildBackBar(root);
    buildHero(root, p);
    buildStatusSection(root, p);
    buildForms(root, p);
    buildProgressSection(root, p);
    buildNotesSection(root, p);
    buildWeaknessGrid(root, p);
    void buildCardsSection(root, slug);
  }

  async function render(slug) {
    const root = ensureRoot();
    if (typeof window.PokedexCollection?.ensureLoaded === "function") {
      await window.PokedexCollection.ensureLoaded();
    }
    await window.PokevaultHunts?.ensureLoaded?.();
    await window.PokevaultTrainerContacts?.ensureLoaded?.();
    renderInto(root, slug);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  ensureRoot();
  const fullViewApi = { render };
  if (window.__POKEVAULT_FULLVIEW_TESTS__) {
    fullViewApi._test = {
      renderInto,
    };
  }
  window.PokevaultFullView = fullViewApi;
})();
