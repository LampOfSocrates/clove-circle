/* Clove Circle — staged solve engine.

   A model declares variables (inputs and computed) each tagged with a stage.
   Stages run in order; a stage is locked until its predecessor has solved, and
   editing an input marks its own stage and every later stage stale. That
   staleness is the teaching device: it shows dependency direction for free. */
(function (global) {
  'use strict';

  var U = global.CCUnits;

  function CCEngine(model) {
    this.model = model;
    this.stages = model.stages.map(function (s) { return s.id; });
    this.values = {};      // varId -> canonical value
    this.display = {};     // varId -> unit the user last chose
    this.solved = {};      // stageId -> true once computed and not since invalidated
    this.previous = {};    // varId -> value at the previous solve, for deltas
    this.listeners = [];
    this.reset();
  }

  CCEngine.prototype.on = function (fn) { this.listeners.push(fn); };

  CCEngine.prototype.emit = function (evt) {
    this.listeners.forEach(function (fn) { fn(evt); });
  };

  CCEngine.prototype.reset = function () {
    var self = this;
    this.values = {};
    this.display = {};
    this.previous = {};
    this.solved = {};
    Object.keys(this.model.vars).forEach(function (id) {
      var v = self.model.vars[id];
      self.display[id] = v.unit || U.canonicalUnit(v.dim);
      if (v.kind === 'input') self.values[id] = v.default;
    });
    this.emit({ type: 'reset' });
  };

  CCEngine.prototype.varDef = function (id) {
    var v = this.model.vars[id];
    if (!v) throw new Error('cc-engine: unknown variable "' + id + '"');
    return v;
  };

  CCEngine.prototype.stageIndex = function (stageId) {
    return this.stages.indexOf(stageId);
  };

  /* A stage can run once every earlier stage has solved. */
  CCEngine.prototype.isUnlocked = function (stageId) {
    var i = this.stageIndex(stageId);
    for (var k = 0; k < i; k++) {
      if (!this.solved[this.stages[k]]) return false;
    }
    return true;
  };

  CCEngine.prototype.isStale = function (stageId) {
    return !this.solved[stageId];
  };

  /* Editing at stage s invalidates s and everything downstream of it. */
  CCEngine.prototype.invalidateFrom = function (stageId) {
    var i = this.stageIndex(stageId);
    for (var k = i; k < this.stages.length; k++) delete this.solved[this.stages[k]];
  };

  CCEngine.prototype.setValue = function (id, canonicalValue, unit) {
    var v = this.varDef(id);
    if (v.kind !== 'input') throw new Error('cc-engine: "' + id + '" is computed, not an input');
    this.values[id] = canonicalValue;
    if (unit) this.display[id] = unit;
    this.invalidateFrom(v.stage);
    this.emit({ type: 'change', id: id, stage: v.stage });
  };

  CCEngine.prototype.get = function (id) { return this.values[id]; };

  CCEngine.prototype.delta = function (id) {
    var prev = this.previous[id];
    var now = this.values[id];
    if (prev === undefined || now === undefined || !isFinite(prev) || prev === 0) return null;
    return (now - prev) / Math.abs(prev);
  };

  /* Computed vars are resolved by repeated passes: cheap, order-independent, and
     it surfaces a genuine circular reference instead of silently producing NaN. */
  CCEngine.prototype.solve = function (stageId) {
    var self = this;
    if (!this.isUnlocked(stageId)) {
      return { ok: false, error: 'Earlier stages have not been solved yet.' };
    }

    Object.keys(this.model.vars).forEach(function (id) {
      if (self.model.vars[id].stage === stageId) self.previous[id] = self.values[id];
    });

    var pending = Object.keys(this.model.vars).filter(function (id) {
      var v = self.model.vars[id];
      return v.kind === 'computed' && v.stage === stageId;
    });

    var guard = pending.length + 2;
    while (pending.length && guard-- > 0) {
      var stuck = [];
      pending.forEach(function (id) {
        var v = self.varDef(id);
        var ready = (v.deps || []).every(function (d) {
          return self.values[d] !== undefined && isFinite(self.values[d]);
        });
        if (!ready) { stuck.push(id); return; }
        self.values[id] = v.fn(self.values);
      });
      if (stuck.length === pending.length) {
        return { ok: false, error: 'Unresolved dependencies: ' + stuck.join(', ') };
      }
      pending = stuck;
    }
    if (pending.length) {
      return { ok: false, error: 'Circular dependency: ' + pending.join(', ') };
    }

    this.solved[stageId] = true;
    var result = { ok: true, stage: stageId, closure: this.closure(stageId) };
    this.emit({ type: 'solved', stage: stageId, result: result });
    return result;
  };

  /* Mass in vs mass out. Showing the closure error is the entire point of doing a
     mass balance, so it is reported rather than assumed. */
  CCEngine.prototype.closure = function (stageId) {
    var self = this;
    var spec = (this.model.closure || {})[stageId];
    if (!spec) return null;
    var sum = function (ids) {
      return ids.reduce(function (t, id) { return t + (self.values[id] || 0); }, 0);
    };
    var inTotal = sum(spec.in);
    var outTotal = sum(spec.out);
    var error = inTotal === 0 ? 0 : (outTotal - inTotal) / inTotal;
    var tol = spec.tolerance === undefined ? 0.01 : spec.tolerance;
    return {
      in: inTotal,
      out: outTotal,
      error: error,
      tolerance: tol,
      ok: Math.abs(error) <= tol,
      unit: spec.unit || '',
      label: spec.label || 'Mass balance closure'
    };
  };

  CCEngine.prototype.solveAll = function () {
    var out = [];
    for (var i = 0; i < this.stages.length; i++) {
      var r = this.solve(this.stages[i]);
      out.push(r);
      if (!r.ok) break;
    }
    return out;
  };

  global.CCEngine = CCEngine;
})(window);
