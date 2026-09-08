/* LCA Graph - document lint.

   The compiler rejects what cannot work; this reports what is merely poor practice so a
   model author (or a future authoring assistant) can improve a document before it ships.
   Returns { errors: [], warnings: [] } where errors come from the compiler. */
(function (global) {
  'use strict';

  var Compile = typeof require === 'function' ? require('./compile.js') : global.LCAG.compile;

  var SECTIONS = ['pml', 'meta', 'stages', 'components', 'params', 'tables', 'units', 'streams',
    'derived', 'checks', 'lcia', 'allocation', 'targets', 'sensitivity', 'diagram', 'stepCopy'];

  function validate(doc) {
    var errors = [];
    var warnings = [];
    var graph = null;
    function warn(where, msg) { warnings.push({ where: where, message: msg }); }

    if (!doc || typeof doc !== 'object') return { errors: [{ where: 'document', message: 'not an object' }], warnings: [], graph: null };
    Object.keys(doc).forEach(function (k) {
      if (SECTIONS.indexOf(k) === -1) warn(k, 'unknown top-level section');
    });
    if (doc.pml !== '0.1') warn('pml', 'expected pml version "0.1"');

    try { graph = Compile.compile(doc); }
    catch (e) { errors.push({ where: 'compile', message: e.message }); return { errors: errors, warnings: warnings, graph: null }; }

    var m = doc.meta || {};
    ['title', 'functionalUnit', 'boundary'].forEach(function (k) {
      if (!m[k]) warn('meta.' + k, 'missing');
    });
    (m.notes || []).forEach(function (n) {
      if (!n.text || !n.title) warn('meta.notes', 'note ' + (n.id || '?') + ' needs title and text');
      if (!n.nodes || !n.nodes.length) warn('meta.notes', 'note ' + (n.id || '?') + ' names no nodes');
    });

    var nodes = graph.nodes;
    var kpis = 0;
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if (n.kind === 'param') {
        if (!n.source) warn(id, 'param has no source');
        if (n.editable && !n.range) warn(id, 'editable param has no typical range');
        if (n.dim === 'count' && /price|cost|\$|kwh|mj|kg|tonne/i.test(n.label)) warn(id, 'label suggests a physical unit but dim is count');
      }
      if (n.kpi) kpis++;
    });
    if (kpis === 0) warn('derived', 'no node is marked kpi');
    if (kpis > 6) warn('derived', kpis + ' KPIs; six or fewer read better');

    var refd = {};
    Object.keys(nodes).forEach(function (id) { nodes[id].deps.forEach(function (d) { refd[d] = true; }); });
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if ((n.kind === 'param' || n.kind === 'cell') && !refd[id]) warn(id, 'input is never used');
    });

    var touched = {};
    Object.keys(graph.streams).forEach(function (s) { touched[graph.streams[s].from] = true; touched[graph.streams[s].to] = true; });
    Object.keys(graph.units).forEach(function (u) {
      if (!touched[u] && graph.units[u].kind !== 'cost_only' && graph.units[u].kind !== 'env') warn('units.' + u, 'unit has no streams');
    });

    if (!Object.keys(graph.targets).length) warn('targets', 'no calculation targets declared');
    if (!Object.keys(graph.sensitivity).length) warn('sensitivity', 'no sensitivity analyses declared');
    Object.keys(graph.targets).forEach(function (t) {
      (graph.targets[t].nodes || []).forEach(function (id) { if (!nodes[id]) errors.push({ where: 'targets.' + t, message: 'unknown node ' + id }); });
    });
    Object.keys(graph.sensitivity).forEach(function (s) {
      var spec = graph.sensitivity[s];
      var ids = spec.targets || (spec.target ? [spec.target] : []);
      if (!ids.length) errors.push({ where: 'sensitivity.' + s, message: 'no target' });
      ids.forEach(function (id) { if (!nodes[id]) errors.push({ where: 'sensitivity.' + s, message: 'unknown target ' + id }); });
      [spec.param, spec.param2].concat(Array.isArray(spec.params) ? spec.params : [], spec.params && typeof spec.params === 'object' && !Array.isArray(spec.params) ? Object.keys(spec.params) : [])
        .filter(Boolean).forEach(function (p) { if (!nodes[p]) errors.push({ where: 'sensitivity.' + s, message: 'unknown param ' + p }); });
    });

    return { errors: errors, warnings: warnings, graph: graph };
  }

  var api = { validate: validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).validate = api;
})(typeof window !== 'undefined' ? window : globalThis);
