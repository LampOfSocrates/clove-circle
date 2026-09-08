/* Golden replay: load a PML model, apply every scenario recorded for the published
   dashboard in tests/case_studies/baselines, solve, and compare each mapped output against
   the text the dashboard rendered. Used by golden.test.js and by `node tests/golden.js <id>`
   for a human-readable report while authoring a model. */
const fs = require('fs');
const path = require('path');
const { compile } = require('../src/compile.js');
const { Solver } = require('../src/solve.js');
const Units = require('../src/units.js');

const MODELS = path.join(__dirname, '..', 'models');
const BASELINES = path.join(__dirname, '..', '..', 'tests', 'case_studies', 'baselines');

function listModels() {
  return fs.readdirSync(MODELS).filter((f) => f.endsWith('.pml.json')).map((f) => f.replace('.pml.json', ''));
}

function load(id) {
  const doc = JSON.parse(fs.readFileSync(path.join(MODELS, id + '.pml.json'), 'utf8'));
  const goldenPath = path.join(MODELS, id + '.golden.json');
  const golden = fs.existsSync(goldenPath) ? JSON.parse(fs.readFileSync(goldenPath, 'utf8')) : null;
  return { doc, golden };
}

/* "$16.18M" -> 16.18, "1,011" -> 1011, "-86.6%" -> -86.6, "1.34e-3" -> 0.00134 */
function parseDisplayed(text) {
  if (text === null || text === undefined) return null;
  const m = String(text).replace(/,/g, '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/i);
  return m ? Number(m[0]) : null;
}

/* Half a unit of the last displayed decimal, or 0.5 for integers; exponent notation gets a
   relative tolerance from its mantissa digits. */
function toleranceOf(text) {
  const s = String(text).replace(/,/g, '');
  const m = s.match(/-?\d*\.?(\d*)(?:e[-+]?\d+)?/i);
  const num = s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/i);
  if (!m || !num) return 0.5;
  const decimals = (num[0].split(/e/i)[0].split('.')[1] || '').length;
  const exp = /e/i.test(num[0]) ? Number(num[0].split(/e/i)[1]) : 0;
  return 0.5 * Math.pow(10, exp - decimals);
}

function nodeValue(solver, spec) {
  const id = typeof spec === 'string' ? spec : spec.node;
  const node = solver.graph.nodes[id];
  if (!node) throw new Error('golden: unknown node "' + id + '"');
  let v = solver.get(id);
  if (typeof v !== 'number') return v;
  if (typeof spec === 'object') {
    if (spec.unit) v = Units.fromCanonical(v, node.dim, spec.unit);
    if (spec.scale) v = v * spec.scale;
    if (spec.abs) v = Math.abs(v);
  } else {
    v = Units.fromCanonical(v, node.dim, node.unit);
  }
  return v;
}

function applyInputs(solver, golden, inputs) {
  Object.keys(inputs).forEach((inputId) => {
    const map = golden.inputs[inputId];
    if (!map) throw new Error('golden: baseline input "' + inputId + '" is not mapped');
    const pid = typeof map === 'string' ? map : map.param;
    const node = solver.graph.nodes[pid];
    if (!node) throw new Error('golden: input map "' + inputId + '" -> unknown param "' + pid + '"');
    let v = Number(inputs[inputId]);
    if (typeof map === 'object' && map.scale) v = v * map.scale;
    const unit = typeof map === 'object' && map.unit ? map.unit : node.unit;
    solver.set(pid, Units.toCanonical(v, node.dim, unit));
  });
}

function replay(id) {
  const { doc, golden } = load(id);
  if (!golden) throw new Error('golden: no ' + id + '.golden.json');
  const baseline = JSON.parse(fs.readFileSync(path.join(BASELINES, golden.baseline + '.baseline.json'), 'utf8'));
  const graph = compile(doc);
  const solver = new Solver(graph);
  const report = { id, scenarios: [], unmapped: [], skipped: Object.keys(golden.skip || {}) };

  const mappedOutputs = Object.keys(golden.outputs || {});
  const allOutputs = Object.keys(baseline.scenarios.defaults.outputs.scalars);
  allOutputs.forEach((o) => {
    if (mappedOutputs.indexOf(o) === -1 && !(golden.skip && golden.skip[o])) report.unmapped.push(o);
  });

  Object.keys(baseline.scenarios).forEach((name) => {
    const sc = baseline.scenarios[name];
    solver.reset();
    applyInputs(solver, golden, sc.inputs || {});
    const runs = solver.solveAll();
    const failed = runs.filter((r) => !r.ok);
    const rows = [];
    if (failed.length) {
      rows.push({ output: '(solve)', ok: false, expected: 'ok', actual: failed[0].error });
    }
    mappedOutputs.forEach((o) => {
      const text = sc.outputs.scalars[o];
      if (text === undefined) return;
      const expected = parseDisplayed(text);
      const actual = nodeValue(solver, golden.outputs[o]);
      const tol = toleranceOf(text);
      const ok = expected === null ? actual === null
        : (typeof actual === 'number' && Math.abs(actual - expected) <= Math.max(tol * (1 + 1e-9) + 1e-12, Math.abs(expected) * 1e-6));
      rows.push({ output: o, node: typeof golden.outputs[o] === 'string' ? golden.outputs[o] : golden.outputs[o].node,
        ok, expected, actual, text, tol });
    });
    Object.keys(golden.tables || {}).forEach((t) => {
      const spec = golden.tables[t];
      const list = (sc.outputs.tables || {})[t];
      if (!list) return;
      const nodes = spec.nodes;
      const stride = spec.stride || 1, offset = spec.offset || 0;
      nodes.forEach((nodeSpec, i) => {
        const text = list[offset + i * stride];
        if (text === undefined) return;
        const expected = parseDisplayed(text);
        const actual = nodeValue(solver, nodeSpec);
        const tol = toleranceOf(text);
        const ok = typeof actual === 'number' && Math.abs(actual - expected) <= Math.max(tol * (1 + 1e-9) + 1e-12, Math.abs(expected) * 1e-6);
        rows.push({ output: t + '[' + (offset + i * stride) + ']', node: typeof nodeSpec === 'string' ? nodeSpec : nodeSpec.node,
          ok, expected, actual, text, tol });
      });
    });
    report.scenarios.push({ name, rows, failures: rows.filter((r) => !r.ok) });
  });
  return report;
}

function printReport(r) {
  console.log('== ' + r.id + ' ==');
  r.scenarios.forEach((s) => {
    const n = s.rows.length, f = s.failures.length;
    console.log(`  ${s.name}: ${n - f}/${n} ok`);
    s.failures.forEach((x) => {
      console.log(`    FAIL ${x.output} (${x.node || ''}): expected ${x.expected} [${x.text}] got ${x.actual}`);
    });
  });
  if (r.unmapped.length) console.log('  unmapped outputs (' + r.unmapped.length + '): ' + r.unmapped.join(', '));
  if (r.skipped.length) console.log('  skipped: ' + r.skipped.join(', '));
}

module.exports = { listModels, load, replay, printReport, parseDisplayed, toleranceOf };

if (require.main === module) {
  const ids = process.argv.slice(2);
  (ids.length ? ids : listModels()).forEach((id) => {
    try { printReport(replay(id)); }
    catch (e) { console.log('== ' + id + ' == ERROR ' + e.message); process.exitCode = 1; }
  });
}
