# LCA Graph — plan and handoff

Status: APPROVED and IN PROGRESS (started 2026-09-07). This file is the single source of
truth for a session that has no memory of how the work began. Read it top to bottom, then
run the verification commands in section 9 before touching anything.

## 0. The ask, in the user's words

> Given a flowsheet and enough parameters, there is a calc graph that can be generated, and
> by modifying different bits of the calc graph we can do the entire calculation. The current
> code does everything step by step in code. Study the 4 use cases and: (1) design a process
> modelling language rich enough to describe all of them; (2) describe and annotate each use
> case in it; (3) set up a way to specify one or more calculation targets; (4) set up a way to
> specify a sensitivity analysis. Future users will upload a flowsheet and the site will
> construct the calc graph and prompt the user to do the LCA step by step. No AI at runtime.
> Keep it all in a special subfolder: this could become an LCA calculation product itself.

## 1. Decisions the user has made (do not re-litigate)

| Decision | Choice |
|---|---|
| Fidelity target | The **full standalone dashboards** in `standalone/*.html`, not the simplified step-by-step models in `case_studies/models/`. Verified by replaying `tests/case_studies/baselines/*.json`. |
| Folder | `lcagraph/` at repo root. Everything lives here. |
| Format | JSON documents (`*.pml.json`) with expressions as strings in a small safe language. No YAML, no custom DSL. |
| Monte Carlo | In scope (seeded, deterministic). Runtime is sub-second for 2,000 samples. |
| Quirk notes | Reproduced dashboards carry their oddities; each is declared in `meta.notes` and must be **very visible** in the app (banner on load, badge on the node). |
| Site link | The app is linked from `resources.html` under the "Try our Process Calculators" nav, as a new **"LCA Graph"** tab/section alongside "LCA Step by Step". |
| Runtime AI | None. An LLM-assisted authoring mode is a future TODO (section 11). |
| Scope outside `lcagraph/` | Only three touches allowed: the `resources.html` link, a `package.json` script, and a `LATEST.md` entry. Optionally add the test to `.github/workflows/tests.yml`. |

## 2. What existed before (findings that shaped the design)

- `js/cc-model/engine.js` already held a *variable-level* graph (each var has `deps`, `fn`,
  `stage`), but hand-written per case, with opaque JS closures, stage-wide staleness, a
  hand-drawn SVG per case, no targets, no sensitivity, and no PHA model at all.
- The four standalone dashboards contain constructs that engine could not express:

| Construct | Where |
|---|---|
| Product-first (backward) balance, one stream by difference | Flue2Chem |
| Multi-component streams with per-component recovery | PHA (4 comps), Laterite (8-comp leach feed) |
| Fixed split fractions, splitter/mixer/purge, reject stream reused as co-product | Laterite, PHA |
| Recycle: H2 to two upstream units; CHP electricity netted (negative opex); biocatalyst reuse by divisor | Flue2Chem, PHA, Palladium |
| Bond comminution law with PSD-weighted sum; sensible+latent heat | Laterite |
| Per-unit six-tenths CAPEX with CEPCI, per-row exponent, optional escalation (null CEPCI), size-driver expressions | Flue2Chem, Laterite, PHA |
| Fixed PEC line items, no scaling; working capital | Palladium |
| 18-category ReCiPe LCIA matrix with one live column scaled by a ratio; GWP-only flow x factor | Flue2Chem, Palladium / Laterite, PHA |
| Editable equipment and LCI/CF tables | PHA |
| Allocation: by-product credit, 3-basis mass allocation + parallel unallocated run + equal 1/3 split, none | Flue2Chem, Laterite, Pd/PHA |
| DCF: construction schedule (-3..0), terminal WC recovery, depreciation, piecewise tax, horizons 10/15/20 | all |
| IRR by Newton iteration; MSP by annuity inverse; MSSP by cost-minus-credit | Palladium, Flue2Chem |
| Hard/soft input validation (domain guard, composition sums to 100) | Laterite, PHA |
| Sensitivity / scenarios / Monte Carlo | none anywhere - designed in from scratch |

Known dashboard quirks that the models must reproduce and declare (level `quirk`):
Flue2Chem: unused H2O fraction input; exhaust net of electrolytic H2; only the LCIA
Electricity column is live; 0.77 currency factor folded into base costs; construction
schedule only affects the chart. Laterite: Mozley stream double-counted in the attrition
sub-split; split fractions are x/360 constants; Co recovery uses the Si wt%; bioleach CAPEX
size in a different unit; LCA path allocated, TEA path not; equal 1/3 GWP split; `i_na2so4`
HTML default 0 vs DEFAULTS 60. Palladium: CAPEX independent of throughput; LCIA reagent
burdens on a frozen 31,322 L/kg basis; `max(0, EBIT)` tax; WC recovered in NPV but not in
MSP; water/electricity prices are constants. PHA: biofiller is the pretreatment reject; CHP
feedstock uses raw lignin; LCI table not scaled by the balance; reagent cost skips steam and
transport rows; misc opex skips electricity; null CEPCI rows not escalated; equipment rows
paired to size drivers by position.

## 3. Architecture as built

```
lcagraph/
  CLAUDE.md                  orientation for a new session (points here)
  README.md                  TODO - what it is, how to run, how to author
  docs/plan.md               this file
  docs/pml-spec.md           the language, every construct, with examples  (DONE)
  docs/authoring.md          rules given to model authors                  (DONE)
  schema/pml.schema.json     JSON Schema draft-07 for a .pml.json          (DONE)
  src/
    units.js                 dimension/unit registry; canonical storage    (DONE)
    expr.js                  tokenizer, precedence parser, deps(), evaluate(), print()  (DONE)
    functions.js             built-ins: math, arrays, col/cell, six_tenths, bond,
                             annuity, npv, irr, payback, discounted; brent()  (DONE)
    compile.js               PML doc -> graph: nodes, inferred deps, stage check,
                             Kahn topo order with tear detection           (DONE)
    solve.js                 Solver: values, per-node dirty flags, stage gating,
                             runOrdered() with tear iteration, evaluate() pure,
                             solve nodes via Brent, closures/constraints, explain()  (DONE)
    targets.js               analyse(): subgraph, stages, inputs set/missing; compute(); resolve()  (DONE)
    sensitivity.js           oat / sweep (1-D, 2-D) / scenario / montecarlo (xorshift seed)  (DONE)
    layout.js                layered auto-layout of units+streams; renderSvg()  (DONE)
    validate.js              lint: compile errors + practice warnings      (DONE)
  models/
    flue2chem.pml.json + flue2chem.golden.json     (subagent, in progress)
    laterite.pml.json  + laterite.golden.json      (subagent, in progress)
    palladium.pml.json + palladium.golden.json     (subagent, in progress)
    pha.pml.json       + pha.golden.json           (subagent, in progress)
  app/
    index.html               page shell: header/chrome, notes, rail, KPIs, diagram,
                             inspector, card, fields                       (DONE)
    app.css                  self-contained stylesheet, Clove Circle palette  (DONE)
    app.js                   LGApp controller                              (NOT YET WRITTEN)
  tests/
    fixtures/mini.js         tiny PML doc using every construct
    core.test.js             expr, functions, compile, solve
    analysis.test.js         targets, sensitivity
    golden.js                replay harness + CLI (`node tests/golden.js <id>`)
    golden.test.js           one test per model in models/ + parsing checks
```

Module convention: every `src/*.js` is an IIFE that does
`if (module) module.exports = api; else (global.LCAG ||= {}).<name> = api;` and requires
siblings via `typeof require === 'function' ? require('./x.js') : global.LCAG.x`. Works in
node and as plain `<script>` tags. No build step, no npm dependencies.

### 3.1 Node kinds (compile.js)

| kind | created from | value |
|---|---|---|
| `param` | `params.<id>` | leaf; `default` converted to canonical unit; `editable` |
| `cell` | numeric cell of `tables.<t>.rows.<r>.<c>` -> id `t.r.c` | leaf; `nullable` allowed |
| `const` | `components.<c>.mw` -> id `mw.<c>` | leaf |
| `stream` | `streams.<id>` | expr, or sum of its components |
| `component` | `streams.<id>.components.<c>` -> id `<id>.<c>` | expr |
| `derived` | `derived.<id>` with `expr` | expr |
| `rowderived` | `derived.<id>` with `table`+`column`: one node per row `t.r.column`, `row.x` rebound to `t.r.x` | expr |
| `array` | the `derived.<id>` itself when table-driven | array of its row nodes |
| `solve` | `derived.<id>` with `solve:{target,vary,lo,hi,equals}` | Brent root of target(vary) = equals |
| `constraint` | `checks.<id>` kind constraint | 1/0; `severity` hard blocks the stage |
| closure | `checks.<id>` kind closure -> nodes `<id>.in`, `<id>.out`, `<id>.error` | derived |

Deps are inferred by `Expr.deps(ast)`: identifiers (dotted allowed), `cell(t,r,c)` -> `t.r.c`,
`col(t,c)` -> every `t.<row>.c`. Unknown ids, deps on a **later stage**, and cycles without a
`recycle: true` stream are compile errors. Tears: Kahn's algorithm; when stuck, the first
stuck stream flagged `recycle` becomes a tear (incoming edges cut), recorded in
`graph.tears`. Solver iterates the stage by successive substitution (first pass skips tears,
uses `guess`), tolerance 1e-9 relative, 200 iterations.

### 3.2 Solver (solve.js)

- `set(id, canonical)` dirties descendants only and un-solves their stages.
- `solve(stageId)` requires all earlier stages solved; evaluates the stage's nodes in topo
  order; returns `{ok, closures, constraints, converged, error}`; hard constraint failure or
  non-convergence leaves the stage unsolved.
- `evaluate(targetIds, overrides)` is pure: copies leaves, applies overrides, evaluates only
  the ancestor subgraph. Used by targets, sensitivity, and solve nodes.
- `explain(id)` gives formula text, resolved inputs, stage, unit, stale flag, notes.

### 3.3 Targets and sensitivity

`Targets.analyse(solver, ids)` -> `{subgraph, stages, inputs, editable, set, missing, ready}`
(missing = leaf value null and not `nullable`). `Targets.compute` evaluates ignoring stage
gating. Sensitivity kinds: `oat` (±delta or explicit `ranges`, rows sorted by swing on the
first target), `sweep` (`param` with `from/to/steps` or `values`; `param2` for a grid),
`scenario` (named override sets), `montecarlo` (`n`, `seed`, per-param `uniform |
triangular | normal | lognormal`; returns mean, sd, p5..p95, probPositive, histogram). All
spec values are in the param's declared display unit.

### 3.4 Golden harness (tests/golden.js)

`models/<id>.golden.json`:
```jsonc
{ "baseline": "<key in tests/case_studies/baselines>",
  "inputs":  { "<dom input id>": "<param>" | { "param": "...", "unit": "...", "scale": 1 } },
  "outputs": { "<dom output id>": "<node>" | { "node": "...", "unit": "...", "scale": 1, "abs": true } },
  "tables":  { "<table id>": { "stride": 3, "offset": 2, "nodes": ["<node>", ...] } },
  "skip":    { "<dom output id>": "reason" } }
```
For every scenario in the baseline: reset, set mapped inputs, `solveAll`, compare each
mapped output's rendered text (parsed) with the node value in the node's display unit,
tolerance = half a unit of the last displayed digit. Any unmapped scalar output in the
`defaults` scenario fails the test. CLI: `node tests/golden.js <id>` prints a report.

## 4. Phase status (updated 2026-09-08)

| Phase | State |
|---|---|
| 1. Spec + schema | DONE (`docs/pml-spec.md`, `schema/pml.schema.json`) |
| 2. Core engine + tests | DONE (`src/`, `tests/core.test.js`, `tests/analysis.test.js`) |
| 3. Four PML models + golden replay | DONE. All four golden-green: every baseline scenario, every scalar output mapped or explicitly skipped (flue2chem 6 scenarios × 107 rows, laterite 5 × 107, palladium 6 × 34, pha 5 × 54). 36 quirk/info notes declared across the four. |
| 4. Targets + sensitivity | DONE (`src/targets.js`, `src/sensitivity.js`) |
| 5. App | DONE (`app/index.html`, `app/app.css`, `app/app.js`): auto-layout flowsheet, notes banner (collapsible strip, never hidden), rail, KPIs, inspector, per-stage fields incl. editable tables, targets panel, sensitivity panel, upload/download/lint. |
| 6. Wiring + docs | DONE: `README.md`, `package.json` `test:lcagraph`, CI step in `.github/workflows/tests.yml`, `tests/lcagraph.spec.js` (Playwright, served over the config's http server), "LCA Graph" tab in `resources.html` (frame sized by the existing `ccSbsHeight` message), LATEST.md entry. |

## 5. Remaining and follow-up work

1. **Nothing blocking.** The work is complete and uncommitted; commit it from the repo root
   after checking `git status` for another session's changes.
2. **Units to add** (reported by the authors, additive, in `src/units.js`): an
   `energy_per_volume` dimension (kWh/m³); `ppm`/`mg/kg` under `mass_intensity`; a
   kWh/t-canonical specific energy for Bond results; a per-FU inventory intensity that
   tolerates mixed bases (kg/kg, MJ/kg, tkm/kg); per-litre impact burdens for non-GWP LCIA
   categories. Today those cells use `count` with a `basis` caption. Also consider a
   `row.mw` convention so per-row table expressions can reach `components[].mw`.
3. **Diagram polish**: labels of several streams leaving one port stack at ~15 px; a
   `diagram.rank`/`order` hint per model would tidy Flue2Chem and PHA further.
4. **Baseline tables**: the case-study baselines store tables as flat number lists scraped
   from `textContent`, so fused tokens (size+cost, year+cash+cum) cannot be mapped; the
   golden files map the clean columns and the authors verified the rest by hand. A richer
   capture in `tests/case_studies/baseline.js` (per-cell) would let the goldens cover them.
5. **Agentic builder**: section 11.

## 6. Verification commands

```
cd lcagraph
node --test "tests/*.test.js"      # engine + analysis + golden (needs models/*.golden.json)
node tests/golden.js               # readable golden report for every model
node tests/golden.js pha           # one model
cd .. && npx playwright test tests/stepbystep-lcagraph.spec.js   # once written
npm run test:case-studies          # existing site tests must stay green
```

Note: `node --test tests/` (a bare directory) fails in this node version; use the glob.

## 7. Conventions

- No build step, no new npm dependencies, no runtime AI.
- `src/*.js` modules are UMD-style (browser global `LCAG.<name>` and CommonJS).
- Nothing outside `lcagraph/` is edited except `resources.html` (link), `package.json`
  (script), `LATEST.md`, optionally `.github/workflows/tests.yml`.
- Models reproduce the dashboards' numbers exactly, quirks included; every quirk is a
  `meta.notes` entry with `level: "quirk"`, `title`, plain-English `text`, and `nodes`.
- Every literal is a node: molecular weights in `components`, factors/indices/prices in
  `params` (`editable: false` when the dashboard hides them) or `tables`. Literals in
  expressions only for unit algebra.
- Unit strings must exist in `src/units.js`; extend it rather than inventing strings.
- Six stages `mass, lci, lcia, capex, opex, dcf`; a node may only depend on its own or an
  earlier stage.
- Tests use `node:test` + `node:assert/strict`; fixtures under `tests/fixtures/`.

## 8. Known limitations and gaps to watch

- **Tooling**: in this environment, Bash heredocs containing apostrophes fail with
  "unexpected EOF"; write files with the Write tool (or a Python script via `python -`).
  Run node commands from the `lcagraph/` folder; the Bash cwd may reset between calls.
- `layout.js` blocks are 150 px wide; long unit labels overflow. Either shorten labels in
  the model, add `sub`, or wrap text in `renderSvg`.
- Layout draws env feeds/exits as 70 px stubs; many env streams on one unit crowd the
  labels. `diagram.rank`/`diagram.order` hints exist; label offsetting may need work.
- The app fetches models, so it needs http (GitHub Pages is fine); `file://` shows an
  error and the upload path still works.
- Solve nodes bracket on `[lo, hi]` with Brent; an unbracketed root yields `null`.
- Tear iteration is plain successive substitution; a non-contracting recycle will not
  converge (reported as `converged: false`). None of the four models needs a numeric tear.
- `irr()` searches `[-0.99, 10]`; `payback()` expects the series to start at year 0.
- `toleranceOf` in the golden harness parses the first number in the rendered text; outputs
  that render two numbers (e.g. "1,011 kg (95%)") need a `skip` or a cleaner mapping.
- `Units.format` chooses decimals by magnitude; the app should use it consistently and let
  models set `unit` for readable display.
- `validate.js` warns (does not fail) on params without `source`/`range`, unused inputs,
  units without streams, missing targets/sensitivity; treat warnings as a to-do list, not
  blockers.

## 9. Before you start (checklist for a new session)

1. `cd lcagraph && node --test "tests/*.test.js"` - note what is green.
2. `ls models/` - which of the eight model files exist; run `node tests/golden.js`.
3. `ls app/` - is `app.js` there? If not, step 5.2 is next.
4. `git status` - everything under `lcagraph/` is uncommitted work in progress unless the
   log says otherwise; commit only when the user asks.

## 10. Original risks (still true)

- Reproducing the standalone numbers exactly means carrying their quirks. They are
  reproduced faithfully and flagged in each model's notes, never silently fixed.
- Auto-layout is plainer than the hand-drawn SVGs; `diagram` hints let an author pin ranks.
- The expression language is a small compiler, kept tiny on purpose (no loops, no user
  functions) so it stays verifiable.

## 11. TODO (future, out of scope for this round)

- **Agentic LCA Graph builder.** A mode where a user uploads a flowsheet image/PDF plus
  loose data (spreadsheets, papers, notes) and an LLM reached through OpenRouter drafts
  the whole `*.pml.json` in the background: units, streams, params with sources, tables,
  derived expressions, checks and notes. The draft is then validated by the same compiler,
  lint and golden-style checks used here, and the user finishes it in the step-by-step app.
  The runtime engine stays AI-free; the LLM is only an authoring assistant.
