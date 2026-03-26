# Plan: UI Refresh — Slicker Look & Feel with Better Color Management

## What This Does

Elevates the site from "professional and clean" to "premium and polished":

- Replaces the flat, single-green palette with a richer, more intentional design system
- Adds depth through layered shadows, glassmorphism, and subtle gradients
- Introduces typographic contrast (a serif/display heading font paired with Inter)
- Improves spacing rhythm and visual hierarchy
- Unifies the legacy pages (about, services, portfolio, pricing, contact) with the modern pages
- Does NOT change any content — purely cosmetic

---

## New Color System

The current palette is monochromatic green. We'll extend it with:

### Base Palette (CSS Custom Properties in `eco-theme.css`)

```css
:root {
  /* Brand Greens — existing but recalibrated */
  --cc-forest:       #1a3d2e;   /* replaces green-darkest — slightly warmer */
  --cc-pine:         #2a5c45;   /* replaces green-dark */
  --cc-sage:         #3d8b68;   /* replaces green-mid — primary CTA color */
  --cc-fern:         #6bbf93;   /* replaces green-light */
  --cc-mist:         #d4eddf;   /* replaces green-pale */
  --cc-frost:        #edf7f1;   /* replaces green-xlight */

  /* Neutrals — new, intentional scale */
  --cc-ink:          #111d17;   /* near-black with green undertone */
  --cc-slate:        #344a3c;   /* dark body text */
  --cc-stone:        #5e7a6a;   /* muted / secondary text */
  --cc-ash:          #a8bdb2;   /* disabled / placeholder */
  --cc-smoke:        #f4f8f5;   /* page background (slightly green-tinted white) */
  --cc-white:        #ffffff;

  /* Accent — a warm earthy gold for contrast pops */
  --cc-gold:         #c8973a;   /* highlights, badges, KPI numbers */
  --cc-gold-light:   #f5e4c3;   /* gold tint backgrounds */

  /* Semantic aliases */
  --cc-primary:      var(--cc-sage);
  --cc-primary-dark: var(--cc-pine);
  --cc-text:         var(--cc-slate);
  --cc-text-muted:   var(--cc-stone);
  --cc-bg:           var(--cc-smoke);
  --cc-surface:      var(--cc-white);

  /* Shadows — richer, directional */
  --cc-shadow-sm:    0 1px 4px rgba(26, 61, 46, 0.08);
  --cc-shadow-md:    0 4px 20px rgba(26, 61, 46, 0.12);
  --cc-shadow-lg:    0 12px 48px rgba(26, 61, 46, 0.18);
  --cc-shadow-xl:    0 24px 64px rgba(26, 61, 46, 0.22);

  /* Radii */
  --cc-radius-sm:    6px;
  --cc-radius:       12px;
  --cc-radius-lg:    20px;
  --cc-radius-pill:  999px;

  /* Transitions */
  --cc-transition:   0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Why gold?** The current all-green palette reads as competent but blends into eco-commodity territory. A warm gold accent adds a premium, consultancy feel — signalling expertise rather than just environmentalism.

---

## Files Changed or Created

| File | Change |
|------|--------|
| `css/eco-theme.css` | Full rewrite of the `:root` variables and all component styles |
| `index.html` | Minor class/markup tweaks for new components |
| `resources.html` | Minor class tweaks |
| `case_studies/case-study-pha-biocomposite.html` | Minor class tweaks |
| `about.html` | Port from Bootstrap 3 → Bootstrap 5 + eco-theme (legacy unification) |
| `services.html` | Same |
| `portfolio.html` | Same |
| `pricing.html` | Same |
| `contact.html` | Same |
| `css/style.css` | Archived / removed once legacy pages are ported |

**New file (optional):** `css/eco-theme.css` stays as the single source of truth. No extra CSS files.

---

## Implementation Steps

### Phase 1 — Design Token Migration (eco-theme.css only, no HTML changes)

1. Replace the `:root` variable block with the new palette above.
2. Do a find-replace pass to update every hard-coded hex in `eco-theme.css` to use the new variable names.
3. Verify modern pages (index, resources, case study) still render correctly — just with the recalibrated palette.

### Phase 2 — Component Polish (eco-theme.css)

4. **Navbar** — deepen the frosted glass: `backdrop-filter: blur(20px) saturate(180%)`, add a hairline bottom border `1px solid rgba(26,61,46,0.08)`. Use `--cc-ink` for nav links (higher contrast than current muted green).
5. **Hero section** — replace the flat gradient with a layered mesh gradient. Add a subtle noise texture overlay (CSS `filter` or SVG `feTurbulence`). Make the CTA buttons larger (48px height) with a pill radius (`--cc-radius-pill`).
6. **Stats bar** — switch from flat dark green to a dark-mode glass card row. Add `--cc-gold` for the stat numbers (currently `--cc-green-light` which gets lost). Add a subtle animated counter on scroll using IntersectionObserver.
7. **Service cards** — increase radius to `--cc-radius-lg`. Add a colored top border (`3px solid var(--cc-sage)`) per card. On hover: `translateY(-8px)` + `--cc-shadow-xl`. Add a micro icon animation (scale 1.1) on hover.
8. **Buttons** — redesign:
   - Primary: `--cc-sage` fill → white text, pill shape, 48px tall, with a subtle inner glow on hover
   - Outline: hairline `--cc-sage` border, transparent → on hover fill with `--cc-sage`
   - Ghost (new): for secondary actions in dark sections
9. **Section headers** — change the eyebrow from plain text to a pill badge: `background: var(--cc-gold-light)`, `color: var(--cc-gold)`, rounded, with a small leaf icon prefix.
10. **Footer** — change from flat dark green to an almost-black `--cc-ink` for more depth. Add a gradient top edge. Use `--cc-gold` for email link to pull the accent through.

### Phase 3 — Typography Upgrade

11. Import a display/heading font: **Fraunces** (Google Fonts — a modern optical serif with character, popular in premium brand sites). Pair: Fraunces for h1–h3, Inter for h4 and below + body.
12. Update heading `font-family`, adjust `font-weight` (Fraunces has beautiful italics — use for eyebrow subheads), update the hero title `clamp` to `clamp(2.2rem, 5vw, 3.5rem)`.
13. Tighten letter-spacing on headings (slightly negative: `-0.02em` on display sizes).

### Phase 4 — Legacy Page Unification

14. For each legacy page (about, services, portfolio, pricing, contact):
    - Swap the Bootstrap 3 CDN link for Bootstrap 5.3.3 (CDN)
    - Swap the old navbar markup for the standard `cc-navbar` component from `index.html`
    - Swap the old footer markup for the standard `cc-footer` component
    - Remove `style.css` import; the page will use `eco-theme.css` + Bootstrap 5 utilities
    - Fix any broken Bootstrap 3 classes (e.g., `col-xs-` → `col-`, `panel` → `card`)
    - Ensure all legacy page sections use `cc-section`, `cc-section-light`, or `cc-section-dark`
15. Delete or archive `css/style.css`, `css/bootstrap.min.css`, `css/font-awesome.css`, `js/custom.js` once all legacy pages are fully ported.

### Phase 5 — Micro-interactions & Polish

16. Add smooth page-in animation: sections fade-up on first scroll (`cc-reveal` class + IntersectionObserver in `site.js`).
17. Add CSS `@layer` to avoid specificity conflicts between Bootstrap 5 and eco-theme.
18. Audit dark sections for WCAG AA contrast with new colors (contrast checker pass).
19. Test on mobile — ensure pill buttons, new radius, and font don't break layouts.
20. Lighthouse pass for performance (check font loading, shadow paint cost).

---

## Risks & Open Questions

| Risk | Mitigation |
|------|-----------|
| Gold accent may feel off-brand for a pure eco consultancy | Start with gold only on KPI numbers + eyebrow badges — easy to swap if client dislikes it |
| Fraunces is a niche font — loading cost | Load only `wght@400;600;700;900` and `ital@1` axes; use `display=swap` |
| Bootstrap 3 → 5 migration on legacy pages may break JS plugins (FlexSlider, FancyBox) | Check if these plugins are actually used on visible pages; if not, simply remove them |
| `style.css` may have one-off rules not covered by eco-theme | Read through it before deleting; port any non-duplicated rules |
| Legacy pages may have content that doesn't fit the new grid | Do a visual review pass of each page post-migration |

---

## Deliverable

A single unified design system with:
- One CSS file (`eco-theme.css`) driving all pages
- A richer, premium color palette with intentional accent usage
- A display typeface that elevates the brand
- Consistent navbar + footer across all 8 pages
- Smooth micro-interactions and polished component states
