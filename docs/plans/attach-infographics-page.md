# Attach Infographics Page

## What The Feature Does

Makes the `Infographics` control in the Resources header open the dedicated `infographics/infographics.html` page instead of toggling an inline placeholder tab.

## Files That Will Be Changed Or Created

- `docs/plans/attach-infographics-page.md`
- `resources.html`
- `tests/resources_case_study_test.py`

## Implementation Steps

1. Update the Resources page regression so it expects the header navigation to link the Infographics control to `infographics/infographics.html`.
2. Change the Resources header navigation in `resources.html` so the Infographics control is an anchor instead of a Bootstrap pill button.
3. Keep the existing Case Studies and References controls intact so page navigation remains consistent.
4. Run the Resources regression again and confirm it passes.

## Risks Or Open Questions

- The current inline “Infographics — Coming Soon” tab content will remain in the file unless removed in a later cleanup. It will simply stop being the primary entry point.
- Mixing tab buttons and plain links in the same nav is acceptable here because only Case Studies still uses inline tab content on the Resources page.
