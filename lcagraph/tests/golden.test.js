const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./golden.js');

for (const id of G.listModels()) {
  test('golden: ' + id + ' reproduces its published dashboard', () => {
    const r = G.replay(id);
    const failures = [];
    r.scenarios.forEach((s) => {
      s.failures.forEach((f) => failures.push(s.name + ' / ' + f.output + ': expected ' + f.expected + ' got ' + f.actual));
    });
    assert.deepEqual(failures, []);
    assert.deepEqual(r.unmapped, [], 'every dashboard output must be mapped or explicitly skipped');
  });
}

test('golden: display parsing and tolerance', () => {
  assert.equal(G.parseDisplayed('$16.18M'), 16.18);
  assert.equal(G.parseDisplayed('1,011'), 1011);
  assert.equal(G.parseDisplayed('-86.6%'), -86.6);
  assert.equal(G.parseDisplayed('1.34e-3'), 0.00134);
  assert.ok(Math.abs(G.toleranceOf('16.18') - 0.005) < 1e-9);
  assert.ok(Math.abs(G.toleranceOf('1,011') - 0.5) < 1e-9);
  assert.ok(Math.abs(G.toleranceOf('1.34e-3') - 0.5e-5) < 1e-12);
});
