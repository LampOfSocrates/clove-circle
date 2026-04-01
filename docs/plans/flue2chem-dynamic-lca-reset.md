# Flue2Chem Dynamic LCA and Visible Reset Controls

## What the feature does

This update restores the dynamic LCA behavior from the upstream Flue2Chem calculator into the standalone `flue2chem-lca-tea.html` file so the LCA tab updates when model inputs change. It also makes reset controls visible in the standalone UI while preserving the existing embedded reset support used by the case-study wrapper page.

## Files that will be changed or created

- `standalone/flue2chem-lca-tea.html`
- `docs/plans/flue2chem-dynamic-lca-reset.md`

## Implementation steps

1. Add failing tests or a lightweight verification harness for the standalone calculator behavior, covering:
   - dynamic LCA table rendering after input changes
   - reset control visibility in the standalone page
   - reset behavior still working through the existing `flue2chem:reset` message
2. Update the standalone HTML structure to expose visible reset button(s) in the page without breaking the current layout.
3. Restore the dynamic LCA logic inside `calc()`:
   - compute net-electricity scaling
   - rebuild the full LCA table from base data
   - rebuild the comparison table from the selected impact categories
   - refresh the LCA tab when selected
4. Keep the existing postMessage listener so the case-study wrapper can continue to trigger resets from outside the iframe.
5. Run the relevant tests or verification steps again to confirm the standalone page behaves correctly after the changes.

## Risks or open questions

- The current standalone file contains static LCA markup, so restoring dynamic rendering requires replacing that structure carefully to avoid leaving stale content or broken IDs.
- The visible reset button should feel native to the standalone UI while still matching the existing embedded reset behavior.
- Depending on the available test setup in the repo, verification may need to rely on browser-facing checks rather than an existing unit-test framework.
