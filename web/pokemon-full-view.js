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

  function normalizeImgPath(img) {
    if (!img) return null;
    const s = String(img).replace(/^\.\//, "");
    if (s.startsWith("http")) return s;
    return s.startsWith("/") ? s : `/${s}`;
  }

  function displayName(p) {
    const n = p?.names || {};
    return n.fr || n.en || p?.slug || "?";
  }

  function displayNumber(num) {
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
    if (!pokemon) return [];
    const number = String(pokemon.number || "");
    if (!number) return [];
    const all = window.PokedexCollection?.allPokemon || [];
    return all.filter(
      (p) => String(p?.number || "") === number && (p?.slug || "") !== pokemon.slug,
    );
  }

  function buildBackBar(root) {
    const bar = document.createElement("div");
    bar.className = "fullview-topbar";
    const back = document.createElement("a");
    back.className = "fullview-back";
    back.href = "#/liste";
    back.textContent = "← Retour à la collection";
    bar.append(back);
    root.append(bar);
  }

  function buildHero(root, p) {
    const hero = document.createElement("section");
    hero.className = "fullview-hero";

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

    const statusBox = document.createElement("div");
    statusBox.className = "fullview-hero__status";
    const status = window.PokedexCollection?.getStatus?.(p.slug) || {
      state: "not_met",
      shiny: false,
    };
    const statusLabel = document.createElement("span");
    statusLabel.className = "fullview-hero__status-label";
    statusLabel.textContent =
      status.state === "caught"
        ? status.shiny ? "Attrapé shiny" : "Attrapé"
        : status.state === "seen" ? "Aperçu" : "Non rencontré";
    statusLabel.dataset.state = status.state;
    statusBox.append(statusLabel);

    const cycle = document.createElement("button");
    cycle.type = "button";
    cycle.className = "fullview-status-btn";
    cycle.textContent = "Cycler statut";
    cycle.addEventListener("click", () => {
      window.PokedexCollection?.cycleStatusBySlug?.(p.slug);
      renderInto(document.getElementById("viewPokemon"), p.slug);
    });
    statusBox.append(cycle);

    const shiny = document.createElement("button");
    shiny.type = "button";
    shiny.className = "fullview-status-btn";
    shiny.textContent = status.shiny ? "Retirer shiny" : "Marquer shiny";
    shiny.addEventListener("click", () => {
      window.PokedexCollection?.cycleStatusBySlug?.(p.slug, { shift: true });
      renderInto(document.getElementById("viewPokemon"), p.slug);
    });
    statusBox.append(shiny);

    meta.append(statusBox);

    const huntBox = document.createElement("div");
    huntBox.className = "fullview-hero__status";
    const hunt = window.PokevaultHunts?.entry?.(p.slug);
    const huntLabel = document.createElement("span");
    huntLabel.className = "fullview-hero__status-label";
    huntLabel.textContent = hunt
      ? hunt.priority === "high" ? "Recherche prioritaire" : "Dans mes recherches"
      : "Pas dans mes recherches";
    huntLabel.dataset.state = hunt ? "seen" : "not_met";
    huntBox.append(huntLabel);

    const toggleHunt = document.createElement("button");
    toggleHunt.type = "button";
    toggleHunt.className = "fullview-status-btn";
    toggleHunt.textContent = hunt ? "Retirer recherche" : "Rechercher";
    toggleHunt.addEventListener("click", async () => {
      await window.PokevaultHunts?.patch?.(
        p.slug,
        hunt ? { wanted: false } : { wanted: true, priority: "normal" },
      );
      renderInto(document.getElementById("viewPokemon"), p.slug);
    });
    huntBox.append(toggleHunt);

    const priorityHunt = document.createElement("button");
    priorityHunt.type = "button";
    priorityHunt.className = "fullview-status-btn";
    priorityHunt.textContent = hunt?.priority === "high" ? "Priorite normale" : "Priorite haute";
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
    meta.append(huntBox);

    hero.append(meta);
    root.append(hero);
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
    h.textContent = "Efficacité défensive";
    section.append(h);

    const groups = [
      { label: "Faiblesses", test: (m) => m > 1 },
      { label: "Résistances", test: (m) => m < 1 && m > 0 },
      { label: "Immunités", test: (m) => m === 0 },
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
    const others = findForms(p);
    if (!others.length) return;
    const section = document.createElement("section");
    section.className = "fullview-section";
    const h = document.createElement("h2");
    h.className = "fullview-section__title";
    h.textContent = "Autres formes";
    section.append(h);
    const list = document.createElement("div");
    list.className = "fullview-forms-grid";
    for (const f of others) {
      const a = document.createElement("a");
      a.className = "fullview-form-tile";
      a.href = `#/pokemon/${encodeURIComponent(f.slug)}`;
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
      label.textContent = f.form || displayName(f);
      a.append(label);
      list.append(a);
    }
    section.append(list);
    root.append(section);
  }

  async function buildCardsSection(root, slug) {
    const section = document.createElement("section");
    section.className = "fullview-section";
    const h = document.createElement("h2");
    h.className = "fullview-section__title";
    h.textContent = "Mes cartes";
    section.append(h);

    const body = document.createElement("div");
    body.className = "fullview-cards-body";
    body.textContent = "Chargement…";
    section.append(body);
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
        empty.textContent =
          "Aucune carte pour l'instant. Ouvre le drawer (bouton « Fiche & cartes » ou touche i) pour en ajouter.";
        body.append(empty);
        return;
      }
      const table = document.createElement("table");
      table.className = "fullview-cards-table";
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      for (const label of ["Set", "N°", "Variante", "Langue", "Condition", "Qté", "Note"]) {
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
      warn.textContent = "Impossible de charger les cartes pour l'instant.";
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
      ? `Aucun Pokémon trouvé pour « ${slug} ».`
      : "Aucun Pokémon sélectionné.";
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
    buildWeaknessGrid(root, p);
    buildForms(root, p);
    void buildCardsSection(root, slug);
  }

  async function render(slug) {
    const root = ensureRoot();
    if (typeof window.PokedexCollection?.ensureLoaded === "function") {
      await window.PokedexCollection.ensureLoaded();
    }
    await window.PokevaultHunts?.ensureLoaded?.();
    renderInto(root, slug);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  ensureRoot();
  window.PokevaultFullView = { render };
})();
