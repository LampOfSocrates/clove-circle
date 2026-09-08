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

    // Collect every structural problem first, so an author (human or model) fixes them in
    // one round instead of discovering them one compile at a time.
    prelint(doc).forEach(function (e) { errors.push(e); });
    if (errors.length) return { errors: errors, warnings: warnings, graph: null };

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
    (graph.danglingNotes || []).forEach(function (id) { warn('meta.notes', 'refers to unknown node "' + id + '"'); });

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

  var Units = typeof require === 'function' ? require('./units.js') : global.LCAG.units;
  var Expr = typeof require === 'function' ? require('./expr.js') : global.LCAG.expr;

  function prelint(doc) {
    var errs = [];
    function err(where, msg) { errs.push({ where: where, message: msg }); }
    var stages = {};
    (doc.stages || []).forEach(function (s) { if (s && s.id) stages[s.id] = true; });
    var declared = {};
    var seen = {};
    function declare(id, where) {
      if (seen[id]) err(where, 'duplicate node id "' + id + '" (already declared in ' + seen[id] + ')');
      seen[id] = where; declared[id] = true;
    }
    function checkUnit(where, dim, unit) {
      if (!dim) { err(where, 'dim is required'); return; }
      if (!Units.DIMENSIONS[dim]) { err(where, 'unknown dimension "' + dim + '"; allowed: ' + Object.keys(Units.DIMENSIONS).join(', ')); return; }
      if (unit !== undefined && unit !== null && !Units.hasUnit(dim, unit)) {
        err(where, '"' + unit + '" is not a unit of ' + dim + '; allowed: ' + Units.unitsFor(dim).map(function (u) { return u || '""'; }).join(', '));
      }
    }
    function checkStage(where, st) { if (st && !stages[st]) err(where, 'unknown stage "' + st + '"'); }
    Object.keys(doc.components || {}).forEach(function (id) { if (doc.components[id] && doc.components[id].mw !== undefined) declare('mw.' + id, 'components.' + id); });
    Object.keys(doc.params || {}).forEach(function (id) {
      var p = doc.params[id] || {}; declare(id, 'params.' + id);
      checkUnit('params.' + id, p.dim, p.unit); checkStage('params.' + id, p.stage);
      if (p.default === undefined) err('params.' + id, 'default is required');
    });
    var tableCols = {};
    Object.keys(doc.tables || {}).forEach(function (t) {
      var tb = doc.tables[t] || {}; checkStage('tables.' + t, tb.stage);
      tableCols[t] = {};
      Object.keys(tb.columns || {}).forEach(function (c) {
        var cs = tb.columns[c] || {}; tableCols[t][c] = true;
        if (cs.type !== 'text') checkUnit('tables.' + t + '.columns.' + c, cs.dim, cs.unit);
      });
      Object.keys(tb.rows || {}).forEach(function (r) {
        Object.keys(tb.columns || {}).forEach(function (c) {
          if ((tb.columns[c] || {}).type === 'text') return;
          declare(t + '.' + r + '.' + c, 'tables.' + t + '.rows.' + r);
          if ((tb.rows[r] || {})[c] === undefined) err('tables.' + t + '.rows.' + r, 'missing column "' + c + '"');
        });
      });
    });
    var unitIds = { env: true };
    Object.keys(doc.units || {}).forEach(function (u) { unitIds[u] = true; });
    var exprs = [];
    Object.keys(doc.streams || {}).forEach(function (id) {
      var st = doc.streams[id] || {}; declare(id, 'streams.' + id);
      checkUnit('streams.' + id, st.dim, st.unit); checkStage('streams.' + id, st.stage);
      if (!st.from || !st.to) err('streams.' + id, 'from and to are required (use "env" for the surroundings)');
      if (st.from && !unitIds[st.from]) err('streams.' + id, 'unknown unit "' + st.from + '" in from');
      if (st.to && !unitIds[st.to]) err('streams.' + id, 'unknown unit "' + st.to + '" in to');
      Object.keys(st.components || {}).forEach(function (c) {
        declare(id + '.' + c, 'streams.' + id + '.components.' + c);
        if (!doc.components || !doc.components[c]) err('streams.' + id, 'unknown component "' + c + '"');
        exprs.push({ where: 'streams.' + id + '.components.' + c, expr: st.components[c] });
      });
      if (st.expr !== undefined) exprs.push({ where: 'streams.' + id, expr: st.expr });
      else if (!st.components) err('streams.' + id, 'expr or components required');
    });
    Object.keys(doc.derived || {}).forEach(function (id) {
      var d = doc.derived[id] || {}; declare(id, 'derived.' + id);
      checkStage('derived.' + id, d.stage);
      if (!d.stage) err('derived.' + id, 'stage is required');
      if (d.dim) checkUnit('derived.' + id, d.dim, d.unit);
      if (d.table) {
        if (!tableCols[d.table]) err('derived.' + id, 'unknown table "' + d.table + '"');
        else if (d.column) {
          if (tableCols[d.table][d.column]) err('derived.' + id, 'column "' + d.column + '" already exists in table ' + d.table);
          tableCols[d.table][d.column] = true;
          Object.keys((doc.tables[d.table] || {}).rows || {}).forEach(function (r) { declare(d.table + '.' + r + '.' + d.column, 'derived.' + id); });
        }
      }
      if (d.solve) return;
      if (d.expr === undefined) err('derived.' + id, 'expr is required');
      else exprs.push({ where: 'derived.' + id, expr: d.expr, table: d.table });
    });
    Object.keys(doc.checks || {}).forEach(function (id) {
      var c = doc.checks[id] || {}; checkStage('checks.' + id, c.stage);
      if (c.kind === 'closure') {
        declare(id + '.in', 'checks.' + id); declare(id + '.out', 'checks.' + id); declare(id + '.error', 'checks.' + id);
        (c.in || []).concat(c.out || []).forEach(function (ref) { if (!declared[ref]) err('checks.' + id, 'unknown stream/node "' + ref + '"'); });
      } else if (c.kind === 'constraint') { declare(id, 'checks.' + id); if (c.expr) exprs.push({ where: 'checks.' + id, expr: c.expr }); }
      else err('checks.' + id, 'kind must be closure or constraint');
    });
    exprs.forEach(function (x) {
      var ast;
      try { ast = Expr.parse(x.expr); } catch (e) { err(x.where, e.message); return; }
      var d = Expr.deps(ast);
      d.ids.forEach(function (ref) {
        if (x.table && ref.indexOf('row.') === 0) {
          var col = ref.slice(4);
          if (!tableCols[x.table] || !tableCols[x.table][col]) err(x.where, 'row.' + col + ': table ' + x.table + ' has no column "' + col + '"');
          return;
        }
        if (ref === 'null' || ref === 'undefined' || ref === 'NaN') { err(x.where, 'there is no ' + ref + ' literal; a quantity that does not exist should not be a node, and a series that never pays back is an economics problem, not a formula problem'); return; }
        if (!declared[ref]) err(x.where, 'unknown identifier "' + ref + '"');
      });
      d.cols.forEach(function (tc) {
        var parts = tc.split('.');
        if (!tableCols[parts[0]]) err(x.where, 'col(): unknown table "' + parts[0] + '"');
        else if (!tableCols[parts[0]][parts[1]]) err(x.where, 'col(): table ' + parts[0] + ' has no column "' + parts[1] + '"');
      });
    });
    return errs;
  }

  var api = { validate: validate, prelint: prelint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).validate = api;
})(typeof window !== 'undefined' ? window : globalThis);
