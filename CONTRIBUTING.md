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
```

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

Préfixes recommandés :

| Préfixe    | Usage                          |
|------------|--------------------------------|
| `Add:`     | Nouvelle fonctionnalité        |
| `Fix:`     | Correction de bug              |
| `Update:`  | Amélioration d'une feature     |
| `Refactor:`| Refactoring sans changement fonctionnel |
| `Docs:`    | Documentation uniquement       |
| `Test:`    | Ajout ou modification de tests |

### Style de code

- Le projet utilise [ruff](https://docs.astral.sh/ruff/) pour le linting et le formatage.
- Configuration dans `pyproject.toml` : `line-length = 100`, cible `py311`.
- `make fmt` formate automatiquement le code.
- `make check` vérifie lint + couverture avant push.

### Tests

- Les tests sont dans `tests/` et utilisent [pytest](https://docs.pytest.org/).
- Le module `tracker/` doit maintenir **100% de couverture** (lignes).
- Les tests d'intégration API utilisent `httpx` avec le `TestClient` FastAPI.
- Les endpoints `GET /api/export`, `POST /api/import` et `GET /api/health` doivent rester couverts.

### Données Pokédex

- `data/pokedex.json` est versionné et sert de source de référence pour l'UI
  et pour les tests end-to-end du filtrage de formes.
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
