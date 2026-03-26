# Infographics Page

## What The Feature Does

Creates a standalone `infographics/infographics.html` page that showcases a curated subset of extracted paper figures. Each displayed image is paired with the corresponding figure metadata from its JSON file so viewers can see which PDF it came from, the page number, and other extraction details.

## Files To Change Or Create

- `docs/plans/infographics-page.md`
- `infographics/infographics.html`
- `tests/infographics_page_test.py`

## Implementation Steps

1. Add a regression test that expects `infographics/infographics.html` to exist and to reference selected extracted figure images plus their matching JSON metadata descriptions.
2. Review `infographics/figures_manifest.json` and choose a representative subset of figures from the available PDFs.
3. Build `infographics/infographics.html` as a lightweight static gallery that:
   - introduces the collection
   - renders selected figure images from `infographics/figures/`
   - shows metadata derived from the matching JSON files
   - keeps paths relative so it works inside the repository folder structure
4. Run the regression test again and confirm it passes.

## Risks Or Open Questions

- The extracted figure set currently includes duplicate Nature figures from two PDFs; the page should avoid surfacing duplicates unless they add value.
- Some extracted images may be logos or decorative assets rather than substantive figures, so selection should favor clearly useful paper graphics.
