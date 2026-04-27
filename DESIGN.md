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
The palette is rooted in a deep, monochromatic foundation, allowing the iconic Red and Electric Blue to function as functional beacons rather than just decorative elements.

### The Palette (Material Design Tokens)

| Token                | Hex       | Role                                              |
|----------------------|-----------|---------------------------------------------------|
| Primary              | `#ffb4a9` | Brand pulse. Critical actions and high-value status |
| Primary Container    | `#ff5544` | CTA gradients, active highlights                   |
| Secondary            | `#b9c9d3` | Subdued slate for supporting UI elements           |
| Tertiary             | `#00daf3` | "Electric Blue" — interactive accents, data viz    |
| Surface / Background | `#131313` | Core "Ink" of the interface                        |
| On-Surface           | `#e5e2e1` | Primary text on dark backgrounds                   |
| Error                | `#ffb4ab` | Destructive actions and warnings                   |
| Outline              | `#af8782` | Subtle decorative accents                          |
| Outline Variant      | `#5e3f3a` | Ghost borders (15% opacity only)                   |

### Full Color Map

```
background:               #131313
surface:                  #131313
surface-dim:              #131313
surface-bright:           #393939
surface-container-lowest: #0e0e0e
surface-container-low:    #1c1b1b
surface-container:        #201f1f
surface-container-high:   #2a2a2a
surface-container-highest:#353534

primary:                  #ffb4a9
primary-container:        #ff5544
primary-fixed:            #ffdad5
primary-fixed-dim:        #ffb4a9
on-primary:               #690002
on-primary-container:     #5c0001

secondary:                #b9c9d3
secondary-container:      #3c4b53
on-secondary:             #23323a

tertiary:                 #00daf3
tertiary-container:       #009fb2
on-tertiary:              #00363d

error:                    #ffb4ab
error-container:          #93000a
on-error:                 #690005

on-surface:               #e5e2e1
on-surface-variant:       #e9bcb6
outline:                  #af8782
outline-variant:          #5e3f3a
```

### The "No-Line" Rule
**Standard 1px borders are strictly prohibited.** To section content, you must use **Tonal Transitions**. A card does not have an outline; it is a `surface-container-low` element resting on a `surface` background. This creates a more organic, premium feel that mimics high-end hardware interfaces.

### The "Glass & Gradient" Rule
Floating panels and high-priority card overlays must utilize **Glassmorphism**. Use a semi-transparent `surface-variant` with a `backdrop-filter: blur(20px)`. To add "soul" to the techy aesthetic, apply a subtle linear gradient to main CTAs, transitioning from `primary` to `primary-container` at a 135-degree angle.

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
| Base          | `surface`                 | `#131313` |
| Sectioning    | `surface-container-low`   | `#1c1b1b` |
| Interactive   | `surface-container-high`  | `#2a2a2a` |

- **Ambient Shadows:** If a card must "float" (e.g., a card detail modal), use a highly diffused shadow: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)`. The shadow color should never be pure black; it should be a deep tint of the underlying surface.
- **The "Ghost Border" Fallback:** For accessibility in high-density data tables, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Cards (The "Specimen" Container)
- **Style:** No borders. Use `surface-container-lowest` for the card body.
- **Interaction:** On hover, the card should transition to `surface-container-highest` and scale by 1.02x.
- **Spacing:** Content must have generous internal padding (1.5rem) to avoid the "toy-like" cramped feeling.

### Buttons (Tactile Triggers)
- **Primary:** Solid `primary` background. No rounded-pill shapes; use the `md` (0.375rem) corner radius for a more architectural look.
- **Secondary:** `surface-container-high` background with `on-surface` text.
- **Tertiary:** Transparent background with `tertiary` (Electric Blue) text and a `0.75rem` bottom border (accent line) that expands on hover.

### Status Toggles (The "Vault" Switch)
Replace standard iOS-style toggles with custom "Scanner" switches. When "Caught," the toggle should glow with a `tertiary-container` inner shadow, mimicking a lit hardware button.

### Progress & Stats (Data Visualization)
- **Collection Bar:** Use a thin, 2px horizontal bar. The "Missing" portion should be `surface-variant`, and the "Caught" portion should be a gradient of `tertiary`.
- **Metric Blocks:** Avoid boxes. Place the number (Display-SM) directly on the surface, with a Label-SM description above it.

---

## 6. Design Principles

### Do
- **Use Asymmetry:** Place a large card image offset to the left, with metadata stacked in a tight, right-aligned column for an editorial look.
- **Embrace Negative Space:** Let the "Deep Charcoal" background breathe. High-end tools feel expensive because they aren't cluttered.
- **Focus on Stats:** Treat the collection progress with the same typographic weight as the specimen name.

### Don't
- **Don't use Divider Lines:** Never use a horizontal rule `<hr>` to separate list items. Use a 16px vertical gap or a subtle shift from `surface-container-low` to `surface-container-lowest`.
- **Don't use Pure Black:** Avoid `#000000`. It kills the depth. Use the `surface` token (#131313) to allow for subtle shadows.
- **Don't use Rounded Pills:** Avoid `9999px` radius on buttons or cards. It feels too "Web 2.0" and playful. Stick to the `md` (0.375rem) or `lg` (0.5rem) scale.

---

## 7. Configuration Summary

| Property         | Value           |
|------------------|-----------------|
| Color Mode       | Dark            |
| Color Variant    | Fidelity        |
| Headline Font    | Space Grotesk   |
| Body Font        | Inter           |
| Label Font       | Inter           |
| Roundness        | Round 4 (0.25rem) |
| Spacing Scale    | 2 (Normal)      |
| Seed Color       | `#EE1515`       |

---

*Design system generated from [Google Stitch](https://stitch.googleapis.com/) — Project "Pokémon Card Tracker"*
