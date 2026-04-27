# Releasing Pokevault

Pokevault uses semantic versioning and publishes releases from annotated Git
tags named `vX.Y.Z`.

## Version Surfaces

Update all public version surfaces in the same pull request:

- `pyproject.toml` — Python package metadata
- `tracker/version.py` — local API `/api/health`
- `web/app.js` — static UI version badge
- `README.md` — version badge
- `docs/*.html` — GitHub Pages footer labels
- `CHANGELOG.md` — release notes section

Run the version consistency test before opening the PR:

```bash
uv run pytest tests/tracker/test_version.py -q
```

## Release Checklist

1. Move user-facing entries from `[Unreleased]` into a dated
   `## [X.Y.Z] — YYYY-MM-DD` section in `CHANGELOG.md`.
2. Run the full local verification:

   ```bash
   uv run ruff check pokedex/ tracker/ main.py tests/
   uv run pytest tests/ --cov=tracker --cov-report=term-missing --cov-fail-under=100
   node --test tests/web/*.test.mjs
   git diff --check
   ```

3. Merge the release PR into `main` after GitHub Actions is green.
4. Create and push an annotated tag from `main`:

   ```bash
   git switch main
   git pull --ff-only origin main
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

5. Confirm the `Release` workflow publishes:

   - a GitHub Release with the matching changelog notes;
   - GHCR images tagged `X.Y.Z`, `X.Y`, `X` and `latest` for stable releases.

6. Verify the repository release page and container image:

   ```bash
   gh release view vX.Y.Z
   docker pull ghcr.io/boblebol/pokevault:X.Y.Z
   ```

## Backfilling Old Tags

If a tag exists but the GitHub Release is missing, create the release from the
matching changelog section without moving the tag. Do not retag public versions.
