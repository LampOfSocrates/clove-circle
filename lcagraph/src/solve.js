/* LCA Graph - executor.

   Holds the values of a compiled graph and evaluates nodes in topological order.

   Two ways to run:
   - stage by stage (`solve(stageId)`), which is the teaching flow: a stage is locked until
     every earlier stage is clean, and editing an input dirties its descendants only;
   - to a target (`evaluate(targetIds, overrides)`), a pure function used by targets,
     sensitivity and design-spec (solve) nodes. It never touches the main state.

   Recycle streams flagged as tears are iterated by successive substitution. */
(function (global) {
  'use strict';

  var Expr = typeof require === 'function' ? require('./expr.js') : global.LCAG.expr;
  var Fns = typeof require === 'function' ? require('./functions.js') : global.LCAG.functions;

  var LEAF = { param: true, cell: true, 'const': true };

  function Solver(graph) {
    this.graph = graph;
    this.nodes = graph.nodes;
    this.order = graph.order;
    this.values = {};
    this.dirty = {};
    this.solved = {};
    this.previous = {};
    this.errors = {};
    this.listeners = [];
    this.reset();
  }

  Solver.prototype.on = function (fn) { this.listeners.push(fn); };
  Solver.prototype.emit = function (evt) { this.listeners.forEach(function (fn) { fn(evt); }); };

  Solver.prototype.reset = function () {
    var self = this;
    this.values = {};
    this.dirty = {};
    this.solved = {};
    this.previous = {};
    this.errors = {};
    Object.keys(this.nodes).forEach(function (id) {
      var n = self.nodes[id];
      if (LEAF[n.kind]) self.values[id] = n.default !== undefined ? n.default : n.value;
      else self.dirty[id] = true;
    });
    this.emit({ type: 'reset' });
  };

  Solver.prototype.get = function (id) { return this.values[id]; };

  Solver.prototype.isLeaf = function (id) { return !!LEAF[this.nodes[id].kind]; };

  /* Set a leaf (param or cell) in canonical units and dirty everything downstream. */
  Solver.prototype.set = function (id, canonicalValue) {
    var self = this;
    var n = this.nodes[id];
    if (!n) throw new Error('solve: unknown node "' + id + '"');
    if (!LEAF[n.kind]) throw new Error('solve: "' + id + '" is computed, not an input');
    this.values[id] = canonicalValue;
    var down = this.graph.descendants([id]);
    down.forEach(function (d) { self.dirty[d] = true; });
    var stagesTouched = {};
    down.forEach(function (d) { stagesTouched[self.nodes[d].stage] = true; });
    Object.keys(stagesTouched).forEach(function (s) { delete self.solved[s]; });
    this.emit({ type: 'change', id: id, stage: n.stage });
  };

  Solver.prototype.stageIsDirty = function (stageId) {
    var self = this;
    return Object.keys(this.dirty).some(function (id) { return self.nodes[id].stage === stageId; });
  };

  Solver.prototype.isSolved = function (stageId) { return !!this.solved[stageId]; };

  Solver.prototype.isUnlocked = function (stageId) {
    var i = this.graph.stageIndex[stageId];
    for (var k = 0; k < i; k++) if (!this.solved[this.graph.stages[k]]) return false;
    return true;
  };

  Solver.prototype.isStale = function (id) { return !!this.dirty[id]; };

  Solver.prototype.delta = function (id) {
    var prev = this.previous[id];
    var now = this.values[id];
    if (typeof prev !== 'number' || typeof now !== 'number' || !isFinite(prev) || prev === 0) return null;
    return (now - prev) / Math.abs(prev);
  };

  /* ── evaluation core ───────────────────────────────────────────────────── */

  function makeScope(graph, values) {
    return {
      get: function (id) { return values[id]; },
      column: function (table, column) {
        var t = graph.tables[table];
        if (!t) throw new Error('solve: unknown table "' + table + '"');
        if (!t.columns[column]) throw new Error('solve: table ' + table + ' has no column "' + column + '"');
        return t.rowIds.map(function (r) { return values[table + '.' + r + '.' + column]; });
      }
    };
  }

  /* Evaluate one node into `values`. Returns the value. */
  Solver.prototype.evalNode = function (id, values, scope) {
    var n = this.nodes[id];
    if (LEAF[n.kind]) return values[id];
    if (n.kind === 'array') {
      values[id] = n.arrayOf.map(function (r) { return values[r]; });
      return values[id];
    }
    if (n.kind === 'solve') return this.evalSolveNode(n, values);
    var v = Expr.evaluate(n.ast, scope, Fns.FNS);
    if (typeof v === 'number' && !isFinite(v)) v = null;
    values[id] = v;
    return v;
  };

  /* Design spec: find x for `vary` such that target(x) = equals. Uses a scratch copy. */
  Solver.prototype.evalSolveNode = function (n, values) {
    var self = this;
    var s = n.solve;
    var sub = this.subgraphOrder([s.target]);
    var f = function (x) {
      var scratch = Object.assign({}, values);
      scratch[s.vary] = x;
      var scope = makeScope(self.graph, scratch);
      for (var i = 0; i < sub.length; i++) {
        if (sub[i] === s.vary) continue;
        self.evalNode(sub[i], scratch, scope);
      }
      var t = scratch[s.target];
      return t === null || t === undefined ? null : t - s.equals;
    };
    var lo = s.lo === undefined ? 0 : s.lo;
    var hi = s.hi === undefined ? 1e9 : s.hi;
    var root = Fns.brent(f, lo, hi, 1e-9 * Math.max(1, Math.abs(hi - lo)), 300);
    // A declared bracket that misses the root is the commonest authoring slip; widen it
    // geometrically a few times before giving up.
    var tries = 0;
    while (root === null && tries++ < 8) {
      var span = Math.max(Math.abs(hi - lo), 1);
      lo = lo - span; hi = hi + span * 4;
      root = Fns.brent(f, lo, hi, 1e-9 * Math.max(1, Math.abs(hi - lo)), 300);
    }
    values[n.id] = root;
    return root;
  };

  /* Ancestors of ids (plus ids), in topological order. */
  Solver.prototype.subgraphOrder = function (ids) {
    var want = {};
    ids.forEach(function (id) { want[id] = true; });
    this.graph.ancestors(ids).forEach(function (id) { want[id] = true; });
    return this.order.filter(function (id) { return want[id]; });
  };

  /* Iterate a list of node ids until every tear stream in it converges. */
  Solver.prototype.runOrdered = function (ids, values, opts) {
    var self = this;
    var scope = makeScope(this.graph, values);
    var tears = this.graph.tears.filter(function (t) { return ids.indexOf(t) !== -1; });
    if (!tears.length) {
      ids.forEach(function (id) { self.evalNode(id, values, scope); });
      return { converged: true, iterations: 1 };
    }
    tears.forEach(function (t) {
      if (values[t] === undefined || values[t] === null) values[t] = self.nodes[t].guess || 0;
    });
    var maxIter = (opts && opts.maxIter) || 200;
    var tol = (opts && opts.tol) || 1e-9;
    // First pass: everything except the tears, which keep their guess until their
    // inputs exist.
    ids.forEach(function (id) { if (tears.indexOf(id) === -1) self.evalNode(id, values, scope); });
    for (var it = 1; it <= maxIter; it++) {
      var before = tears.map(function (t) { return values[t]; });
      ids.forEach(function (id) { self.evalNode(id, values, scope); });
      var done = tears.every(function (t, i) {
        var a = before[i], b = values[t];
        if (a === null || b === null) return false;
        return Math.abs(b - a) <= tol * Math.max(1, Math.abs(b));
      });
      if (done) return { converged: true, iterations: it };
    }
    return { converged: false, iterations: maxIter };
  };

  /* Pure evaluation of the ancestors of `targets` with leaf overrides. Returns a values map. */
  Solver.prototype.evaluate = function (targets, overrides) {
    var self = this;
    var values = {};
    Object.keys(this.nodes).forEach(function (id) {
      if (LEAF[self.nodes[id].kind]) values[id] = self.values[id];
    });
    Object.keys(overrides || {}).forEach(function (id) {
      if (!self.nodes[id] || !LEAF[self.nodes[id].kind]) throw new Error('solve: override "' + id + '" is not an input');
      values[id] = overrides[id];
    });
    var ids = this.subgraphOrder(targets);
    var run = this.runOrdered(ids, values);
    values.__converged = run.converged;
    return values;
  };

  /* ── stage flow ────────────────────────────────────────────────────────── */

  Solver.prototype.stageNodes = function (stageId) {
    var self = this;
    return this.order.filter(function (id) { return self.nodes[id].stage === stageId; });
  };

  Solver.prototype.solve = function (stageId) {
    var self = this;
    if (!(stageId in this.graph.stageIndex)) throw new Error('solve: unknown stage "' + stageId + '"');
    if (!this.isUnlocked(stageId)) {
      return { ok: false, stage: stageId, error: 'Earlier stages have not been solved yet.' };
    }
    var ids = this.stageNodes(stageId);
    ids.forEach(function (id) { self.previous[id] = self.values[id]; });
    this.errors[stageId] = null;

    var run;
    try {
      run = this.runOrdered(ids, this.values);
    } catch (e) {
      this.errors[stageId] = e.message;
      return { ok: false, stage: stageId, error: e.message };
    }
    ids.forEach(function (id) { delete self.dirty[id]; });

    var result = { ok: true, stage: stageId, converged: run.converged, iterations: run.iterations,
      closures: this.closures(stageId), constraints: this.constraints(stageId) };
    if (!run.converged) {
      result.ok = false;
      result.error = 'Recycle did not converge after ' + run.iterations + ' iterations.';
    }
    var hard = result.constraints.filter(function (c) { return c.severity === 'hard' && !c.ok; });
    if (hard.length) {
      result.ok = false;
      result.error = hard.map(function (c) { return c.message; }).join(' ');
    }
    if (result.ok) this.solved[stageId] = true;
    else { delete this.solved[stageId]; this.errors[stageId] = result.error; }
    this.emit({ type: 'solved', stage: stageId, result: result });
    return result;
  };

  Solver.prototype.solveAll = function () {
    var out = [];
    for (var i = 0; i < this.graph.stages.length; i++) {
      var r = this.solve(this.graph.stages[i]);
      out.push(r);
      if (!r.ok) break;
    }
    return out;
  };

  Solver.prototype.closures = function (stageId) {
    var self = this;
    return Object.keys(this.graph.checks).map(function (id) { return self.graph.checks[id]; })
      .filter(function (c) { return c.kind === 'closure' && (!stageId || c.stage === stageId); })
      .map(function (c) {
        var err = self.values[c.id + '.error'];
        return {
          id: c.id, label: c.label, unit: c.unit, dim: c.dim, stage: c.stage,
          in: self.values[c.id + '.in'], out: self.values[c.id + '.out'],
          error: err, tolerance: c.tolerance,
          ok: typeof err === 'number' && Math.abs(err) <= c.tolerance
        };
      });
  };

  Solver.prototype.constraints = function (stageId) {
    var self = this;
    return Object.keys(this.graph.checks).map(function (id) { return self.graph.checks[id]; })
      .filter(function (c) { return c.kind === 'constraint' && (!stageId || c.stage === stageId); })
      .map(function (c) {
        return { id: c.id, severity: c.severity, message: c.message, stage: c.stage, ok: !!self.values[c.id] };
      });
  };

  /* Inspector helper: formula text and resolved inputs for a node. */
  Solver.prototype.explain = function (id) {
    var self = this;
    var n = this.nodes[id];
    if (!n) return null;
    return {
      id: id, label: n.label, kind: n.kind, stage: n.stage, dim: n.dim, unit: n.unit,
      value: this.values[id], stale: !!this.dirty[id],
      formula: n.kind === 'derived' || n.kind === 'stream' || n.kind === 'component' || n.kind === 'rowderived' || n.kind === 'constraint'
        ? n.exprText : (n.kind === 'solve' ? n.exprText : null),
      inputs: n.deps.map(function (d) {
        var dn = self.nodes[d];
        return { id: d, label: dn.label, value: self.values[d], dim: dn.dim, unit: dn.unit, kind: dn.kind, stale: !!self.dirty[d] };
      }),
      notes: n.notes || [], basis: n.basis || '', source: n.source || ''
    };
  };

  var api = { Solver: Solver, makeScope: makeScope };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).solve = api;
})(typeof window !== 'undefined' ? window : globalThis);
