# Move References To Own Page

## What the Feature Does

This change separates the References content from the current multi-tab [resources.html](D:\S\Code\2026\clove-circle\resources.html) page into a dedicated [references.html](D:\S\Code\2026\clove-circle\references.html) page.

The result should be:

- `resources.html` remains the landing page for case studies and other resource categories.
- The references list, search input, and word cloud move to `references.html`.
- Navigation and internal links are updated so users can reach the references page directly.
- Existing styling and shared behavior continue to work without duplicating unnecessary code.

## Files That Will Be Changed Or Created

- Create `references.html`
- Update `resources.html`
- Update `js/site.js` only if page-specific behavior needs to account for the new page
- Update `tests/resources_case_study_test.py` if resource page assertions need to change
- Add or update a test for `references.html`
- Update any related documentation if page paths or structure references change

## Implementation Steps

1. Review `resources.html` and identify the exact markup and behaviors that belong exclusively to the References tab.
2. Write failing tests first:
   - Add a test asserting that `references.html` contains the references table/search/word cloud elements.
   - Update or add a test asserting that `resources.html` links to `references.html` instead of embedding the references section inline.
3. Create `references.html` using the site’s shared page structure and move the References content into it.
4. Remove the inline References tab content from `resources.html` and replace it with a clear link or CTA to `references.html`.
5. Update navigation, active-link states, and any page-to-page links so both pages are reachable and consistent.
6. If any JavaScript currently assumes the references UI lives on `resources.html`, adjust it with the minimum change necessary.
7. Run the relevant tests to confirm the new page split works and existing resource navigation still passes.
8. Do a final pass for broken relative links, duplicated IDs, and any canonical/active-nav issues caused by the new page.

## Risks Or Open Questions

- The current `resources.html` may contain page-specific markup or script assumptions tied to the tab layout; moving only one tab out could leave dead markup or orphaned behavior behind.
- It is not yet decided whether `resources.html` should keep a “References” card/CTA, a reduced tab shell, or a full navigation treatment matching the other top-level pages.
- If users currently link directly to `resources.html#references`, that anchor path will no longer represent the actual references content and may need a redirect-style fallback or a visible replacement link.
- Tests are currently lightweight and may need one additional regression test to cover the new page split cleanly.
