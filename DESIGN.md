# Design System Document: The Laboratory Collector

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Pokedex Archive"**

This design system moves away from the playful, rounded aesthetics typically associated with the franchise. Instead, it adopts the persona of a high-end research tool—a "Laboratory Archive" for the serious collector. We achieve this through a "Tech-Noir Editorial" approach: combining ultra-precise typography, expansive dark-mode surfaces, and high-energy "Electric Blue" accents that cut through the charcoal abyss.

The layout breaks the traditional rigid grid by utilizing **intentional asymmetry**. Hero stats and rare card displays should feel like high-end editorial spreads, with overlapping "glass" containers and varying typographic scales that prioritize data density without sacrificing elegance.

### Brand Logo: Vault Binder

The Pokevault mark is a compact "Vault Binder" icon: a dark collector binder
with a cyan spine and a red clasp inspired by a Poke Ball. It should read first
as secure collection storage, then as Pokemon-adjacent through color and clasp
geometry. Avoid character silhouettes or franchise-style mascot shapes.

Use these source assets:

| Asset | Usage |
|-------|-------|
| `docs/assets/logo.svg` | README and larger documentation contexts |
| `docs/assets/logo-mark.svg` | GitHub Pages navigation mark |
| `docs/assets/favicon.svg` | GitHub Pages favicon |
| `web/assets/logo-mark.svg` | Local app topbar mark |
| `web/assets/favicon.svg` | Local app favicon |

The logo must stay geometric and SVG-native. Do not recreate it as a CSS
gradient square; use the asset so the app, docs and README keep the same brand
shape.

---

## 2. Colors & Surface Philosophy
The app ships four production palettes. They share the same semantic CSS
tokens, so components stay readable when the user changes themes. A theme is
allowed to change mood; it is not allowed to reduce contrast.

### Contrast Standard

- `--text` must reach at least WCAG AAA contrast (7:1) on `--bg`, `--card`,
  `--surface-low` and `--surface-high`.
- `--muted`, `--accent`, `--accent-strong` and `--electric` must reach at least
  WCAG AA contrast (4.5:1) on `--bg` and `--card`.
- Primary buttons use `--accent` with `--accent-ink`; that pair must also clear
  4.5:1.
- These requirements are enforced by `tests/test_theme_palettes.py`.

### Theme Tokens

Every theme must define this token set:

| Token | Role |
|-------|------|
| `--bg` | Page background |
| `--card` | Main panel/card surface |
| `--surface-low` | Nested or quiet surface |
| `--surface-high` | Hover/control surface |
| `--surface-highest` | Progress track and strongest neutral surface |
| `--accent` | Primary action and active state |
| `--accent-strong` | Gradient endpoint and warm emphasis |
| `--accent-ink` | Text/icon color on `--accent` |
| `--electric` | Secondary highlight, progress and data-viz line |
| `--text` | Primary text |
| `--muted` | Secondary text and labels |
| `--outline-soft` | Quiet component edge |
| `--outline-strong` | Stronger component edge |
| `--control-bg` | Inputs and low-emphasis buttons |
| `--control-border` | Default control border |
| `--control-hover` | Hover/focus border |
| `--success`, `--danger`, `--warning` | Status colors |

### Palettes

| Theme | Mood | Core colors |
|-------|------|-------------|
| Vault Lab | Default dark laboratory archive | Charcoal `#111418`, red-orange `#ff6b5f`, cyan `#36d5e8` |
| Kanto Archive | Warm open notebook / field guide | Parchment `#e5ceb0`, deep red `#9f1d2e`, badge blue `#075b9c` |
| Hoenn Deepsea | Night-sea research station | Abyss blue `#071522`, reef cyan `#4fd5df`, sea-glass `#6ee0b6` |
| Paldea Field Lab | Deep violet field kit | Aubergine `#17141f`, amber `#f2bd5b`, mint `#78ddc9` |

### Surface Rule
Prefer tonal layering over decorative outlines. Borders are allowed when they
improve scannability in dense tools, but they must use `--outline-soft` or
`--outline-strong`; avoid hard-coded white/black alpha borders in app surfaces.

### Gradient Rule
Use gradients only for active progress, primary actions and small status
signals. The standard gradient is `linear-gradient(90deg, var(--electric),
var(--accent-strong))` for progress and `var(--accent)` for primary controls.

---

## 3. Typography

We utilize a pairing of **Space Grotesk** (Display/Headlines) and **Inter** (UI/Body). Space Grotesk provides the "techy," monospaced-adjacent personality required for a professional tool, while Inter ensures maximum legibility for dense statistics.

| Level        | Font           | Size     | Usage                                       |
|-------------|----------------|----------|---------------------------------------------|
| Display-LG  | Space Grotesk  | 3.5rem   | Hero numbers, collection totals             |
| Headline-SM | Space Grotesk  | 1.5rem   | Set titles, major category headers          |
| Title-MD    | Inter          | 1.125rem | Card rarity, specific card numbers          |
| Label-MD    | Inter          | 0.75rem  | System metadata (ALL-CAPS, Tracking 5%)     |

**Typography as Brand Identity:** Numbers are the heart of a tracker. Always use `tabular-nums` for price and quantity data to ensure vertical alignment in lists, maintaining the "scientific" feel.

---

## 4. Elevation & Depth
Hierarchy is achieved through **Tonal Layering** rather than drop shadows.

### The Layering Principle

| Level         | Token                     | Hex       |
|---------------|---------------------------|-----------|
| Base          | `--bg`                    | Theme-specific |
| Sectioning    | `--card` / `--surface-low` | Theme-specific |
| Interactive   | `--surface-high`          | Theme-specific |

- **Ambient Shadows:** If a card must "float" (e.g., a card detail modal), use a highly diffused shadow: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)`. The shadow color should never be pure black; it should be a deep tint of the underlying surface.
- **The "Ghost Border" Fallback:** For accessibility in high-density data tables, use `--outline-soft`. It should be felt, not seen.

---

## 5. Components

### Cards (The "Specimen" Container)
- **Style:** Use `--card` for the card body and `--outline-soft` only when the edge improves scanning.
- **Interaction:** On hover, the card should transition toward `--surface-high` and scale subtly.
- **Spacing:** Content must have generous internal padding (1.5rem) to avoid the "toy-like" cramped feeling.

### Buttons (Tactile Triggers)
- **Primary:** Solid `--accent` background with `--accent-ink`. No rounded-pill shapes; use the `md` (0.375rem) corner radius for a more architectural look.
- **Secondary:** `--control-bg` background with `--text`.
- **Tertiary:** Transparent background with `--electric` text and a quiet edge that strengthens on hover.

### Status Toggles (The "Vault" Switch)
Replace standard iOS-style toggles with custom "Scanner" switches. When "Caught," the toggle should glow with an `--electric` inner shadow, mimicking a lit hardware button.

### Progress & Stats (Data Visualization)
- **Collection Bar:** Use a thin horizontal bar. The track should be `--surface-highest`, and the "Caught" portion should be the standard `--electric` to `--accent-strong` gradient.
- **Metric Blocks:** Avoid boxes. Place the number (Display-SM) directly on the surface, with a Label-SM description above it.

---

## 6. Design Principles

### Do
- **Use Asymmetry:** Place a large card image offset to the left, with metadata stacked in a tight, right-aligned column for an editorial look.
- **Embrace Negative Space:** Let the "Deep Charcoal" background breathe. High-end tools feel expensive because they aren't cluttered.
- **Focus on Stats:** Treat the collection progress with the same typographic weight as the specimen name.

### Don't
- **Don't use Divider Lines:** Never use a horizontal rule `<hr>` to separate list items. Use a 16px vertical gap or a subtle shift between theme surfaces.
- **Don't use Pure Black:** Avoid `#000000`. It kills depth and makes theme transitions harsher.
- **Don't use Rounded Pills:** Avoid `9999px` radius on buttons or cards. It feels too "Web 2.0" and playful. Stick to the `md` (0.375rem) or `lg` (0.5rem) scale.

---

## 7. Configuration Summary

| Property         | Value           |
|------------------|-----------------|
| Color Mode       | Themeable dark + light |
| Color Variant    | Contrast-first archive |
| Headline Font    | Space Grotesk   |
| Body Font        | Inter           |
| Label Font       | Inter           |
| Roundness        | Round 4 (0.25rem) |
| Spacing Scale    | 2 (Normal)      |
| Seed Color       | `#EE1515`       |
