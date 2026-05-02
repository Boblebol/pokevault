# FR/EN Switch Design

## Goal

Add a lightweight French/English switch for the public landing and the web app, with French as the default and no extra runtime dependency.

## Scope

- The public GitHub Pages landing must expose a visible `FR | EN` language switch.
- The app must expose the same switch in the topbar.
- The selected language must be stored locally and reused by both surfaces.
- User-visible UI text must be translated on the main product surfaces: navigation, titles, filters, buttons, onboarding, empty states, binder/trainer/stat/print/settings labels, common errors and dynamic module labels.
- Pokemon data stays data-driven. Pokemon names, region data and stored user notes are not translated artificially.

## Architecture

- `web/i18n.js` owns the app runtime dictionary, locale storage, `t(key, params)`, DOM hydration through `data-i18n*` attributes and locale subscriptions.
- `docs/assets/i18n.js` owns the static docs/landing dictionary and uses the same local storage key.
- HTML keeps French fallback text in markup. JavaScript replaces it only when the locale is `en` or when dynamic text is rendered.
- Dynamic modules read `window.PokevaultI18n?.t` through a small local fallback helper so tests and old pages keep working if i18n is absent.

## UX

- French is the default for first launch.
- The switch is a compact segmented control labelled `FR` and `EN`.
- No onboarding step asks for language.
- Changing language updates the current page immediately and dispatches a small locale-change event for modules that render dynamic text.

## Testing

- Docs tests verify the landing loads the docs i18n runtime, keeps French fallback copy, exposes the switch and includes English copy in the dictionary.
- Web tests verify default locale, persistence, fallback to French for unknown keys, parameter interpolation and DOM attribute hydration.
- Existing module tests stay focused on business behavior; targeted assertions are updated only where translated labels are intentionally surfaced.
