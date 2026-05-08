# Maquette V1 Design Integration

Date: 2026-05-08
Branch: `feature/maquette-v1-design`
Reference: `maquette/maquette_v1.html`

## Goal

Apply the visual design from `maquette/maquette_v1.html` to the whole Pokevault web app with near pixel-perfect fidelity at a 1280px desktop reference viewport, while keeping the current vanilla JavaScript architecture and all existing product behavior.

## Decisions

- Keep the app in vanilla JavaScript. Do not migrate the UI to React.
- Treat the maquette as a strict visual reference for colors, spacing, typography, proportions, shell density, panels, cards, and modals.
- Redesign the whole application, not only stats and badges.
- Split `Badges` and `Statistiques` into fully separate pages and routes.
- Keep all existing functionality and restyle/reorganize it into the maquette language.
- Use a single `Vault Lab` theme. Remove the current multi-theme system for this pass.
- Integrate `Barlow` and `Space Mono` locally. Do not add external font requests.
- Keep FR/EN support. Any new user-facing copy must be translated.
- Keep Pokémon and badge details as modals, not dedicated detail pages.

## Routes And Navigation

Desktop navigation order:

1. `#/liste` - Collection
2. `#/classeur` - Classeurs
3. `#/dresseurs` - Dresseurs
4. `#/badges` - Badges
5. `#/stats` - Statistiques
6. `#/print` - Impression
7. `#/docs` - Docs
8. `#/settings` - Réglages

Desktop shell:

- Topbar around the maquette density, approximately 48px tall.
- Logo and `POKÉVAULT` identity on the left.
- Uppercase mono nav tabs.
- Active nav uses cyan underline and cyan text.
- FR/EN language switch stays on the right.
- Background uses the dark Vault Lab base and subtle dot grid.

Mobile navigation:

- Bottom nav with five entries: `Collection`, `Classeurs`, `Badges`, `Stats`, `Plus`.
- `Plus` opens access to `Dresseurs`, `Impression`, `Docs`, and `Réglages`.
- Mobile shell keeps the maquette bottom-nav pattern rather than fitting all eight pages into a cramped tab bar.

## Design System

Use the maquette `Vault Lab` design language as the app's single visual foundation.

Core tokens:

- `--pdx-bg`: `#090E1A`
- `--pdx-panel`: `#111827`
- `--pdx-panel-hi`: `#1A2438`
- `--pdx-border`: `#1E2C42`
- `--pdx-border-hi`: `#2A3E5C`
- `--pdx-red`: `#CC1133`
- `--pdx-red-dark`: `#891022`
- `--pdx-cyan`: `#00CCEE`
- `--pdx-green`: `#00CC77`
- `--pdx-amber`: `#F5A623`
- `--pdx-text`: `#DDE6F0`
- `--pdx-text-dim`: `#5C7099`
- `--pdx-text-faint`: `#2D3C55`

Typography:

- `Barlow` for general UI.
- `Space Mono` for nav, counters, technical labels, status text, and compact metadata.
- Font files must be served locally from the app.

Component language:

- Panels use 4-8px radius, fine borders, dark fills, and restrained highlights.
- Buttons use primary red/cyan treatments and ghost bordered treatments.
- Inputs and selects use dark backgrounds, thin borders, and cyan focus states.
- KPI cards use mono labels, strong numeric values, and compact supporting text.
- Progress bars use stacked or single fills matching the maquette.
- Modal surfaces use dark overlays, bordered panels, compact close controls, and maquette-style headings.
- Badge tiles and Pokémon cards retain current data richness while using the maquette visual proportions.

Removed or neutralized:

- `web/themes.js` as a multi-theme runtime.
- Theme selector in Settings.
- CSS blocks for `html[data-theme="kanto"]`, `html[data-theme="hoenn"]`, and `html[data-theme="paldea"]`.
- Tests that require multiple palettes; replace them with checks for the single Vault Lab token set and local fonts.

## Page Designs

### Collection

Use the maquette collection structure: contextual rail on the left and Pokémon grid on the right.

Keep:

- Search.
- Status filters.
- Region, type, and form filters.
- Dim mode.
- Narrative tags.
- Infinite/list pagination behavior.
- Pokémon cards and capture/duplicate/release actions.
- Pokémon detail modal.
- Legacy `#/pokemon/...` route compatibility opening the modal.

### Classeurs

Restyle the existing binder workflow into maquette panels.

Keep:

- Binder list/sidebar.
- Active binder selection.
- Page/face navigation.
- Physical binder grid.
- Family reserved and alignment slots.
- Wizard/edit format flows.
- Debug JSON areas, but move them into secondary panels/details and restyle them.
- Print/binder data compatibility.

### Dresseurs

Restyle trainer cards and contact management in the maquette language.

Keep:

- Local trainer card.
- Import/export.
- Contacts list.
- Private notes.
- Social links.
- Duplicate/trade lists.
- Existing validation and API behavior.

### Badges

Create a new autonomous `#/badges` page.

Keep:

- Complete badge gallery.
- Status, category, and region filters.
- Locked/sealed badge behavior.
- Unlocked badge presentation.
- Requirements previews.
- Badge detail modal on click.
- Battle dossier, variants, team cards, moves, weaknesses, resistances, and immunities.
- Badge unlock toast behavior.

Remove from `#/stats`:

- The badge gallery section.

### Statistiques

Make `#/stats` purely analytical.

Keep:

- Global KPIs.
- Regional progression.
- Type completion/distribution.
- Collection scope behavior matching the collection.
- Empty states.

Do not render badge gallery content in this route.

### Impression

Extrapolate a full Vault Lab design from the maquette because the maquette only contains a print placeholder.

Keep:

- Binder selector.
- Checklist and binder page modes.
- Search/filter behavior.
- Placeholder page rendering.
- Artwork options.
- Print summary and preview.

### Docs

Extrapolate a Vault Lab docs layout because the maquette has no complete docs page.

Use:

- Structured panels.
- Compact headings.
- Scannable sections.
- Existing FR/EN content.

Avoid turning docs into a marketing page.

### Réglages

Restyle Settings with maquette panels and remove multi-theme controls.

Keep:

- Language support.
- Relevant display controls.
- Export/import.
- Version and API health.
- Current post-`origin/main` profile behavior.

Remove:

- Theme selector.
- Any stale multi-profile UI that no longer exists after the upstream removal.

## Accessibility And Interaction

- Navigation links update `aria-current`.
- Mobile `Plus` is keyboard usable and screen-reader labelled.
- Pokémon and badge modals are closeable by visible close button and existing supported dismissal behavior.
- Filter groups keep accessible labels.
- Interactive cards and badge tiles preserve focus styles.
- Color contrast must remain readable against Vault Lab surfaces.

## Verification

Run after major implementation blocks:

- `make web-test`
- `make test`

Add or update web tests for:

- `#/badges` route recognition.
- Desktop nav order.
- Mobile bottom nav and `Plus` menu contents.
- `#/stats` rendering stats without badge gallery.
- `#/badges` rendering gallery and filters.
- Removal or neutralization of the multi-theme runtime.
- No external font requests.

Visual verification:

- Start the app with `make dev` on a free port.
- Compare against `maquette/maquette_v1.html` at approximately 1280px width.
- Check responsive layouts at 768px and 390px.
- Focus comparison on shell, navigation, Collection, Badges, and Statistiques first; then Classeurs, Dresseurs, Impression, Docs, and Réglages.

## Implementation Approach

Use a design-system-first sequence:

1. Add local fonts and Vault Lab tokens.
2. Replace app shell and navigation.
3. Split Badges from Stats.
4. Apply shared component styling.
5. Restyle pages one by one while preserving behavior.
6. Remove multi-theme UI/runtime.
7. Update tests and perform visual verification.

