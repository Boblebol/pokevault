# Contribuer à pokevault

Merci de ton intérêt pour le projet ! Voici comment contribuer.

## Prérequis

- Python 3.10+
- [uv](https://github.com/astral-sh/uv)

## Mise en place

```bash
git clone https://github.com/Boblebol/pokevault.git
cd pokevault
make install
make dev          # lance le serveur (le Pokédex de référence est déjà versionné)
```

Le fichier `data/pokedex.json` est embarqué dans le dépôt : pas besoin de
scraper Pokepedia pour démarrer. Les sprites (`data/images/`) et l'état
utilisateur (`data/collection-progress.json`, `data/binder-*.json`) sont
volontairement gitignorés.

Pour télécharger les sprites localement :

```bash
make fetch              # scrape + images (~1500 fichiers)
make fetch-test         # 10 entrées, sans images
make fetch-shiny        # artworks shiny optionnels
```

## Roadmap produit

Avant de proposer une nouvelle feature, jette un œil à [docs/ROADMAP.md](docs/ROADMAP.md)
et [docs/POSTPONED.md](docs/POSTPONED.md). La roadmap publique v1 est livrée ;
les idées explicitement repoussées ne doivent pas revenir dans une PR sans une
nouvelle user story, des critères d'acceptation et une décision de scope claire.

## Workflow de développement

1. **Crée une branche** depuis `main` :

   ```bash
   git checkout -b feature/ma-feature
   ```

2. **Code** ta modification.

3. **Formate et lint** avant de committer :

   ```bash
   make fmt
   make lint
   ```

4. **Lance les tests** :

   ```bash
   make test       # tous les tests
   make test-cov   # avec couverture (100% tracker requis)
   ```

5. **Commit** avec un message clair :

   ```bash
   git commit -m "Add: description courte de la modification"
   ```

6. **Push** et ouvre une Pull Request.

## Conventions

### Messages de commit

Préfixes recommandés — on accepte les deux styles (legacy + Conventional
Commits). À partir de la roadmap Wave 1, on privilégie la forme
Conventional Commits pour coller aux actions d'auto-release.

| Préfixe       | Usage                                                |
|---------------|------------------------------------------------------|
| `feat(fxx):`  | Nouvelle feature (référencer l'ID roadmap : `feat(f10): …`) |
| `fix:`        | Correction de bug                                    |
| `refactor:`   | Refactoring sans changement fonctionnel              |
| `docs:`       | Documentation uniquement                             |
| `test:`       | Ajout ou modification de tests                       |
| `ci:`         | Workflows GitHub Actions, hooks, tooling CI          |
| `chore:`      | Tâches transverses (build, deps Docker…)             |
| `deps:`       | Mise à jour de dépendances                           |

Les anciens préfixes `Add:` / `Update:` / `Fix:` restent acceptés dans
l'historique mais ne sont plus recommandés pour les nouvelles PR.

### Style de code

- Le projet utilise [ruff](https://docs.astral.sh/ruff/) pour le linting et le formatage.
- Configuration dans `pyproject.toml` : `line-length = 100`, cible `py311`.
- `make fmt` formate automatiquement le code.
- `make check` vérifie lint + couverture avant push.

### Tests

- Les tests sont dans `tests/` et utilisent [pytest](https://docs.pytest.org/).
- Le module `tracker/` doit maintenir **100% de couverture** (lignes).
- Les tests web légers utilisent le runner Node natif :
  `node --test tests/web/*.test.mjs`.
- Les tests d'intégration API utilisent `httpx` avec le `TestClient` FastAPI.
- Les endpoints `GET /api/export`, `POST /api/import` et `GET /api/health` doivent rester couverts.

### Intégration continue

- Chaque PR déclenche [`.github/workflows/ci.yml`](.github/workflows/ci.yml) :
  `ruff check`, `pytest --cov=tracker --cov-fail-under=100` sur Python
  **3.11 et 3.12**, puis un smoke-test `docker build` pour garantir que
  l'image reste publiable.
- Un tag `vX.Y.Z` déclenche [`.github/workflows/release.yml`](.github/workflows/release.yml) :
  création automatique de la Release GitHub (notes extraites du
  CHANGELOG) + push de l'image `ghcr.io/<owner>/pokevault:<semver>`.
- Dependabot met à jour pip / docker / github-actions une fois par mois.

### Données Pokédex

- `data/pokedex.json` est versionné et sert de source de référence pour l'UI
  et pour les tests end-to-end du filtrage de formes.
- `data/narrative-tags.json` est versionné avec les tags narratifs.
- Les fichiers d'état utilisateur restent gitignorés :
  `collection-progress.json`, `collection-cards.json`, `hunts.json`,
  `binder-config.json`, `binder-placements.json`, `profiles.json` et
  `profiles/<id>/...`.
- Toute modification du scraper doit être validée par `pytest tests/` puis
  idéalement par un `make fetch-test` pour ne pas casser le format.
- Cas sensibles à ne pas régresser :
  - Méganium (#0154) : le nom contient « mega » mais n'est **pas** une forme
    Méga. Cf. `tests/test_form_labels.py::test_meganium_name_is_not_mega_form`
    et `tests/tracker/test_export.py::test_is_mega_form_excludes_meganium_base`.
  - Zarbi (#0201) lettres, Arceus (#0493) types et Pikachu variantes.

### Front-end

- Le front est en **HTML/CSS/JS vanilla** (pas de framework, pas de build).
- Les fichiers sont dans `web/` et servis directement par FastAPI.
- La vue `#/print` doit rester légère et orientée impression (pas d'images).
- Toute évolution export/import doit mettre à jour `README.md` et `CHANGELOG.md`.

### GitHub Pages

- Le site public statique vit dans `docs/`.
- Il est volontairement sans build : HTML, CSS et JavaScript vanilla.
- Toute nouvelle page doit être couverte par `tests/test_docs_site.py`.
- Les liens internes du site doivent rester relatifs pour fonctionner sur
  GitHub Pages depuis le dossier `/docs`.

### Sécurité

Ne publie pas de faille de sécurité en issue publique. Consulte
[SECURITY.md](SECURITY.md) pour le canal de signalement et le périmètre.

## Structure des contributions

### Bug report

Ouvre une issue avec :
- Description du problème
- Étapes pour reproduire
- Comportement attendu vs obtenu
- Version de Python et OS

### Feature request

Ouvre une issue avec :
- Description de la fonctionnalité
- Cas d'usage concret
- Proposition d'implémentation (optionnel)

### Pull Request

- Une PR par fonctionnalité ou correction.
- Décris clairement ce que fait la PR.
- Assure-toi que `make check` passe.
- Les PR sont revues avant merge.

## Code de conduite

Ce projet adopte le [Contributor Covenant](CODE_OF_CONDUCT.md). En participant, tu t'engages à respecter ses termes.
