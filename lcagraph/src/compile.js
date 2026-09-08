/* LCA Graph - compiler.

   Turns a PML document into a calc graph: a map of nodes, each with a stage, a dimension,
   an expression AST and a dependency list inferred from that expression, plus a topological
   order. The compiler is strict: unknown identifiers, dependencies on a later stage, and
   cycles without a declared tear stream are errors, because a graph that silently produces
   NaN teaches nothing. */
(function (global) {
  'use strict';

  var Expr = typeof require === 'function' ? require('./expr.js') : global.LCAG.expr;
  var Units = typeof require === 'function' ? require('./units.js') : global.LCAG.units;

  var ID = /^[a-z][a-z0-9_]*$/;

  function fail(msg) { throw new Error('pml: ' + msg); }

  function checkId(id, what) {
    if (!ID.test(id)) fail(what + ' id "' + id + '" must match ' + ID);
  }

  function each(obj, fn) {
    Object.keys(obj || {}).forEach(function (k) { fn(k, obj[k]); });
  }

  /* Substitute the `row.` prefix so one per-row expression becomes one AST per row. */
  function rebindRow(ast, table, rowId) {
    function walk(n) {
      switch (n.k) {
        case 'id':
          if (n.v.indexOf('row.') === 0) return { k: 'id', v: table + '.' + rowId + '.' + n.v.slice(4) };
          return n;
        case 'neg': case 'not': return { k: n.k, a: walk(n.a) };
        case 'bin': return { k: 'bin', op: n.op, l: walk(n.l), r: walk(n.r) };
        case 'cond': return { k: 'cond', c: walk(n.c), a: walk(n.a), b: walk(n.b) };
        case 'call': return { k: 'call', fn: n.fn, args: n.args.map(walk) };
        case 'arr': return { k: 'arr', items: n.items.map(walk) };
        default: return n;
      }
    }
    return walk(ast);
  }

  function compile(doc) {
    if (!doc || typeof doc !== 'object') fail('document must be an object');
    if (!doc.meta || !doc.meta.id) fail('meta.id is required');
    if (!Array.isArray(doc.stages) || !doc.stages.length) fail('stages must be a non-empty array');

    var stages = doc.stages.map(function (s) { checkId(s.id, 'stage'); return s.id; });
    var stageIndex = {};
    stages.forEach(function (s, i) { stageIndex[s] = i; });
    var firstStage = stages[0];

    var nodes = {};
    var tables = {};      // name -> { columns, rowIds, stage }
    var notesByNode = {};

    function stageOf(spec, fallback, where) {
      var s = spec.stage || fallback;
      if (!(s in stageIndex)) fail(where + ': unknown stage "' + s + '"');
      return s;
    }

    function addNode(n) {
      if (nodes[n.id]) fail('duplicate node id "' + n.id + '"');
      if (n.dim && !Units.DIMENSIONS[n.dim]) fail(n.id + ': unknown dimension "' + n.dim + '"');
      if (n.dim && n.unit !== undefined && n.unit !== null && !Units.hasUnit(n.dim, n.unit)) {
        fail(n.id + ': "' + n.unit + '" is not a unit of ' + n.dim);
      }
      if (n.dim && (n.unit === undefined || n.unit === null)) n.unit = Units.canonicalUnit(n.dim);
      n.deps = n.deps || [];
      nodes[n.id] = n;
      return n;
    }

    (doc.meta.notes || []).forEach(function (note, i) {
      note.id = note.id || 'note' + (i + 1);
      (note.nodes || []).forEach(function (id) {
        (notesByNode[id] = notesByNode[id] || []).push(note.id);
      });
    });

    /* components */
    each(doc.components, function (id, c) {
      checkId(id, 'component');
      if (c.mw !== undefined) {
        addNode({ id: 'mw.' + id, kind: 'const', label: (c.label || id) + ' molecular weight',
          stage: firstStage, dim: 'molar_mass', unit: 'kg/kmol', value: c.mw, editable: false,
          source: c.source });
      }
    });

    /* params */
    each(doc.params, function (id, p) {
      checkId(id, 'param');
      if (!p.dim) fail('param ' + id + ': dim is required');
      if (p.default === undefined) fail('param ' + id + ': default is required');
      var unit = p.unit === undefined ? Units.canonicalUnit(p.dim) : p.unit;
      var n = addNode({
        id: id, kind: 'param', label: p.label || id, stage: stageOf(p, firstStage, 'param ' + id),
        dim: p.dim, unit: unit,
        value: p.default === null ? null : Units.toCanonical(p.default, p.dim, unit),
        range: p.range ? p.range.map(function (r) { return Units.toCanonical(r, p.dim, unit); }) : null,
        editable: p.editable !== false, source: p.source || '', hit: p.hit || null,
        basis: p.basis || '', role: p.role || 'param', group: p.group || null
      });
      n.default = n.value;
    });

    /* tables */
    each(doc.tables, function (name, t) {
      checkId(name, 'table');
      var stage = stageOf(t, firstStage, 'table ' + name);
      var cols = t.columns || {};
      var rowIds = Object.keys(t.rows || {});
      rowIds.forEach(function (r) { checkId(r, 'table ' + name + ' row'); });
      tables[name] = { label: t.label || name, stage: stage, columns: Object.assign({}, cols), rowIds: rowIds, rows: t.rows };
      rowIds.forEach(function (r) {
        var row = t.rows[r];
        each(cols, function (c, cspec) {
          checkId(c, 'table ' + name + ' column');
          if (cspec.type === 'text') return;
          if (!cspec.dim) fail('table ' + name + '.' + c + ': dim is required for numeric columns');
          var v = row[c];
          if (v === undefined) fail('table ' + name + ' row ' + r + ': missing column ' + c);
          var unit = cspec.unit === undefined ? Units.canonicalUnit(cspec.dim) : cspec.unit;
          var n = addNode({
            id: name + '.' + r + '.' + c, kind: 'cell', table: name, row: r, column: c,
            label: (row.label || r) + ' · ' + (cspec.label || c),
            stage: stage, dim: cspec.dim, unit: unit,
            value: v === null ? null : Units.toCanonical(v, cspec.dim, unit),
            editable: !!cspec.editable, nullable: !!cspec.nullable, role: 'cell', group: name
          });
          n.default = n.value;
        });
      });
    });

    /* units (topology only) */
    var units = {};
    each(doc.units, function (id, u) {
      checkId(id, 'unit');
      units[id] = {
        id: id, label: u.label || id, sub: u.sub || '', kind: u.kind || 'custom',
        params: u.params || [], notes: u.notes || []
      };
    });
    if (!units.env) units.env = { id: 'env', label: 'Environment', kind: 'env', params: [] };

    /* streams */
    var streams = {};
    each(doc.streams, function (id, s) {
      checkId(id, 'stream');
      if (!s.from || !s.to) fail('stream ' + id + ': from and to are required');
      if (!units[s.from]) fail('stream ' + id + ': unknown unit "' + s.from + '"');
      if (!units[s.to]) fail('stream ' + id + ': unknown unit "' + s.to + '"');
      if (!s.dim) fail('stream ' + id + ': dim is required');
      var stage = stageOf(s, firstStage, 'stream ' + id);
      var compIds = Object.keys(s.components || {});
      compIds.forEach(function (c) {
        if (!doc.components || !doc.components[c]) fail('stream ' + id + ': unknown component "' + c + '"');
        addNode({
          id: id + '.' + c, kind: 'component', stream: id, component: c,
          label: (s.label || id) + ' · ' + ((doc.components[c] && doc.components[c].label) || c),
          stage: stage, dim: s.dim, unit: s.unit, exprText: s.components[c], role: 'stream'
        });
      });
      var exprText = s.expr;
      if (exprText === undefined) {
        if (!compIds.length) fail('stream ' + id + ': expr or components required');
        exprText = compIds.map(function (c) { return id + '.' + c; }).join(' + ');
      }
      addNode({
        id: id, kind: 'stream', label: s.label || id, stage: stage, dim: s.dim, unit: s.unit,
        exprText: exprText, role: 'stream', from: s.from, to: s.to,
        closes: !!s.closes, recycle: !!s.recycle, guess: s.guess, product: s.product || null,
        components: compIds, hit: s.hit || null, basis: s.basis || '', notes: s.notes || []
      });
      streams[id] = nodes[id];
    });

    /* derived */
    each(doc.derived, function (id, d) {
      checkId(id, 'derived');
      var stage = stageOf(d, null, 'derived ' + id);
      if (!d.stage) fail('derived ' + id + ': stage is required');
      var common = {
        label: d.label || id, stage: stage, dim: d.dim || 'count', unit: d.unit,
        role: d.role || 'derived', group: d.group || null, basis: d.basis || '',
        kpi: !!d.kpi, sign: d.sign || 'any', notes: d.notes || [], hit: d.hit || null
      };
      if (d.solve) {
        var sv = d.solve;
        if (!sv.target || !sv.vary) fail('derived ' + id + ': solve needs target and vary');
        var n = addNode(Object.assign({ id: id, kind: 'solve', solve: {
          target: sv.target, vary: sv.vary, lo: sv.lo, hi: sv.hi, equals: sv.equals || 0
        } }, common));
        n.exprText = 'solve ' + sv.target + ' = ' + (sv.equals || 0) + ' for ' + sv.vary;
        return;
      }
      if (d.expr === undefined) fail('derived ' + id + ': expr is required');
      if (d.table) {
        var t = tables[d.table];
        if (!t) fail('derived ' + id + ': unknown table "' + d.table + '"');
        if (!d.column) fail('derived ' + id + ': column is required with table');
        checkId(d.column, 'derived ' + id + ' column');
        if (t.columns[d.column]) fail('derived ' + id + ': column "' + d.column + '" already exists in ' + d.table);
        t.columns[d.column] = { dim: common.dim, unit: common.unit, derived: id, label: d.label };
        var ast = Expr.parse(d.expr);
        var rowNodeIds = [];
        t.rowIds.forEach(function (r) {
          var rn = addNode(Object.assign({}, common, {
            id: d.table + '.' + r + '.' + d.column, kind: 'rowderived', table: d.table, row: r, column: d.column,
            label: (t.rows[r].label || r) + ' · ' + (d.label || d.column),
            ast: rebindRow(ast, d.table, r), exprText: d.expr, rowExpr: true
          }));
          rowNodeIds.push(rn.id);
        });
        addNode(Object.assign({}, common, {
          id: id, kind: 'array', exprText: rowNodeIds.join(', '),
          arrayOf: rowNodeIds, deps: rowNodeIds.slice()
        }));
        return;
      }
      addNode(Object.assign({ id: id, kind: 'derived', exprText: d.expr }, common));
    });

    /* checks */
    var checks = {};
    each(doc.checks, function (id, c) {
      checkId(id, 'check');
      var stage = stageOf(c, firstStage, 'check ' + id);
      if (c.kind === 'closure') {
        if (!Array.isArray(c.in) || !Array.isArray(c.out)) fail('closure ' + id + ': in and out arrays required');
        var dim = c.dim || (nodes[c.in[0]] && nodes[c.in[0]].dim) || 'count';
        var unit = c.unit;
        addNode({ id: id + '.in', kind: 'derived', label: (c.label || id) + ' · in', stage: stage, dim: dim, unit: unit,
          exprText: c.in.join(' + '), role: 'check', group: id });
        addNode({ id: id + '.out', kind: 'derived', label: (c.label || id) + ' · out', stage: stage, dim: dim, unit: unit,
          exprText: c.out.join(' + '), role: 'check', group: id });
        addNode({ id: id + '.error', kind: 'derived', label: (c.label || id) + ' · error', stage: stage, dim: 'fraction', unit: 'fraction',
          exprText: 'if(' + id + '.in == 0, 0, (' + id + '.out - ' + id + '.in) / ' + id + '.in)', role: 'check', group: id });
        checks[id] = { id: id, kind: 'closure', stage: stage, label: c.label || 'Closure', unit: unit || Units.canonicalUnit(dim),
          dim: dim, in: c.in, out: c.out, tolerance: c.tolerance === undefined ? 0.01 : c.tolerance };
      } else if (c.kind === 'constraint') {
        if (!c.expr) fail('constraint ' + id + ': expr required');
        addNode({ id: id, kind: 'constraint', label: c.label || c.message || id, stage: stage, dim: 'count', unit: '',
          exprText: c.expr, role: 'check', severity: c.severity === 'hard' ? 'hard' : 'soft', message: c.message || '' });
        checks[id] = { id: id, kind: 'constraint', stage: stage, severity: nodes[id].severity, message: c.message || '' };
      } else {
        fail('check ' + id + ': kind must be closure or constraint');
      }
    });

    /* parse expressions, infer deps */
    each(nodes, function (id, n) {
      if (n.kind === 'param' || n.kind === 'cell' || n.kind === 'const' || n.kind === 'array' || n.kind === 'solve') return;
      if (!n.ast) {
        try { n.ast = Expr.parse(n.exprText); }
        catch (e) { fail(id + ': ' + e.message); }
      }
      var d = Expr.deps(n.ast);
      var deps = d.ids.slice();
      d.cols.forEach(function (tc) {
        var parts = tc.split('.');
        var t = tables[parts[0]];
        if (!t) fail(id + ': col() refers to unknown table "' + parts[0] + '"');
        if (!t.columns[parts[1]]) fail(id + ': table ' + parts[0] + ' has no column "' + parts[1] + '"');
        t.rowIds.forEach(function (r) { deps.push(parts[0] + '.' + r + '.' + parts[1]); });
      });
      deps.forEach(function (dep) {
        if (!nodes[dep]) fail(id + ': unknown identifier "' + dep + '"');
      });
      n.deps = deps.filter(function (x, i, a) { return a.indexOf(x) === i; });
    });

    /* solve nodes depend on the leaves under their target, minus the varied one */
    each(nodes, function (id, n) {
      if (n.kind !== 'solve') return;
      if (!nodes[n.solve.target]) fail(id + ': solve target "' + n.solve.target + '" not found');
      if (!nodes[n.solve.vary]) fail(id + ': solve vary "' + n.solve.vary + '" not found');
      var anc = ancestorsOf(nodes, [n.solve.target]);
      if (anc.indexOf(n.solve.vary) === -1) fail(id + ': "' + n.solve.target + '" does not depend on "' + n.solve.vary + '"');
      n.deps = anc.filter(function (a) { return a !== n.solve.vary && a !== n.solve.target; });
      n.deps.push(n.solve.target);
      n.deps = n.deps.filter(function (a) { return a !== n.solve.vary; });
    });

    /* stage discipline */
    each(nodes, function (id, n) {
      n.deps.forEach(function (dep) {
        if (stageIndex[nodes[dep].stage] > stageIndex[n.stage]) {
          fail(id + ' (stage ' + n.stage + ') depends on ' + dep + ' (later stage ' + nodes[dep].stage + ')');
        }
      });
    });

    /* topological order with tear handling */
    var order = topoOrder(nodes, streams);

    /* notes */
    each(notesByNode, function (id, ids) {
      if (!nodes[id]) fail('meta.notes refers to unknown node "' + id + '"');
      nodes[id].notes = (nodes[id].notes || []).concat(ids);
    });

    var graph = {
      doc: doc,
      id: doc.meta.id,
      meta: doc.meta,
      stages: stages,
      stageIndex: stageIndex,
      stageMeta: doc.stages,
      nodes: nodes,
      order: order.order,
      tears: order.tears,
      tables: tables,
      units: units,
      streams: streams,
      checks: checks,
      lcia: doc.lcia || null,
      allocation: doc.allocation || null,
      targets: doc.targets || {},
      sensitivity: doc.sensitivity || {},
      diagram: doc.diagram || {}
    };
    graph.ancestors = function (ids) { return ancestorsOf(nodes, ids); };
    graph.descendants = function (ids) { return descendantsOf(nodes, ids); };
    return graph;
  }

  function ancestorsOf(nodes, ids) {
    var seen = {};
    var out = [];
    var stack = ids.slice();
    while (stack.length) {
      var id = stack.pop();
      var n = nodes[id];
      if (!n) continue;
      n.deps.forEach(function (d) {
        if (!seen[d]) { seen[d] = true; out.push(d); stack.push(d); }
      });
    }
    return out;
  }

  function descendantsOf(nodes, ids) {
    var rev = {};
    Object.keys(nodes).forEach(function (id) {
      nodes[id].deps.forEach(function (d) { (rev[d] = rev[d] || []).push(id); });
    });
    var seen = {};
    var out = [];
    var stack = ids.slice();
    while (stack.length) {
      var id = stack.pop();
      (rev[id] || []).forEach(function (c) {
        if (!seen[c]) { seen[c] = true; out.push(c); stack.push(c); }
      });
    }
    return out;
  }

  /* Kahn's algorithm. If a cycle remains, every cycle must pass through a stream flagged
     `recycle`; that stream's incoming edges are cut for ordering and the solver iterates. */
  function topoOrder(nodes, streams) {
    var ids = Object.keys(nodes);
    var tears = [];
    function attempt() {
      var indeg = {};
      var rev = {};
      ids.forEach(function (id) { indeg[id] = 0; });
      ids.forEach(function (id) {
        nodes[id].deps.forEach(function (d) {
          if (tears.indexOf(id) !== -1) return; // cut edges into tear nodes
          indeg[id]++;
          (rev[d] = rev[d] || []).push(id);
        });
      });
      var queue = ids.filter(function (id) { return indeg[id] === 0; });
      var out = [];
      while (queue.length) {
        var id = queue.shift();
        out.push(id);
        (rev[id] || []).forEach(function (c) { if (--indeg[c] === 0) queue.push(c); });
      }
      return out;
    }
    var out = attempt();
    while (out.length < ids.length) {
      var stuck = ids.filter(function (id) { return out.indexOf(id) === -1; });
      var candidate = stuck.filter(function (id) { return nodes[id].kind === 'stream' && nodes[id].recycle && tears.indexOf(id) === -1; })[0];
      if (!candidate) {
        fail('cycle without a recycle (tear) stream among: ' + stuck.slice(0, 12).join(', '));
      }
      tears.push(candidate);
      out = attempt();
    }
    return { order: out, tears: tears };
  }

  var api = { compile: compile, ancestorsOf: ancestorsOf, descendantsOf: descendantsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).compile = api;
})(typeof window !== 'undefined' ? window : globalThis);
