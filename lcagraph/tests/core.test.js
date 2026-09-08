const test = require('node:test');
const assert = require('node:assert/strict');
const Expr = require('../src/expr.js');
const { FNS } = require('../src/functions.js');
const { compile } = require('../src/compile.js');
const { Solver } = require('../src/solve.js');

const scope = (vals) => ({ get: (id) => vals[id], column: () => { throw new Error('no tables'); } });
const ev = (src, vals) => Expr.evaluate(Expr.parse(src), scope(vals || {}), FNS);

test('expr: precedence and associativity', () => {
  assert.equal(ev('1 + 2 * 3'), 7);
  assert.equal(ev('2 ^ 3 ^ 2'), 512);
  assert.equal(ev('-2 ^ 2'), -4);
  assert.equal(ev('(1 + 2) * 3'), 9);
  assert.equal(ev('10 / 4 / 5'), 0.5);
  assert.equal(ev('x > 0 ? x : -x', { x: -3 }), 3);
  assert.equal(ev('1 < 2 && 2 < 3'), 1);
});

test('expr: deps and dotted ids', () => {
  const d = Expr.deps(Expr.parse('a.b * sum(col(t, c)) + cell(t, r, c) + max(x, 2)'));
  assert.deepEqual(d.ids, ['a.b', 't.r.c', 'x']);
  assert.deepEqual(d.cols, ['t.c']);
});

test('expr: arrays and null', () => {
  assert.deepEqual(ev('repeat(2, 3) * 2'), [4, 4, 4]);
  assert.equal(ev('sum(repeat(1.5, 4))'), 6);
  assert.equal(ev('coalesce(x, 5)', { x: null }), 5);
  assert.equal(ev('x + 1', { x: null }), null);
  assert.throws(() => ev('nope + 1'), /unknown identifier/);
  assert.throws(() => Expr.parse('1 +'), /unexpected/);
});

test('functions: finance', () => {
  assert.ok(Math.abs(FNS.annuity([0.1, 10]) - 6.144567) < 1e-5);
  assert.ok(Math.abs(FNS.npv([[100, 100], 0.1]) - (100 / 1.1 + 100 / 1.21)) < 1e-9);
  const r = FNS.irr([[-100, 60, 60]]);
  assert.ok(Math.abs(FNS.npv([[-100, 60, 60], r, 0])) < 1e-6);
  assert.equal(FNS.payback([[-100, 50, 50, 50]]), 2);
  assert.equal(FNS.payback([[-100, 10]]), null);
  assert.ok(Math.abs(FNS.bond([12, 100, 20]) - 10 * 12 * (1 / Math.sqrt(20000) - 1 / Math.sqrt(100000))) < 1e-12);
  assert.equal(FNS.six_tenths([2, 4, 2, 0.5, null, 800]), 2 * Math.SQRT2);
});

const { MINI } = require('./fixtures/mini.js');


test('compile: builds nodes, infers deps, finds tear', () => {
  const g = compile(MINI);
  assert.equal(g.nodes.feed.value, 240); // 10 t/h -> t/d
  assert.equal(g.nodes.yld.value, 0.5);
  assert.deepEqual(g.nodes.mix.deps.sort(), ['feed_s', 'recyc']);
  assert.deepEqual(g.tears, ['recyc']);
  assert.ok(g.nodes['eq.u1.cost']);
  assert.deepEqual(g.nodes.pec.deps.sort(), ['eq.u1.cost', 'eq.u2.cost']);
  assert.ok(g.nodes.bep.deps.indexOf('price') === -1);
  assert.ok(g.nodes.bep.deps.indexOf('npv') !== -1);
  assert.deepEqual(g.nodes.prod.notes, ['q1']);
  assert.equal(g.nodes['mw.a'].value, 10);
});

test('compile: rejects later-stage deps, unknown ids, bare cycles', () => {
  const bad = JSON.parse(JSON.stringify(MINI));
  bad.derived.early = { label: 'x', stage: 'mass', dim: 'count', expr: 'tci' };
  assert.throws(() => compile(bad), /later stage/);
  const bad2 = JSON.parse(JSON.stringify(MINI));
  bad2.derived.pec.expr = 'nothere';
  assert.throws(() => compile(bad2), /unknown identifier/);
  const bad3 = JSON.parse(JSON.stringify(MINI));
  bad3.streams.recyc.recycle = false;
  assert.throws(() => compile(bad3), /cycle without a recycle/);
});

test('solve: stages, recycle convergence, closure, solve node', () => {
  const g = compile(MINI);
  const s = new Solver(g);
  assert.equal(s.isUnlocked('capex'), false);
  const r1 = s.solve('mass');
  assert.ok(r1.ok, r1.error);
  assert.ok(r1.converged);
  // recyc = mix*0.25, mix = 240 + recyc -> mix = 320, recyc = 80, prod = 160, waste = 80
  assert.ok(Math.abs(s.get('mix') - 320) < 1e-6);
  assert.ok(Math.abs(s.get('prod') - 160) < 1e-6);
  assert.ok(r1.closures[0].ok);
  const r2 = s.solve('capex');
  assert.ok(r2.ok);
  const u1 = 1 * Math.pow(160 / 100, 0.6) * 800 / 400;
  const u2 = 2 * Math.pow(160 / 100, 1);
  assert.ok(Math.abs(s.get('pec') - (u1 + u2)) < 1e-9);
  const r3 = s.solve('dcf');
  assert.ok(r3.ok, r3.error);
  const bep = s.get('bep');
  const check = s.evaluate(['npv'], { price: bep });
  assert.ok(Math.abs(check.npv) < 1e-4, 'npv at break-even ' + check.npv);
});

test('solve: dirty propagation and hard constraint', () => {
  const g = compile(MINI);
  const s = new Solver(g);
  s.solveAll();
  assert.equal(Object.keys(s.dirty).length, 0);
  s.set('lang', 4);
  assert.ok(s.isStale('tci'));
  assert.ok(s.isStale('npv'));
  assert.ok(!s.isStale('prod'));
  assert.ok(s.isSolved('mass'));
  assert.ok(!s.isSolved('capex'));
  s.set('feed', -1);
  const r = s.solve('mass');
  assert.equal(r.ok, false);
  assert.match(r.error, /positive/);
});

test('solve: evaluate is pure', () => {
  const g = compile(MINI);
  const s = new Solver(g);
  const v = s.evaluate(['tci'], { lang: 10 });
  assert.ok(v.tci > 0);
  assert.equal(s.get('tci'), undefined);
  assert.equal(s.get('lang'), 3);
});
