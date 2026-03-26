# Improve Infographics Page

## What The Feature Does

Updates `infographics/infographics.html` so it feels like a first-class site page instead of a standalone file-local gallery. The page will keep the same top navbar and page-header treatment as `references.html`, reduce the gallery to the first two selected figures, and present each figure's metadata in a cleaner format that includes the actual paper title derived from the source PDF itself.

## Files That Will Be Changed Or Created

- `docs/plans/improve-infographics-page.md`
- `infographics/infographics.html`
- `tests/infographics_page_test.py`

## Implementation Steps

1. Inspect the current infographics page and the `references.html` page structure so the infographics page can mirror the same top navbar and page-header shell.
2. Add or update a regression test that expects:
   - the shared top navbar/header treatment
   - only the first two gallery columns/cards to remain
   - cleaner metadata presentation
   - the actual paper titles, sourced from the PDFs rather than the raw JSON blob alone
3. Inspect the relevant PDFs and extract the paper titles from the document text or metadata so the displayed source names are human-readable and accurate.
4. Refactor `infographics/infographics.html` to:
   - use the site header/navigation pattern from `references.html`
   - retain the resource navigation buttons
   - show only the first two selected figure cards
   - replace the raw JSON dump with a nicer metadata block while still surfacing the JSON-derived details
5. Run the updated regression test and confirm it passes.

## Risks Or Open Questions

- Some PDFs may have weak or noisy embedded metadata, so the implementation may need to prefer the visible first-page title text over document metadata when available.
- Because the page lives in `infographics/`, relative asset paths must be handled carefully when reusing the shared site banner structure from root-level pages.
- If the branch must literally be `main` before implementation, that branch change should happen before editing begins.
