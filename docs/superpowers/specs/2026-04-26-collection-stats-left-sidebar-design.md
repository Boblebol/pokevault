# Collection and Stats Left Sidebar Design

## Context

The Collection view currently stacks the hero, progress, search, status filters,
region chips, narrative chips, and advanced filters above the Pokémon grid. On
normal laptop heights this consumes enough vertical space that only one clear row
of Pokémon cards remains visible. The Binder and Print views already solve this
with a two-column shell: a left navigation rail and a main content area.

The selected direction is option A from the visual companion: move Collection
controls into a persistent left rail and apply the same layout principle to
Statistics.

## Goals

- Show more Pokémon rows above the fold in `#/liste`.
- Keep Collection filters immediately visible without hiding them behind a menu
  on desktop.
- Make `#/stats` visually consistent with `#/classeur` by using a left rail for
  scope and summary controls.
- Preserve the existing filter behavior, deep links, localStorage preferences,
  keyboard shortcuts, and infinite scroll behavior.
- Collapse to a single-column layout under the existing binder breakpoint
  (`980px`) so mobile remains readable.

## Non-Goals

- No new filter semantics.
- No API changes.
- No redesign of individual Pokémon cards or stat cards.
- No route changes.
- No replacement of the current vanilla JavaScript architecture.

## Collection Layout

`#viewListe` will keep the top page header with title and display-count copy,
but the bulky interactive controls move below it into a two-column shell:

- Left rail: progress summary, search input, status filters, region chips,
  narrative chips, form/type/dim controls, sync hint, keyboard help trigger.
- Main column: Pokémon grid, scroll sentinel, and end-of-list copy.

The rail should reuse the Binder visual language where practical: 280px desktop
width, low-surface panel, compact uppercase section labels, active state with
electric accent, and a grid gap matching the Binder shell. The search input stays
in the rail so the main column begins directly with the Pokémon grid.

The existing element ids remain unchanged (`search`, `regionChips`, `grid`,
`listScrollSentinel`, etc.) so `web/app.js` can continue wiring behavior by id.
The only required JavaScript adjustment is defensive selector scoping for status
filter buttons if a new stats filter group is added later.

## Stats Layout

`#viewStats` will become a two-column shell:

- Left rail: compact global completion summary plus scope controls aligned with
  Collection's current scope state. The first implementation only needs a
  read-only "scope" summary and a reminder that stats follow the Collection form
  scope via `poolForCollectionScope()`. It does not introduce independent stats
  filters.
- Main column: existing `statsBody` and `statsBadges` blocks.

This keeps the expensive visual hero out of the top-only stack and makes the
statistics page feel like the same app family as Binder and Collection. The
current `stats-view.js` rendering can remain mostly intact; the page structure
changes in `index.html` and CSS.

## Responsive Behavior

At widths above `980px`, Collection and Stats use:

```css
grid-template-columns: 280px minmax(0, 1fr);
```

At `980px` and below, the rail stacks above the main column. Controls remain
visible in normal document flow; no drawer or overlay is introduced in this pass.

## Accessibility

- Existing form labels and aria labels stay attached to their controls.
- The status filter group keeps `aria-pressed`.
- The grid remains `aria-live="polite"`.
- The stats rail summary uses plain text and does not duplicate dynamic
  announcements already handled in the main stat body.
- Keyboard help remains reachable through the existing `kbHelpTrigger`.

## Test and Verification Scope

- Static smoke test: load `#/liste`, `#/stats`, `#/classeur`, and `#/print`.
- Functional checks: search, status filters, region chips, narrative chips,
  type/form/dim selects, route region deep link, infinite scroll, and stats
  updates after toggling a Pokémon.
- Responsive checks: desktop width, 980px breakpoint, and mobile width.
- Regression check: Binder and Print shells still use the existing two-column
  layout and are not visually broken by shared shell CSS.
