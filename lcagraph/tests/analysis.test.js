const test = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('../src/compile.js');
const { Solver } = require('../src/solve.js');
const Targets = require('../src/targets.js');
const Sens = require('../src/sensitivity.js');
const { MINI } = require('./fixtures/mini.js');

function solver() {
  const doc = JSON.parse(JSON.stringify(MINI));
  return new Solver(compile(doc));
}

test('targets: subgraph, stages, missing inputs', () => {
  const s = solver();
  const a = Targets.analyse(s, ['tci']);
  assert.deepEqual(a.stages, ['mass', 'capex']);
  assert.ok(a.inputs.indexOf('feed') !== -1);
  assert.ok(a.inputs.indexOf('price') === -1);
  assert.ok(a.ready);
  s.set('lang', null);
  const b = Targets.analyse(s, ['tci']);
  assert.deepEqual(b.missing, ['lang']);
  assert.ok(!b.ready);
  const c = Targets.compute(solver(), ['tci', 'npv']);
  assert.ok(c.values.tci > 0);
  assert.ok(typeof c.values.npv === 'number');
});

test('sensitivity: oat ranks by swing and is pure', () => {
  const s = solver();
  const r = Sens.oat(s, { kind: 'oat', target: 'npv', params: 'editable', delta: 0.1 });
  assert.ok(r.rows.length >= 4);
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1].results.npv.swing >= r.rows[i].results.npv.swing);
  }
  assert.equal(s.get('npv'), undefined);
  const price = r.rows.filter((x) => x.param === 'price')[0];
  assert.ok(price.results.npv.high > price.results.npv.low);
});

test('sensitivity: sweep 1-D and 2-D in display units', () => {
  const s = solver();
  const r = Sens.sweep(s, { kind: 'sweep', target: 'npv', param: 'price', from: 50, to: 150, steps: 4 });
  assert.equal(r.points.length, 5);
  assert.equal(r.x[0], 50);
  assert.ok(r.points[4].values.npv > r.points[0].values.npv);
  const g = Sens.sweep(s, { kind: 'sweep', target: 'npv', param: 'price', from: 50, to: 150, steps: 2, param2: 'lang', from2: 2, to2: 4, steps2: 2 });
  assert.equal(g.grid.length, 3);
  assert.equal(g.grid[0].length, 3);
  assert.ok(g.grid[0][2].npv > g.grid[2][2].npv);
});

test('sensitivity: scenarios and seeded monte carlo', () => {
  const s = solver();
  const sc = Sens.scenario(s, { kind: 'scenario', targets: ['npv', 'tci'], scenarios: { cheap: { lang: 2 }, dear: { lang: 5 } } });
  assert.equal(sc.rows.length, 2);
  assert.ok(sc.rows[0].values.tci < sc.rows[1].values.tci);
  const spec = { kind: 'montecarlo', target: 'npv', n: 300, seed: 7,
    params: { price: { dist: 'triangular', min: 60, mode: 100, max: 140 }, lang: { dist: 'uniform', min: 2, max: 4 } } };
  const a = Sens.montecarlo(s, spec);
  const b = Sens.montecarlo(s, spec);
  assert.equal(a.stats.npv.n, 300);
  assert.equal(a.stats.npv.p50, b.stats.npv.p50);
  assert.ok(a.stats.npv.p5 <= a.stats.npv.p50 && a.stats.npv.p50 <= a.stats.npv.p95);
  assert.equal(a.stats.npv.histogram.bins.reduce((x, y) => x + y, 0), 300);
});
