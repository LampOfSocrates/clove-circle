/* LCA Graph - calculation targets.

   Given a set of target node ids, report what it takes to compute them: the ancestor
   subgraph, the stages it crosses, and the inputs it needs split into set and missing
   (a missing input has value null, which is what an uploaded flowsheet with unfilled
   parameters looks like). */
(function (global) {
  'use strict';

  var LEAF = { param: true, cell: true, 'const': true };

  function analyse(solver, targetIds) {
    var graph = solver.graph;
    var nodes = graph.nodes;
    targetIds.forEach(function (id) {
      if (!nodes[id]) throw new Error('targets: unknown node "' + id + '"');
    });
    var anc = graph.ancestors(targetIds);
    var all = targetIds.concat(anc.filter(function (a) { return targetIds.indexOf(a) === -1; }));
    var stages = {};
    var inputs = [];
    var computed = [];
    all.forEach(function (id) {
      var n = nodes[id];
      stages[n.stage] = true;
      if (LEAF[n.kind]) inputs.push(id); else computed.push(id);
    });
    var stageList = graph.stages.filter(function (s) { return stages[s]; });
    var set = [], missing = [];
    inputs.forEach(function (id) {
      var v = solver.get(id);
      if ((v === null || v === undefined) && !nodes[id].nullable) missing.push(id); else set.push(id);
    });
    var editable = inputs.filter(function (id) { return nodes[id].editable; });
    return {
      targets: targetIds,
      subgraph: all,
      stages: stageList,
      inputs: inputs,
      editable: editable,
      set: set,
      missing: missing,
      computed: computed,
      ready: missing.length === 0
    };
  }

  /* Solve just what the targets need, ignoring stage gating. Returns values for targets. */
  function compute(solver, targetIds, overrides) {
    var v = solver.evaluate(targetIds, overrides || {});
    var out = {};
    targetIds.forEach(function (id) { out[id] = v[id]; });
    return { values: out, converged: v.__converged !== false };
  }

  /* Resolve a named target from the document, or a raw node list. */
  function resolve(graph, nameOrIds) {
    if (Array.isArray(nameOrIds)) return { label: nameOrIds.join(', '), nodes: nameOrIds };
    var t = graph.targets[nameOrIds];
    if (!t) throw new Error('targets: unknown target "' + nameOrIds + '"');
    return { label: t.label || nameOrIds, nodes: t.nodes };
  }

  var api = { analyse: analyse, compute: compute, resolve: resolve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).targets = api;
})(typeof window !== 'undefined' ? window : globalThis);
