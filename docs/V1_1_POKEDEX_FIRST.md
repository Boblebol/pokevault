# V1.1 Pokédex-First Backlog

Ce plan transforme la direction produit en tickets prêts à être ouverts ou pris
un par un en PR. La priorité reste volontairement simple : Pokevault doit aider
l'utilisateur à compléter son Pokédex avant tout. Les shiny et les cartes
restent des couches secondaires, utiles pour enrichir une fiche ou flexer une
collection, mais jamais le centre de navigation.

## Principes De Livraison

- Chaque ticket doit pouvoir être mergé seul.
- Les vues touchées doivent rester lisibles sur mobile.
- Les cartes TCG ne doivent pas devenir une entrée principale de l'app.
- Les données externes ne sont jamais appelées au runtime pour le coeur
  Pokédex.
- Toute modification `tracker/` garde 100 % de coverage.

## Onboarding

L'onboarding reste simple. Il ne doit pas devenir un configurateur complet.

Le parcours cible tient en trois décisions :

1. **Objectif par défaut** : compléter mon Pokédex.
2. **Région favorite** : National ou une région.
3. **Mode de suivi** : simple ou avancé.

Le mode simple expose surtout `non rencontré`, `vu`, `capturé`. Le mode avancé
rend les shiny, formes, notes et cartes plus visibles, sans changer le modèle de
données principal. Les cartes sont présentées comme une option plus tard, pas
comme un choix structurant.

---

## Milestone A — Centre Pokédex

Objectif : la home devient un tableau de complétion Pokédex. L'utilisateur doit
comprendre en quelques secondes ce qui manque et quoi faire ensuite.

### A1 — Repositionnement Pokédex-First

**Type** : documentation produit.

**Scope**

- Mettre à jour les textes publics qui présentent Pokevault.
- Clarifier que cartes et shiny sont des enrichissements secondaires.
- Faire pointer README, roadmap publique et site docs vers ce plan v1.1.

**Acceptance**

- Le README décrit Pokevault comme Pokédex-first.
- La roadmap indique que le prochain cycle actif est v1.1 Pokédex-first.
- Les cartes ne sont pas décrites comme le coeur du produit.

**Tests**

- Tests de liens docs.
- Test de présence du backlog v1.1 dans README, `docs/ROADMAP.md` et
  `docs/roadmap.html`.

### A2 — Dashboard Pokédex

**Type** : frontend.

**Status** : implemented.

**Scope**

- Renforcer la home avec une lecture claire :
  - progression National Dex ;
  - progression par région ;
  - compteurs non rencontrés / vus / capturés ;
  - shiny en métrique bonus ;
  - cartes en métrique secondaire.
- Garder la grille Pokémon comme expérience principale.

**Acceptance**

- La première vue explique où en est le Pokédex.
- Les cartes sont visibles seulement comme une petite métrique secondaire.
- Les stats se mettent à jour quand un statut change.

**Mobile**

- Les stats s'empilent proprement sous 720 px.
- Aucun compteur ne force un scroll horizontal.
- Les cartes de stats restent scannables avec le pouce.

**Tests**

- Tests JS pour les helpers de calcul.
- Tests de rendu DOM sur les états vide, partiel et complet.
- Vérification responsive manuelle ou screenshot Playwright si disponible.

### A3 — Prochains Pokémon À Compléter

**Type** : frontend.

**Status** : implemented.

**Scope**

- Ajouter un bloc "À compléter maintenant".
- Classer les recommandations :
  1. vus mais non capturés ;
  2. manquants de la région active ;
  3. objectifs proches de complétion régionale ;
  4. objectifs proches de badges Pokédex.
- Ne pas faire dépendre le ranking des cartes.

**Acceptance**

- Les recommandations sont compréhensibles sans lire une aide.
- Chaque recommandation explique pourquoi elle est proposée.
- Cliquer une recommandation ouvre la fiche ou centre la carte Pokémon.

**Mobile**

- Le bloc affiche peu d'items par défaut.
- Les raisons restent courtes sur petits écrans.

**Tests**

- Tests JS du ranking.
- Tests de tie-breaker stable.
- Test de non-régression : une carte possédée ne remonte pas seule un Pokémon.

### A4 — Filtres Pokédex-First

**Type** : frontend.

**Status** : implemented.

**Scope**

- Ajouter ou nettoyer les filtres rapides :
  - Tous ;
  - Manquants ;
  - Vus ;
  - Capturés ;
  - Shiny ;
  - Région ;
  - Formes régionales.
- Persister l'état dans le hash.

**Acceptance**

- Les filtres s'appliquent à la grille et aux compteurs.
- Le hash permet de partager ou revenir au même état.
- Le filtre shiny reste un bonus, pas le filtre mis en avant par défaut.

**Mobile**

- Les filtres tiennent dans une barre horizontale scrollable.
- La zone de filtres ne masque pas la grille.

**Tests**

- Tests JS sur combinaison de filtres.
- Tests hash parse/write.
- Tests d'état vide filtré.

### A5 — Mobile Home

**Type** : frontend design.

**Status** : implemented.

**Scope**

- Revoir les espacements, tailles et ordres de blocs pour mobile.
- Prioriser :
  1. progression ;
  2. recommandations ;
  3. filtres ;
  4. grille.

**Acceptance**

- La home est utilisable à 360 px de largeur.
- Aucun texte critique ne se chevauche.
- Les actions principales sont accessibles sans viser précisément.

**Tests**

- Smoke test web existant.
- Capture ou revue manuelle à 360 px, 390 px, 768 px et desktop.

### A6 — Onboarding Pokédex-First

**Type** : frontend + stockage local/profil.

**Status** : implemented.

**Scope**

- Remplacer le positionnement mixte par un onboarding Pokédex-first.
- Étapes :
  1. bienvenue courte ;
  2. région favorite ;
  3. mode simple ou avancé.
- Les cartes apparaissent comme add-on activable plus tard.

**Acceptance**

- Un nouvel utilisateur peut terminer en moins de 30 secondes.
- Le choix par défaut est "Compléter mon Pokédex".
- Les préférences guident l'affichage initial sans cacher définitivement les
  autres fonctions.

**Mobile**

- Le wizard tient sur un petit écran sans scroll excessif.
- Les boutons de navigation restent visibles.

**Tests**

- Tests JS du stockage de préférences.
- Test de première ouverture.
- Test de skip.
- Tests d'export/import si les préférences sont persistées côté profil.

---

## Milestone B — Fiche Pokémon V2

Objectif : chaque fiche devient une vraie page d'encyclopédie personnelle. Les
cartes restent présentes, mais en section secondaire.

### B1 — Architecture Fiche

**Type** : frontend.

**Scope**

- Structurer la fiche en sections :
  - identité ;
  - statut Pokédex ;
  - formes ;
  - progression personnelle ;
  - notes ;
  - cartes.

**Acceptance**

- La fiche se comprend sans ouvrir la section cartes.
- Les cartes sont placées bas ou repliées.
- Le drawer et la route full page partagent les helpers quand c'est pertinent.

**Mobile**

- Header compact.
- Sections lisibles en une colonne.

**Tests**

- Tests DOM/helpers.
- Tests de route `#/pokemon/:slug`.

### B2 — Actions Rapides Statut

**Type** : frontend + API existante.

**Scope**

- Rendre les actions statut plus claires :
  - Non rencontré ;
  - Vu ;
  - Capturé ;
  - Shiny.
- Désactiver shiny si le Pokémon n'est pas capturé.

**Acceptance**

- L'état actif est évident.
- Changer de statut met à jour dashboard, fiche et grille.
- Shiny ne peut pas rester actif sur un statut non capturé.

**Mobile**

- Les actions sont assez grandes pour le tactile.

**Tests**

- Tests progress service/API existants renforcés si nécessaire.
- Tests JS sur transitions de statut.

### B3 — Formes Et Variantes

**Type** : frontend + fixtures.

**Scope**

- Afficher les formes liées à une espèce.
- Naviguer entre formes.
- Indiquer le statut de chaque forme.

**Acceptance**

- Les formes régionales et spéciales sont visibles depuis la fiche.
- Chaque forme garde son propre statut.
- La navigation préserve le retour à la liste.

**Mobile**

- Les formes utilisent une liste compacte ou des chips scrollables.

**Tests**

- Tests avec fixtures Méga, Alola, Galar, Hisui, Paldea.
- Tests de statut par forme.

### B4 — Notes Pokédex

**Type** : backend + frontend.

**Scope**

- Ajouter une note personnelle par Pokémon/profil.
- Cas d'usage : lieu, version, échange, objectif.

**Acceptance**

- La note est locale et exportable.
- Une note vide ne pollue pas l'UI.
- Les notes sont profilées comme les autres états utilisateur.

**Mobile**

- Édition en champ simple, sans modal lourde.

**Tests**

- Tests repository/service/API.
- Tests export/import.
- Tests frontend helper.

### B5 — Section Cartes Repliée

**Type** : frontend.

**Scope**

- Garder les cartes dans la fiche, mais visuellement secondaires.
- La recherche TCG reste disponible dans cette section.

**Acceptance**

- Une fiche sans carte reste complète.
- Ajouter une carte ne détourne pas la fiche du statut Pokédex.
- La brique TCG existante continue de fonctionner.

**Mobile**

- Section repliable pour éviter une fiche trop longue.

**Tests**

- Tests non-régression sur ajout carte.
- Tests JS du repli/dépli.

### B6 — Mobile Fiche

**Type** : frontend design.

**Scope**

- Revoir la fiche sur petits écrans.
- Prioriser statut + formes avant les cartes.

**Acceptance**

- Aucun chevauchement image/texte.
- Les actions principales restent visibles rapidement.
- Les sections longues sont repliables.

**Tests**

- Tests web existants.
- Revue responsive 360 px, 390 px, 768 px et desktop.

---

## Milestone C — Données Pokédex Enrichies

Objectif : enrichir la valeur Pokédex sans rendre l'app fragile. Les données
sont préparées, versionnées et testées hors runtime.

### C1 — Audit Sources Données

**Type** : recherche + documentation.

**Scope**

- Identifier les sources possibles pour :
  - familles d'évolution ;
  - générations ;
  - formes ;
  - versions ou habitats si pertinent.
- Noter licence, stabilité, format et coût de maintenance.

**Acceptance**

- Une recommandation claire existe pour chaque type de donnée.
- Les données non fiables restent hors scope.
- Aucune implémentation scraper n'est faite dans ce ticket.

**Tests**

- Aucun test runtime.
- Vérification docs/liens.

### C2 — Modèle Species Metadata

**Type** : backend/data.

**Scope**

- Ajouter un fichier séparé, par exemple `data/species-metadata.json`.
- Ne pas casser `data/pokedex.json`.
- Ajouter un validateur/schema.

**Acceptance**

- Le fichier metadata est optionnel au runtime.
- Une entrée invalide est rejetée en test.
- Le modèle est documenté.

**Tests**

- Tests schema.
- Tests de chargement manquant/invalide.

### C3 — Familles D'Évolution

**Type** : data + frontend.

**Scope**

- Ajouter les familles d'évolution validées.
- Afficher la famille dans la fiche Pokémon.
- Marquer les membres manquants.

**Acceptance**

- Une famille incomplète aide à trouver le prochain Pokémon à compléter.
- Les formes spéciales ne cassent pas la famille principale.

**Mobile**

- Affichage compact, horizontal si nécessaire.

**Tests**

- Tests fixtures familles simples et ramifiées.
- Tests de rendu fiche.

### C4 — Objectifs Intelligents

**Type** : frontend + services si nécessaire.

**Scope**

- Ajouter des objectifs :
  - compléter une région ;
  - finir une famille ;
  - capturer les starters ;
  - finir des formes régionales.

**Acceptance**

- Les objectifs expliquent leur calcul.
- Ils alimentent le dashboard sans remplacer la grille.

**Tests**

- Tests ranking.
- Tests objectifs proches de complétion.

### C5 — Import Ou Génération Contrôlée

**Type** : CLI/data.

**Scope**

- Ajouter une commande de génération ou refresh metadata.
- Utiliser des fixtures offline en test.
- Ne jamais appeler ces sources au runtime web/API.

**Acceptance**

- La commande échoue proprement si une source change.
- Les données générées sont déterministes.

**Tests**

- Tests CLI.
- Tests fixtures offline.
- Tests snapshot si adapté.

### C6 — Documentation Data

**Type** : documentation.

**Scope**

- Documenter les sources, limites, update process et responsabilités.

**Acceptance**

- Un contributeur sait comment mettre à jour les metadata.
- Les limites de licence et de stabilité sont explicites.

**Tests**

- Tests liens docs.

---

## Definition Of Done Par Ticket

- `uv run ruff check pokedex/ tracker/ main.py tests/`
- `uv run pytest tests/ --cov=tracker --cov-report=term-missing --cov-fail-under=100`
- `node --test tests/web/*.test.mjs`
- `git diff --check`
- Revue mobile pour toute PR UI.
- Pas de documents internes ou notes d'agent dans le repo.

## Ordre Recommandé

1. A1 — Repositionnement Pokédex-first.
2. A2 — Dashboard Pokédex.
3. A3 — Prochains Pokémon à compléter.
4. A4 — Filtres Pokédex-first.
5. A5 — Mobile home.
6. A6 — Onboarding Pokédex-first.
7. B1 à B6.
8. C1 à C6.

La première PR produit utile après ce document est **A1 + A2** si le diff reste
raisonnable. Sinon, garder **A1** seul pour poser le cap, puis livrer **A2**.
