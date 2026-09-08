# LCA Graph

A life cycle assessment and techno-economic calculation engine that works from a
declarative process model instead of hand-written code.

You describe a flowsheet, its parameters and its equations in a JSON document written in
**PML** (process modelling language). The engine compiles that document into a **calc
graph**, one node per quantity with edges inferred from the expressions, and then:

- solves it **step by step** in the ISO 14040 order (goal and scope, mass balance,
  inventory, impact assessment, capital cost, operating cost and revenue, profitability,
  interpretation), locking each step until the one before it has run;
- lets you pick **calculation targets** and tells you which steps and which inputs they
  need, then computes only that part of the graph;
- runs **sensitivity analysis**: one-at-a-time tornado, one- and two-dimensional sweeps,
  named scenarios and seeded Monte Carlo;
- draws the **flowsheet automatically** from the topology, so a click on any stream or
  unit opens its inputs or the formula behind it.

No build step, no dependencies, no AI at runtime. Everything runs as plain scripts in the
browser and under `node --test`.

## Try it

Serve the repository over HTTP (the app fetches its model files) and open
`lcagraph/app/index.html?model=flue2chem`. Four models ship in `models/`:

| Model | Case | Verified against |
|---|---|---|
| `flue2chem` | CO₂ capture to surfactant | `standalone/flue2chem-lca-tea.html` |
| `laterite` | Laterite bioleaching to Ni, Co, Mn | `standalone/laterite-lca-tea.html` |
| `palladium` | Palladium bio-recovery | `standalone/palladium-biorecovery-lca-tea.html` |
| `pha` | PHA biocomposite from lignocellulose | `standalone/PHA-from-lignocellulose-lca-tea.html` |

Each model reproduces its dashboard's numbers exactly, including the dashboard's quirks.
Every quirk is declared in the model's `meta.notes` and shown in a banner when the model
loads, with a button to jump to the node concerned. The `Upload model` button loads any
`*.pml.json`; `Download case` saves the current inputs as a new document.

## Layout

```
docs/plan.md         decisions, architecture, status, remaining work (read first)
docs/pml-spec.md     the language reference
docs/authoring.md    rules for writing a model that reproduces a published dashboard
schema/              JSON Schema for a PML document
src/                 engine: units, expr, functions, compile, solve, targets, sensitivity, layout, validate
models/              the four PML documents and their golden mapping files
app/                 the generic step-by-step web app
tests/               node --test suites and the golden replay harness
```

## Beta (AI-assisted authoring)

`app/beta.html` is an invitation-only gate in front of the AI-assisted builder. The only
server piece is the Cloudflare Worker in `worker/`, which holds the OpenRouter key and
checks access codes; see `worker/README.md` for setup and issuing codes. The public app
above never calls it.

## Test

```
cd lcagraph
node --test "tests/*.test.js"      # engine, analysis and golden replay of every model
node tests/golden.js laterite      # readable per-scenario report for one model
```

From the repository root, `npm run test:lcagraph` runs the same suite and
`npx playwright test tests/lcagraph.spec.js` smoke-tests the app for every model.

## Writing a model

Read `docs/pml-spec.md`, then `docs/authoring.md`. The short version: every number is a
node, expressions hold only unit algebra, every node has a stage and may only depend on its
own or earlier stages, and a model that reproduces a published study declares that study's
oddities rather than fixing them silently.
