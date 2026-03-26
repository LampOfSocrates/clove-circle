## Feature

Add a third case study to the Resources page that links to the original `jhuma_data/laterite-lca-tea.html` model, but present it through a Clove Circle case-study page with consistent site banners, navigation, and footer.

## What It Does

- Adds a new third case-study card to `resources.html`.
- Creates a new wrapper page under `case_studies/` for the original Jhuma laterite model.
- The wrapper page keeps Clove Circle site chrome consistent with the other case studies.
- The original `jhuma_data/laterite-lca-tea.html` remains the source experience for the calculator content.

## Files To Change Or Create

- `resources.html`
- `case_studies/case-study-jhuma-original.html` (new)
- `tests/site.test.js`
- `tests/resources_case_study_test.py`

Optional, only if needed for styling consistency:

- `css/eco-theme.css`

## Implementation Steps

1. Add failing tests that assert:
   - `resources.html` includes a third case-study entry linking to the new wrapper page.
   - The new wrapper page exists under `case_studies/`.
   - The wrapper page includes standard Clove Circle navigation/banner structure.
   - The wrapper page references or embeds `jhuma_data/laterite-lca-tea.html`.
2. Run the tests and confirm they fail before implementation.
3. Create `case_studies/case-study-jhuma-original.html` using the established case-study shell pattern from the existing case studies.
4. Embed or frame the original `jhuma_data/laterite-lca-tea.html` inside the wrapper so users access the original calculator while staying within consistent site chrome.
5. Add the third case-study card to `resources.html` with copy that clearly distinguishes it from the simplified and adapted laterite case study.
6. Add only minimal styling adjustments if the embedded page needs spacing, sizing, or responsive fixes.
7. Run the updated tests again and confirm they pass.
8. Do a quick manual check in the browser to verify the page opens correctly and the layout is consistent on desktop/mobile widths.

## Risks Or Open Questions

- The original `jhuma_data/laterite-lca-tea.html` has its own full-page styling and layout, so embedding it may create nested-scroll or height issues.
- If iframe embedding behaves poorly on mobile, the fallback may need a prominent launch/open treatment while still keeping the wrapper page visually consistent.
- The original page may visually clash with the surrounding chrome; the plan assumes that keeping Clove Circle header/footer around it is sufficient for consistency.
