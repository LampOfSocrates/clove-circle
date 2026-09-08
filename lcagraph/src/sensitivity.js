/* LCA Graph - sensitivity analysis.

   Every analysis is a list of pure re-evaluations of the target subgraph with input
   overrides. Nothing here mutates the solver. All values in a spec are in the param's
   declared display unit; results are returned canonically with the unit alongside. */
(function (global) {
  'use strict';

  var Units = typeof require === 'function' ? require('./units.js') : global.LCAG.units;

  function toCanon(node, v) { return Units.toCanonical(v, node.dim, node.unit); }

  function targetIds(spec) {
    if (spec.targets) return spec.targets;
    if (spec.target) return [spec.target];
    throw new Error('sensitivity: target or targets required');
  }

  function pick(values, ids) {
    var out = {};
    ids.forEach(function (id) { out[id] = values[id]; });
    return out;
  }

  function baseline(solver, ids) {
    return pick(solver.evaluate(ids, {}), ids);
  }

  function paramList(solver, spec, ids) {
    var nodes = solver.graph.nodes;
    if (spec.params === 'editable' || spec.params === undefined) {
      var anc = solver.graph.ancestors(ids);
      return anc.filter(function (id) {
        var n = nodes[id];
        return (n.kind === 'param' || n.kind === 'cell') && n.editable && typeof solver.get(id) === 'number';
      });
    }
    return spec.params;
  }

  /* One-at-a-time: each param ±delta (fraction) or to explicit [lo, hi] in display units. */
  function oat(solver, spec) {
    var ids = targetIds(spec);
    var nodes = solver.graph.nodes;
    var base = baseline(solver, ids);
    var delta = spec.delta === undefined ? 0.1 : spec.delta;
    var params = paramList(solver, spec, ids);
    var rows = params.map(function (pid) {
      var n = nodes[pid];
      var v0 = solver.get(pid);
      var lo, hi;
      if (spec.ranges && spec.ranges[pid]) {
        lo = toCanon(n, spec.ranges[pid][0]); hi = toCanon(n, spec.ranges[pid][1]);
      } else {
        lo = v0 * (1 - delta); hi = v0 * (1 + delta);
      }
      var ovLo = {}; ovLo[pid] = lo;
      var ovHi = {}; ovHi[pid] = hi;
      var vLo = pick(solver.evaluate(ids, ovLo), ids);
      var vHi = pick(solver.evaluate(ids, ovHi), ids);
      var per = {};
      ids.forEach(function (t) {
        var b = base[t];
        var a = vLo[t], c = vHi[t];
        var swing = (typeof a === 'number' && typeof c === 'number') ? Math.abs(c - a) : null;
        var elasticity = (typeof a === 'number' && typeof c === 'number' && b && v0 && spec.ranges === undefined)
          ? ((c - a) / b) / (2 * delta) : null;
        per[t] = { low: a, high: c, base: b, swing: swing, elasticity: elasticity };
      });
      return { param: pid, label: n.label, unit: n.unit, dim: n.dim, base: v0, lo: lo, hi: hi, results: per };
    });
    var primary = ids[0];
    rows.sort(function (a, b) {
      var sa = a.results[primary].swing, sb = b.results[primary].swing;
      return (sb === null ? -1 : sb) - (sa === null ? -1 : sa);
    });
    return { kind: 'oat', targets: ids, base: base, delta: delta, rows: rows };
  }

  function linspace(from, to, steps) {
    var out = [];
    var n = Math.max(1, Math.round(steps));
    for (var i = 0; i <= n; i++) out.push(from + (to - from) * i / n);
    return out;
  }

  function sweepValues(node, spec, suffix) {
    var s = suffix || '';
    if (spec['values' + s]) return spec['values' + s].map(function (v) { return toCanon(node, v); });
    return linspace(toCanon(node, spec['from' + s]), toCanon(node, spec['to' + s]), spec['steps' + s] || 10);
  }

  /* 1-D or 2-D sweep. */
  function sweep(solver, spec) {
    var ids = targetIds(spec);
    var nodes = solver.graph.nodes;
    var p1 = nodes[spec.param];
    if (!p1) throw new Error('sensitivity: unknown param "' + spec.param + '"');
    var xs = sweepValues(p1, spec, '');
    if (!spec.param2) {
      var points = xs.map(function (x) {
        var ov = {}; ov[spec.param] = x;
        return { x: x, values: pick(solver.evaluate(ids, ov), ids) };
      });
      return { kind: 'sweep', targets: ids, param: spec.param, unit: p1.unit, dim: p1.dim, x: xs, points: points };
    }
    var p2 = nodes[spec.param2];
    if (!p2) throw new Error('sensitivity: unknown param "' + spec.param2 + '"');
    var ys = sweepValues(p2, spec, '2');
    var grid = ys.map(function (y) {
      return xs.map(function (x) {
        var ov = {}; ov[spec.param] = x; ov[spec.param2] = y;
        return pick(solver.evaluate(ids, ov), ids);
      });
    });
    return { kind: 'sweep2', targets: ids, param: spec.param, param2: spec.param2,
      unit: p1.unit, unit2: p2.unit, dim: p1.dim, dim2: p2.dim, x: xs, y: ys, grid: grid };
  }

  /* Named scenarios of overrides, in display units. */
  function scenario(solver, spec) {
    var ids = targetIds(spec);
    var nodes = solver.graph.nodes;
    var base = baseline(solver, ids);
    var rows = Object.keys(spec.scenarios || {}).map(function (name) {
      var ov = {};
      Object.keys(spec.scenarios[name]).forEach(function (pid) {
        if (!nodes[pid]) throw new Error('sensitivity: unknown param "' + pid + '" in scenario ' + name);
        ov[pid] = toCanon(nodes[pid], spec.scenarios[name][pid]);
      });
      var v = pick(solver.evaluate(ids, ov), ids);
      var change = {};
      ids.forEach(function (t) {
        change[t] = (typeof base[t] === 'number' && base[t] !== 0 && typeof v[t] === 'number') ? (v[t] - base[t]) / Math.abs(base[t]) : null;
      });
      return { name: name, overrides: ov, values: v, change: change };
    });
    return { kind: 'scenario', targets: ids, base: base, rows: rows };
  }

  /* ── seeded random ─────────────────────────────────────────────────────── */
  function xorshift(seed) {
    var x = (seed >>> 0) || 88675123;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      return (x >>> 0) / 4294967296;
    };
  }

  function sampler(dist, rnd) {
    var d = dist.dist || 'uniform';
    if (d === 'uniform') return function () { return dist.min + (dist.max - dist.min) * rnd(); };
    if (d === 'triangular') {
      return function () {
        var u = rnd(), a = dist.min, b = dist.max, c = dist.mode;
        var f = (c - a) / (b - a);
        return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
      };
    }
    var normal = function () {
      var u = Math.max(rnd(), 1e-12), v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    if (d === 'normal') return function () { return dist.mean + dist.sd * normal(); };
    if (d === 'lognormal') return function () { return dist.median * Math.exp(dist.sigma * normal()); };
    throw new Error('sensitivity: unknown distribution "' + d + '"');
  }

  function percentile(sorted, p) {
    if (!sorted.length) return null;
    var i = (sorted.length - 1) * p;
    var lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  function montecarlo(solver, spec) {
    var ids = targetIds(spec);
    var nodes = solver.graph.nodes;
    var n = spec.n || 1000;
    var rnd = xorshift(spec.seed === undefined ? 1 : spec.seed);
    var samplers = Object.keys(spec.params || {}).map(function (pid) {
      if (!nodes[pid]) throw new Error('sensitivity: unknown param "' + pid + '"');
      return { id: pid, node: nodes[pid], draw: sampler(spec.params[pid], rnd) };
    });
    var samples = ids.map(function () { return []; });
    var failures = 0;
    for (var i = 0; i < n; i++) {
      var ov = {};
      samplers.forEach(function (s) { ov[s.id] = toCanon(s.node, s.draw()); });
      var v = solver.evaluate(ids, ov);
      ids.forEach(function (t, k) {
        if (typeof v[t] === 'number' && isFinite(v[t])) samples[k].push(v[t]); else failures++;
      });
    }
    var stats = {};
    ids.forEach(function (t, k) {
      var s = samples[k].slice().sort(function (a, b) { return a - b; });
      var mean = s.reduce(function (a, b) { return a + b; }, 0) / (s.length || 1);
      var sd = Math.sqrt(s.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (s.length || 1));
      var bins = spec.bins || 30;
      var lo = s[0], hi = s[s.length - 1];
      var hist = [];
      for (var b = 0; b < bins; b++) hist.push(0);
      if (s.length && hi > lo) {
        s.forEach(function (x) { hist[Math.min(bins - 1, Math.floor((x - lo) / (hi - lo) * bins))]++; });
      }
      stats[t] = {
        n: s.length, mean: mean, sd: sd, min: lo, max: hi,
        p5: percentile(s, 0.05), p10: percentile(s, 0.1), p50: percentile(s, 0.5),
        p90: percentile(s, 0.9), p95: percentile(s, 0.95),
        probPositive: s.length ? s.filter(function (x) { return x > 0; }).length / s.length : null,
        histogram: { lo: lo, hi: hi, bins: hist }
      };
    });
    return { kind: 'montecarlo', targets: ids, n: n, seed: spec.seed, failures: failures, stats: stats };
  }

  function run(solver, spec) {
    switch (spec.kind) {
      case 'oat': return oat(solver, spec);
      case 'sweep': return sweep(solver, spec);
      case 'scenario': return scenario(solver, spec);
      case 'montecarlo': return montecarlo(solver, spec);
      default: throw new Error('sensitivity: unknown kind "' + spec.kind + '"');
    }
  }

  var api = { run: run, oat: oat, sweep: sweep, scenario: scenario, montecarlo: montecarlo, xorshift: xorshift };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).sensitivity = api;
})(typeof window !== 'undefined' ? window : globalThis);
