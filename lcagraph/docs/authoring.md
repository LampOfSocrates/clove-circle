# Authoring a PML model that reproduces a published dashboard

Read first: `docs/pml-spec.md` (the language), `tests/fixtures/mini.js` (a complete tiny
document using every construct), `src/functions.js` (built-ins), `src/units.js` (allowed
dimensions and unit strings).

## Rules

1. **Fidelity target is the standalone dashboard**, not the simplified step-by-step model.
   Every number the dashboard renders must come out of the graph. The golden harness
   replays `tests/case_studies/baselines/<key>.baseline.json` and compares each rendered
   string with a graph node.
2. **Reproduce quirks, never fix them silently.** If the dashboard double-counts a stream,
   freezes an LCIA basis, or declares an input it never uses, the model does the same and
   says so in `meta.notes` with `level: "quirk"`, a short `title`, a plain-English `text`
   that a student can understand, and the `nodes` involved. Notes are shown prominently.
3. **Every literal becomes a node.** Molecular weights go in `components`; yields, emission
   factors, CEPCI indices, currency factors, fixed cost items go in `params`
   (`editable: false` where the dashboard does not expose them) or in `tables`. Literal
   numbers in an `expr` are only for unit algebra (`/ 1000`, `* 24`, `* 3.6`).
4. **Full flowsheet.** Declare every unit operation in `units` and every stream in
   `streams` with `from`/`to`, including environment feeds and exits, recycles
   (`recycle: true`), by-difference closures (`closes: true`) and products (`product`).
   Streams with a real composition use `components`.
5. **Six stages**: `mass`, `lci`, `lcia`, `capex`, `opex`, `dcf`, with the same titles and
   verbs as `case_studies/models/*.model.js`. Reuse those files' `stepCopy.tryIt` texts.
   Every node needs a stage and may only depend on the same or earlier stages.
6. **Provide `targets`** (at least: climate impact per FU, capital, MSP or equivalent, NPV)
   and **`sensitivity`** (at least one `oat` on the economic KPI, one `oat` on the climate
   KPI, one `sweep`, one `scenario` set, one `montecarlo` with sensible distributions).
7. **Table-driven costs and inventories** use `tables` + a per-row `derived` with
   `table`/`column`/`row.` expressions, then `sum(col(...))`.
8. **Units**: use only dimension/unit strings present in `src/units.js`. If a needed unit is
   missing, use the closest dimension and list the missing unit in your final report; do
   not edit `src/`.
9. Mark KPIs with `kpi: true` (six at most). Set `hit` on params so the flowsheet can open
   them (a stream id or a unit id; units list them in `params`).
10. Fill `meta.functionalUnit`, `meta.boundary`, `meta.source`, `allocation` and `lcia`
    (categories with `total` nodes and `contributions`; benchmarks where the dashboard has
    them).

## Golden file

`models/<id>.golden.json` (see spec section 19). Map **every** scalar output in the baseline
`defaults` scenario, or list it under `skip` with a one-line reason (only presentation
strings like "✓ Profitable" or unit captions qualify). Map the dashboard's main tables via
`tables` (`stride`/`offset` pick numbers out of the flat list; check the baseline JSON to see
the layout). Input mapping: baseline values are in the dashboard field's units; use
`{ "param": ..., "unit": ... }` or `scale` when the graph param uses a different unit.

## Verify

```
node tests/golden.js <id>          # human-readable report, iterate until every row is ok
node --test "tests/*.test.js"      # everything green, including the golden suite
```

A report line `unmapped outputs (...)` is a failure: map or skip them.
