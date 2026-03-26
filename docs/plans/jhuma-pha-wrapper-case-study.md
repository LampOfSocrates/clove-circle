## Feature

Add a new case study that wraps the original [PHA-from-lignocellulose-lca-tea.html](D:\S\Code\2026\clove-circle\jhuma_data\PHA-from-lignocellulose-lca-tea.html) model inside the Clove Circle site shell, matching the existing Jhuma laterite case-study pattern.

## What It Does

- Adds a second Jhuma-origin case study to `resources.html`.
- Creates a new wrapper page under `case_studies/` for the original PHA from lignocellulose model.
- Keeps the original model page in `jhuma_data/` as the source experience.
- Presents the model with the same Clove Circle navigation, banner, and footer treatment used by the laterite wrapper page.

## Files To Change Or Create

- `resources.html`
- `case_studies/case-study-jhuma-pha-original.html` (new)
- `tests/resources_case_study_test.py`
- `tests/site.test.js`

Optional, only if needed:

- `css/eco-theme.css`

## Implementation Steps

1. Add failing tests that assert:
   - `resources.html` includes a new case-study entry linking to the new wrapper page.
   - `case_studies/case-study-jhuma-pha-original.html` exists.
   - The wrapper page uses the standard Clove Circle case-study shell.
   - The wrapper page references or embeds `jhuma_data/PHA-from-lignocellulose-lca-tea.html`.
2. Run the tests and confirm they fail before implementation.
3. Create `case_studies/case-study-jhuma-pha-original.html` based on the structure of `case_studies/case-study-jhuma-original.html`.
4. Update the page copy, title, heading, and iframe metadata so they describe the PHA-from-lignocellulose model accurately.
5. Add a new case-study card to `resources.html` that links to the new wrapper page and clearly distinguishes it from the laterite model.
6. Make only minimal styling adjustments if the embedded model needs spacing or height refinements for responsiveness.
7. Run the updated tests again and confirm they pass.
8. Do a quick manual verification of the new wrapper page and the resources link.

## Risks Or Open Questions

- The original PHA page may have its own layout, scripts, or viewport assumptions that create nested scrolling or awkward height inside an iframe.
- If the source model title/copy differs from the desired public-facing label, the wrapper will need a clear naming choice to avoid confusion.
- If the embedded page behaves poorly on mobile, the wrapper may need a stronger standalone-launch treatment in addition to the iframe.
