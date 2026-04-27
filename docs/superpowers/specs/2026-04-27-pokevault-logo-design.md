# Pokevault Logo Design

## Goal

Create a small, reusable Pokevault logo for the app, documentation site,
GitHub Pages and README. The logo should make the product feel like a
collector-first local vault for physical Pokemon cards and binders.

## Chosen Direction

Use the **Vault Binder** direction selected in the visual companion.

The mark is a compact square icon showing a dark binder or vault with:

- a charcoal book body;
- a cyan binder spine;
- a red clasp inspired by a Poke Ball;
- a light center button for recognizability at small sizes.

This direction was chosen because it directly communicates collection storage,
physical binder organization and the "vault" naming without needing extra text.

## Visual System

Reuse the existing Pokevault colors so the logo belongs naturally in both the
web app and the GitHub Pages site:

- charcoal surface: `#232323`;
- app red: `#ff5544`;
- soft coral: `#ffb4a9`;
- electric cyan: `#00daf3`;
- light foreground: `#f0f0f0`;
- dark cut lines: `#141414`.

The mark should use simple geometric paths, no bitmap dependency and no external
font. It must stay readable as a favicon, nav mark and README image.

## Assets

Add source SVG assets under `docs/assets/`:

- `logo.svg`: main square mark for docs and README;
- `logo-mark.svg`: compact mark used by the app and docs navigation;
- `favicon.svg`: favicon target using the same geometry.

Add runtime app copies under `web/assets/` because the local FastAPI app serves
`web/` as its static root:

- `logo-mark.svg`: compact mark used by the app topbar;
- `favicon.svg`: app favicon.

The app and docs should use file assets instead of recreating the mark in CSS.

## Integration

- Replace the current generated docs `.brand-mark` gradient square with the SVG
  logo in every docs page header.
- Add the logo to the web app topbar before the `pokevault` wordmark.
- Add favicon links to the app and docs pages.
- Add a centered logo block near the top of `README.md`, above or near the main
  screenshot, so GitHub renders the project identity clearly.

## Verification

Run the existing docs tests to ensure local asset references resolve. Also do a
quick visual inspection of the SVG markup and affected HTML/CSS to confirm the
logo scales cleanly in the app topbar, docs navigation and README context.
