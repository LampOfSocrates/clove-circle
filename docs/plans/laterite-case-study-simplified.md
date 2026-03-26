# Laterite Case Study Simplification And Interactive Inputs

## What the feature does
Extends the new public laterite case-study page so it is less text-heavy and more useful as a lightweight interactive explainer. Users will be able to change a small, curated set of inputs and see the key mass-balance, GWP, and TEA outputs update on the page.

The page will remain simpler than the original source dashboard. It will not expose every spreadsheet input or every engineering table, but it will let users explore the main cause-and-effect relationships directly.

## Files that will be changed or created
- `case-study-laterite-lca-tea.html`
- `resources.html` if card copy needs to reflect that the page is interactive rather than static
- `tests/site.test.js`
- `js/laterite-case-study.js` (new)
- `docs/plans/laterite-case-study-simplified.md`

## Implementation steps
1. Add failing tests that confirm the laterite page includes the interactive script and key interactive labels or element IDs.
2. Refactor `case-study-laterite-lca-tea.html` to reduce narrative density:
   - tighten intro copy
   - replace some explanatory paragraphs with compact cards, toggles, or summary rows
   - preserve source attribution and limits in shorter form
3. Add a small input panel to the page with a curated set of user-editable inputs:
   - dry feed rate
   - moisture content
   - solids concentration
   - FeSO4 dosage for Mn oxides concentrate
   - reagent price
   - electricity price
   - heat price
   - critical metals price
4. Implement a dedicated `js/laterite-case-study.js` file that recalculates a simplified subset of the source model when inputs change.
5. Update the page so the following outputs refresh live:
   - wet feed
   - bulk coarse laterite
   - bulk fine laterite
   - Mn oxides concentrate
   - bioleach volume
   - FeSO4 use
   - total GWP per kg NCL
   - total capital investment
   - total opex
   - net margin
6. Keep the interaction intentionally scoped:
   - no full tabbed engineering dashboard
   - no full spreadsheet table replication
   - at most one compact visual summary section for process flow and one for key metrics
7. Update resources card copy only if needed so the page is described as interactive rather than just an explainer.
8. Run tests again and confirm they pass.

## Risks or open questions
- The main risk is drifting too close to the full source calculator and losing the simplicity goal. The implementation should keep only the highest-signal inputs and outputs.
- Some TEA values on the current page are narrative defaults rather than computed values, so the new JS must clearly use one coherent simplified calculation path.
- If the page becomes too script-heavy inline, move all logic to `js/laterite-case-study.js` rather than embedding large scripts in the HTML.
