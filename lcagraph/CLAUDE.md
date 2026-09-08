# lcagraph/ — LCA Graph

A self-contained LCA/TEA calculation engine: a JSON process modelling language (PML) is
compiled into a calc graph, solved stage by stage, queried for targets, and re-run for
sensitivity. Four models reproduce the site's standalone dashboards exactly. No build step,
no npm dependencies, no runtime AI. Intended to become a product on its own.

## Start here
- Read `docs/plan.md` first: decisions, architecture, phase status, remaining steps.
- Language reference: `docs/pml-spec.md`. Model-writing rules: `docs/authoring.md`.

## Test
```
cd lcagraph
node --test "tests/*.test.js"    # engine, analysis, golden replay of every model
node tests/golden.js <id>        # readable report while authoring a model
```
Use the glob, not a bare directory. Write files with the Write tool; Bash heredocs with
apostrophes fail here.

## Authoring rule of thumb
Every number is a node (params, table cells, components); expressions hold only unit
algebra. Reproduce a dashboard's quirks and declare each in `meta.notes` with
`level: "quirk"` and its `nodes`. Nodes depend only on their own or earlier stages. Unit
strings must exist in `src/units.js`.

## Boundary
Do not edit anything outside `lcagraph/` except: the "LCA Graph" link in `resources.html`,
the `test:lcagraph` script in `package.json`, `LATEST.md`, and optionally the CI workflow.
The existing dashboards, step-by-step pages and their tests stay untouched.
