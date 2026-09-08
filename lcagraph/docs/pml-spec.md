# PML — Process Modelling Language for LCA graph (v0.1)

A PML document is a JSON file (`*.pml.json`) that describes a process flowsheet, the
parameters that size it, and every quantity that can be computed from it: mass and energy
balances, life cycle inventory and impacts, capital and operating cost, revenue and
profitability. The compiler turns the document into a **calc graph**: one node per quantity,
edges inferred from expressions. The executor solves the graph stage by stage, only for
the targets you ask for, and re-runs it for sensitivity analysis. No code is ever written
per case study; a document is data.

Design rules:

1. **Every number is a node.** Yields, molecular weights, CEPCI indices, emission factors
   are `params` (usually `editable:false`) or table cells, never literals hidden in
   expressions. Literal numbers in expressions are allowed only for pure arithmetic
   (`/ 1000`, `× 24`) and unit algebra.
2. **Dependencies are inferred.** You never write `deps`. The expression parser finds them.
3. **Every node has a stage.** Stages are ordered; a node may only depend on nodes of the
   same or an earlier stage. The compiler rejects anything else.
4. **Quirks are declared, not hidden.** A model that reproduces a published dashboard
   exactly, including its oddities, says so in `meta.notes` and on the node concerned.

---

## 1. Document skeleton

```jsonc
{
  "pml": "0.1",
  "meta":        { ... },      // identity, functional unit, boundary, notes
  "stages":      [ ... ],      // ordered solve steps
  "components":  { ... },      // chemical species (optional)
  "params":      { ... },      // inputs and named constants
  "tables":      { ... },      // tabular data (equipment, LCI rows, CF matrices)
  "units":       { ... },      // unit operations / blocks (topology)
  "streams":     { ... },      // flows between units (topology + quantity)
  "derived":     { ... },      // every other computed quantity
  "checks":      { ... },      // closure and constraint assertions
  "lcia":        { ... },      // impact categories and how they are grouped (optional)
  "allocation":  { ... },      // documentation of allocation rules (optional)
  "targets":     { ... },      // named calculation targets
  "sensitivity": { ... },      // named sensitivity analyses
  "diagram":     { ... }       // optional layout hints
}
```

Identifiers (`id`) are `[a-z][a-z0-9_]*`. Dotted names are reserved for the compiler
(stream components, table cells).

## 2. `meta`

```jsonc
"meta": {
  "id": "pha",
  "title": "PHA biocomposite from lignocellulose",
  "subtitle": "...",
  "functionalUnit": "1 kg biocomposite at the factory gate",
  "boundary": "Cradle-to-gate ...",
  "currency": "$",
  "source": "Reproduces standalone/PHA-from-lignocellulose-lca-tea.html",
  "notes": [
    { "level": "warning", "title": "Frozen LCIA basis",
      "text": "...", "nodes": ["gwp_buffer"] }
  ]
}
```

`notes[].level` is `info | warning | quirk`. Notes are shown prominently by the app: in a
banner on load and as a badge on every node listed in `nodes`.

## 3. `stages`

```jsonc
"stages": [
  { "id": "mass",  "title": "Mass balance",           "verb": "Do mass balance",       "tryIt": "..." },
  { "id": "lci",   "title": "Life cycle inventory",   "verb": "Build inventory",       "tryIt": "..." },
  { "id": "lcia",  "title": "Impact assessment",      "verb": "Run impact assessment", "tryIt": "..." },
  { "id": "capex", "title": "Capital cost",           "verb": "Estimate CAPEX",        "tryIt": "..." },
  { "id": "opex",  "title": "Operating cost & revenue","verb": "Cost the operation",   "tryIt": "..." },
  { "id": "dcf",   "title": "Profitability",          "verb": "Run cash flow",         "tryIt": "..." }
],
"stepCopy": { "scope": { "tryIt": "..." }, "interpret": { "tryIt": "..." } }
```

The app adds `scope` before and `interpret` after. Order is solve order.

## 4. `components`

```jsonc
"components": {
  "co2":  { "label": "CO₂",  "mw": 44.01 },
  "cellulose": { "label": "Cellulose" }
}
```

`mw` in kg/kmol (g/mol). Referenced in expressions as `mw.co2`.

## 5. `params`

```jsonc
"params": {
  "flue_in": {
    "label": "Flue gas throughput", "stage": "mass",
    "dim": "mass_flow", "unit": "t/d",
    "default": 36000, "range": [5000, 80000],
    "editable": true,
    "source": "Stack flow for a large industrial CO2 point source.",
    "hit": "flue"            // stream or unit id this param belongs to (for click-to-edit)
  },
  "mw_ratio_eth_eo": {
    "label": "Ethanol/EO molecular weight ratio", "stage": "mass",
    "dim": "count", "unit": "", "default": 1.04545, "editable": false,
    "source": "46/44"
  }
}
```

| field | required | meaning |
|---|---|---|
| `label` | yes | human name |
| `stage` | yes | stage id |
| `dim` | yes | dimension key from `units.js` |
| `unit` | no | display unit of `default` and `range`; defaults to the dimension's canonical unit |
| `default` | yes | value **in `unit`**; stored canonically |
| `range` | no | typical range in `unit`; outside is a warning, not an error |
| `editable` | no | default `true`; `false` marks a named constant (still a node, still reachable by sensitivity if explicitly listed) |
| `source` | no | provenance sentence |
| `hit` | no | stream or unit the param is edited from |
| `notes` | no | list of note ids from `meta.notes` |

## 6. `tables`

```jsonc
"tables": {
  "equipment": {
    "label": "Equipment cost basis", "stage": "capex",
    "columns": {
      "label":     { "type": "text" },
      "base_cost": { "dim": "currency", "unit": "$M", "editable": true },
      "n":         { "dim": "count", "editable": true },
      "base_size": { "dim": "count" },
      "size_unit": { "type": "text" },
      "cepci_base":{ "dim": "count", "nullable": true }
    },
    "rows": {
      "fermenters": { "label": "Fermenters", "base_cost": 0.67, "n": 0.8, "base_size": 1.04, "size_unit": "tph", "cepci_base": 402 },
      "chp":        { "label": "CHP",        "base_cost": 1.0,  "n": 1.0, "base_size": 5.0,  "size_unit": "GWh", "cepci_base": null }
    }
  }
}
```

Every numeric cell becomes a node `table.row.column` (e.g. `equipment.fermenters.base_cost`),
stage = table stage, editable per column. `null` cells are nodes with value `null`; use
`isnull(x)` in expressions. Columns are addressable as arrays: `col(equipment, base_cost)`.

## 7. `units` (unit operations)

```jsonc
"units": {
  "env":       { "kind": "env" },
  "capture":   { "label": "CO₂ capture", "sub": "amine absorber", "kind": "separator", "params": ["co2_rec", "co2_conc"] },
  "electrolysis": { "label": "Electrolysis", "kind": "converter", "params": ["elec_h2"] },
  "buffer_recycle": { "label": "Buffer recycle (NF)", "kind": "cost_only" }
}
```

`kind`: `env | source | sink | mixer | splitter | separator | converter | reactor | custom |
cost_only`. `env` is the surroundings and is implicit if omitted. `kind` is descriptive
metadata for the diagram; it imposes no equations. `params` lists params that the inspector
shows when the block is clicked (equivalent to `hit`).

## 8. `streams`

```jsonc
"streams": {
  "flue":       { "label": "Flue gas", "from": "env", "to": "capture",
                  "dim": "mass_flow", "unit": "t/d", "expr": "flue_in" },
  "co2_ft":     { "label": "CO₂-rich gas to FT", "from": "capture", "to": "ft",
                  "dim": "mass_flow", "unit": "t/d", "expr": "co2_to_ft / co2_conc" },
  "exhaust":    { "label": "Exhaust + water", "from": "gas_treat", "to": "env",
                  "dim": "mass_flow", "unit": "t/d",
                  "expr": "rem_flue + ft_flue + ww_eth - h2_total",
                  "closes": true },
  "h2":         { "label": "H₂", "from": "electrolysis", "to": "ft", "recycle": true, ... },
  "dry_biomass":{ "label": "Dry biomass", "from": "env", "to": "pretreat",
                  "dim": "mass_year", "unit": "t/y",
                  "components": {
                    "hemicellulose": "basis_tpa * hemi_pct / 100",
                    "cellulose":     "basis_tpa * cell_pct / 100",
                    "lignin":        "basis_tpa * lign_pct / 100",
                    "ash":           "basis_tpa * ash_pct / 100"
                  } }
}
```

A stream is one node (`streamid`) holding its total quantity, plus one node per component
(`streamid.component`). If `components` is given and `expr` is omitted, the total is the
sum of components. `stage` defaults to `mass`. Optional flags:

| flag | meaning |
|---|---|
| `closes` | this stream is defined by difference to close a balance (documentation + diagram styling) |
| `recycle` | drawn as a recycle; if the stream is part of a dependency cycle it is the **tear** stream and is solved by successive substitution from `guess` |
| `guess` | starting value for a tear stream |
| `product` | `main`, `co` or omitted; marks saleable outputs |
| `hit` | override which diagram element edits it (default: itself) |

## 9. `derived`

The workhorse. Any computed quantity that is not a stream.

```jsonc
"derived": {
  "co2_in_flue": { "label": "CO₂ in flue gas", "stage": "mass", "dim": "mass_flow", "unit": "t/d",
                   "expr": "flue_in * co2_frac" },
  "equip_cost":  { "label": "Delivered equipment cost", "stage": "capex", "dim": "currency", "unit": "$M",
                   "role": "capex",
                   "expr": "sum(col(equipment, cost))" },
  "npv":         { "label": "NPV", "stage": "dcf", "dim": "currency", "unit": "$M", "role": "metric",
                   "expr": "-tci + npv(repeat(margin, 20), irr)" },
  "gwp_total":   { "label": "GWP per kg", "stage": "lcia", "dim": "gwp_intensity", "unit": "kg CO2e/kg",
                   "role": "impact", "group": "gwp",
                   "expr": "sum(col(lci, flow) * col(lci, cf))" }
}
```

| field | meaning |
|---|---|
| `expr` | expression (section 12). Result is a number, `null`, or an array |
| `role` | optional tag: `energy | lci | impact | capex | opex | revenue | metric | check | series`. Used for grouping in the UI and for targets |
| `group` | free grouping key (e.g. impact category id, cost class) |
| `sign` | `any` (default) or `positive`; a negative `positive` node is shown as a warning |
| `basis` | free text shown next to the value, e.g. "4% of TIC" |
| `kpi` | `true` to show in the KPI strip |
| `notes` | note ids |

Table-driven quantities: a `derived` may compute **a column** for a table by giving
`"table": "equipment", "column": "cost"` and an `expr` evaluated **per row** with `row.` as
prefix (`row.base_cost * (row.size / row.base_size) ^ row.n * (cepci_now / coalesce(row.cepci_base, cepci_now))`).
The compiler creates one node per row (`equipment.fermenters.cost`) and the derived id
itself becomes the array of them.

## 10. `checks`

```jsonc
"checks": {
  "mass_closure": { "kind": "closure", "stage": "mass", "label": "Mass balance closure", "unit": "t/d",
                    "in": ["flue", "h2"], "out": ["surfactant", "ft_coprod", "eth_coprod", "eo_byprod", "exhaust"],
                    "tolerance": 0.01 },
  "comp_sum":     { "kind": "constraint", "stage": "mass", "severity": "soft",
                    "expr": "abs(hemi_pct + cell_pct + lign_pct + ash_pct - 100) <= 0.05",
                    "message": "Composition must sum to 100%." },
  "positive_feed":{ "kind": "constraint", "stage": "mass", "severity": "hard",
                    "expr": "ncl > 0", "message": "Feed must be positive." }
}
```

`closure` produces nodes `<id>.in`, `<id>.out`, `<id>.error`. `hard` constraints block the
stage from solving; `soft` ones warn.

## 11. `lcia`

```jsonc
"lcia": {
  "method": "ReCiPe 2016 Midpoint (H)",
  "categories": [
    { "id": "gwp", "label": "Global warming", "unit": "kg CO₂ eq", "total": "gwp_total",
      "contributions": { "Electricity": "gwp_elec", "Emissions": "gwp_emis" } }
  ],
  "benchmarks": [
    { "label": "Fossil-based surfactant", "category": "gwp", "node": "gwp_fossil" }
  ]
}
```

Pure presentation metadata over `derived` nodes. Multi-category LCIA is a table of CFs plus
per-category `derived` totals; the compiler does not special-case it.

## 12. Expression language

Grammar (precedence low → high): `?:` · `||` · `&&` · `== !=` · `< <= > >=` · `+ -` ·
`* /` · unary `-` · `^` (right-assoc) · call / member.

- Numbers: `3`, `0.5`, `1e6`.
- Identifiers: `[a-z_][a-z0-9_]*` with dotted segments: `feed.cellulose`,
  `equipment.chp.cepci_base`, `mw.co2`, `row.n`.
- Arrays: elementwise arithmetic between arrays of equal length or array-and-scalar.
- Booleans are 1/0.

Built-ins:

| function | meaning |
|---|---|
| `abs min max sqrt pow log ln log10 exp floor ceil round(x[,d])` | scalar math, elementwise on arrays |
| `if(c, a, b)` | conditional |
| `isnull(x)`, `coalesce(a, b, ...)` | null handling (table cells) |
| `sum(a)`, `mean(a)`, `count(a)`, `cumsum(a)`, `at(a, i)`, `len(a)` | arrays (0-based) |
| `col(table, column)` | table column as array, in declared row order |
| `cell(table, row, column)` | same as the dotted node id, for dynamic use |
| `repeat(x, n)`, `seq(a, b)`, `concat(a, b, ...)`, `set_at(a, i, v)`, `add_at(a, i, v)` | series building |
| `six_tenths(base_cost, size, base_size, n, cepci_base, cepci_now)` | `base × (size/base_size)^n × cepci_now/cepci_base` |
| `bond(bwi, f80_mm, p80_mm)` | Bond law specific energy, kWh/t: `10·bwi·(1/√(p80·1000) − 1/√(f80·1000))` |
| `annuity(r, n)` | `(1 − (1+r)^−n)/r` |
| `npv(series, r[, t0])` | Σ series[i]/(1+r)^(i+t0), `t0` default 1 |
| `irr(series[, guess])` | Newton/Brent on `npv(series, r, 0) = 0` |
| `payback(series)` | first index where cumulative ≥ 0, linear-interpolated; `null` if never |
| `discounted(series, r[, t0])` | series of discounted values |

Design-spec solving is a node kind, not a function (section 13).

## 13. Solve nodes

```jsonc
"derived": {
  "msp_by_npv": { "label": "MSP (NPV = 0)", "stage": "dcf", "dim": "price_mass", "unit": "$/kg",
                  "solve": { "target": "npv", "vary": "pd_price", "lo": 0, "hi": 1e9, "equals": 0 } }
}
```

The executor evaluates the ancestor subgraph of `target` with `vary` overridden and finds
the bracketed root (Brent). The node depends on everything `target` depends on except `vary`.

## 14. `targets`

```jsonc
"targets": {
  "gwp":  { "label": "Climate impact per FU", "nodes": ["gwp_total"] },
  "econ": { "label": "Economics", "nodes": ["tci", "msp", "npv"] }
}
```

For any set of node ids the engine returns: the ancestor subgraph, the stages involved, and
the params required, split into `set` and `missing` (a param is missing when its value is
`null`, which is how an uploaded flowsheet with unfilled parameters looks).

## 15. `sensitivity`

```jsonc
"sensitivity": {
  "tornado_msp": { "kind": "oat", "label": "What moves the MSP?",
                   "target": "msp", "params": "editable", "delta": 0.1 },
  "price_sweep": { "kind": "sweep", "target": "npv",
                   "param": "sprice", "from": 2000, "to": 15000, "steps": 14 },
  "grid":        { "kind": "sweep", "target": "npv",
                   "param": "sprice", "from": 2000, "to": 15000, "steps": 7,
                   "param2": "elcost", "from2": 0.05, "to2": 0.5, "steps2": 6 },
  "cases":       { "kind": "scenario", "targets": ["gwp_total", "msp"],
                   "scenarios": { "renewable": { "gwp_elec": 0.02 }, "cheap_power": { "elcost": 0.08 } } },
  "mc":          { "kind": "montecarlo", "target": "npv", "n": 2000, "seed": 42,
                   "params": { "sprice": { "dist": "triangular", "min": 5000, "mode": 7500, "max": 10000 },
                               "lang":   { "dist": "uniform", "min": 3, "max": 6 },
                               "elcost": { "dist": "lognormal", "median": 0.25, "sigma": 0.3 } } }
}
```

`params: "editable"` means every editable param that is an ancestor of the target. Values in
sensitivity specs are in the param's declared `unit`. All runs are deterministic; Monte Carlo
uses a seeded xorshift generator.

## 16. `allocation`

Documentation of what the expressions do, so the app can show it in the scope step:

```jsonc
"allocation": {
  "lca": { "method": "mass", "basis": "Energy allocated to Mn-oxide concentrate on the mass of each stage's feed", "nodes": ["ealloc"] },
  "tea": { "method": "none", "basis": "Unallocated energy is charged to the whole plant", "nodes": ["elec_tjy"] }
}
```

## 17. `diagram`

```jsonc
"diagram": {
  "rank":  { "capture": 0, "ft": 1, "ethanol": 1, "eo": 2, "surf": 3, "gas_treat": 2 },
  "order": { "ft": 0, "ethanol": 1 }
}
```

Optional. Without it the layout is a layered DAG by longest path from sources, recycles
drawn back over the top.

## 18. Units

`units.js` defines dimensions and units; canonical storage. Dimensions include
`mass_flow, mass_hour, mass_year, mass, volume_flow, volume_hour, energy, energy_rate,
energy_year, energy_intensity, energy_per_mass, power, price_mass, price_energy, price_volume,
currency, currency_year, fraction, gwp_intensity, gwp_year, concentration, molarity, ratio,
days, years, hours, count`. A model must not invent unit strings; add them to `units.js`.

## 19. Golden verification file

Each model ships `models/<id>.golden.json` mapping the published dashboard's DOM outputs
(already captured in `tests/case_studies/baselines/<key>.baseline.json`) onto graph nodes:

```jsonc
{
  "baseline": "pha-lignocellulose",
  "inputs":  { "i-basisTpa": "basis_tpa", "i-moisture": { "param": "moisture", "scale": 1 } },
  "outputs": { "o-H17": "equip_cost", "bE5": "dry_biomass.hemicellulose", "o-k-tci": { "node": "tci", "scale": 1 } },
  "tables":  { "eq-tbody": { "stride": 3, "offset": 2, "nodes": "equipment[].cost" } },
  "skip":    { "o-compSum": "presentation only" }
}
```

The golden test replays every scenario: sets inputs, solves all, and asserts each mapped
output matches the displayed text to within half a unit of its last displayed digit.
