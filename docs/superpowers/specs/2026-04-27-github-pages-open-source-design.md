# GitHub Pages Open Source Site Design

## Goal

Create a zero-build GitHub Pages site under `docs/` that presents Pokevault as
a polished open-source project: clear value proposition, installation path,
feature overview, architecture explanation, roadmap status and contribution
guidance.

## Approach

The site is a static HTML/CSS/JS layer, deployed from the repository `docs/`
folder. It reuses the application's Tech-Noir visual language: charcoal
surfaces, compact typography, electric blue accents and the existing product
screenshots. It does not introduce Jekyll, Node, bundlers or runtime
dependencies.

## Pages

- `docs/index.html`: landing page with hero, screenshots, feature summary,
  quick start, local-first promise and GitHub CTA.
- `docs/features.html`: detailed product capabilities.
- `docs/install.html`: prerequisites, local install, Docker, data files,
  backup/restore and troubleshooting.
- `docs/architecture.html`: CLI scraper, FastAPI API, vanilla SPA, JSON
  persistence, profiles and export/import model.
- `docs/roadmap.html`: shipped RICE roadmap, post-1.0 work and postponed
  backlog.
- `docs/contributing.html`: contribution workflow, quality bar, issue/PR flow
  and security link.

## Shared Assets

- `docs/assets/site.css`: page layout, typography, navigation, hero, responsive
  sections and reusable content components.
- `docs/assets/site.js`: progressive enhancement for active nav and small
  copy-to-clipboard buttons on command snippets.
- `docs/.nojekyll`: keeps GitHub Pages from applying Jekyll transforms.

## Open Source Documentation

The existing README, roadmap, changelog, license and code of conduct remain the
source of truth for repository documentation. The site links to those files
instead of duplicating every detail. Add `SECURITY.md` so public users have a
clear responsible-disclosure path.

## Verification

Add a static docs test that checks every expected page exists, every local
`href`/`src` target resolves, core navigation labels are present, and
`SECURITY.md` exists. Run the full project checks after implementation.
