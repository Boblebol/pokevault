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

### Front-end

- Le front est en **HTML/CSS/JS vanilla** (pas de framework, pas de build).
- Les fichiers sont dans `web/` et servis directement par FastAPI.

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
