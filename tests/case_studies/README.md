# Case-study calculation tests

Baseline (golden-file) regression tests for the interactive LCA/TEA calculators
embedded in `case_studies/*.html` via `standalone/*.html`.

**These tests are about the arithmetic, not the markup.** Only computed values
are captured, so restyling a dashboard passes and a changed formula fails.

## Layout

| File | Purpose |
| --- | --- |
| `dashboards.config.js` | One entry per calculator: URL, input ids, output selectors, named scenarios |
| `baseline.js` | Loads a scenario, snapshots outputs, reads/writes the golden files |
| `case-studies.calc.spec.js` | The baseline regression suite (parameterised over every dashboard) |
| `case-studies.behaviour.spec.js` | Directional/smoke checks ("raising X must raise Y") |
| `baselines/<key>.baseline.json` | Generated golden file — do not hand-edit |

Naming convention: `<subject>.<kind>.spec.js`, where `kind` is `calc` for
baseline value assertions and `behaviour` for directional assertions.

## What a baseline holds

```jsonc
{
  "dashboard": "laterite",
  "scenarios": {
    "double-ncl-feed": {
      "inputs":  { "i_ncl": 720 },              // what was typed in
      "outputs": {
        "scalars": { "v_tci": "220.35", ... },  // rendered text of every output element
        "tables":  { "capex_tbl": ["1.4", ...] }// tables reduced to an ordered list of numbers
      }
    }
  }
}
```

Tables are stored as bare number lists on purpose: adding a label column or
restyling a row cannot move the baseline, but a changed cost can.

## Running

```bash
npm run test:case-studies          # assert current outputs against the baselines
npm run test:case-studies:update   # regenerate the baselines after an INTENDED model change
```

Always inspect `git diff tests/case_studies/baselines/` after an update — that
diff is the review record of what the model change actually did to the numbers.

## Adding a scenario or a dashboard

1. Add the entry to `dashboards.config.js`. Input values must be in the units
   the input field itself uses (e.g. Flue2Chem CO2 recovery is a fraction,
   Palladium discount rate is a percentage).
2. Run `npm run test:case-studies:update`.
3. Check the new numbers in the diff, then commit the baseline with the config.
