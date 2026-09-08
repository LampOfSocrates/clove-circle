/* LCA Graph - expression language.

   A deliberately small language: arithmetic, comparison, conditional, function calls and
   dotted identifiers. No assignment, no loops, no user functions, no eval. Parsing yields an
   AST; `deps(ast)` lists every identifier it references, which is how the compiler infers
   graph edges; `evaluate(ast, scope, fns)` computes it.

   Values are numbers, null, or arrays of numbers. Arithmetic on arrays is elementwise.
   Booleans are 1 and 0. */
(function (global) {
  'use strict';

  /* ── tokenizer ─────────────────────────────────────────────────────────── */
  var TOKEN = {
    num: /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/,
    id: /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/,
    op: /^(?:\|\||&&|==|!=|<=|>=|[-+*\/^<>?:(),!])/,
    ws: /^\s+/
  };

  function tokenize(src) {
    var s = String(src);
    var out = [];
    var pos = 0;
    while (pos < s.length) {
      var rest = s.slice(pos);
      var m;
      if ((m = TOKEN.ws.exec(rest))) { pos += m[0].length; continue; }
      if ((m = TOKEN.num.exec(rest))) { out.push({ t: 'num', v: Number(m[0]), pos: pos }); pos += m[0].length; continue; }
      if ((m = TOKEN.id.exec(rest))) { out.push({ t: 'id', v: m[0], pos: pos }); pos += m[0].length; continue; }
      if ((m = TOKEN.op.exec(rest))) { out.push({ t: 'op', v: m[0], pos: pos }); pos += m[0].length; continue; }
      throw new Error('expr: unexpected character "' + rest[0] + '" at ' + pos + ' in: ' + s);
    }
    out.push({ t: 'end', pos: pos });
    return out;
  }

  /* ── parser (precedence climbing) ──────────────────────────────────────── */
  var BINARY = {
    '||': 1, '&&': 2,
    '==': 3, '!=': 3,
    '<': 4, '<=': 4, '>': 4, '>=': 4,
    '+': 5, '-': 5,
    '*': 6, '/': 6,
    '^': 8
  };
  var RIGHT = { '^': true };

  function parse(src) {
    var toks = tokenize(src);
    var i = 0;
    function peek() { return toks[i]; }
    function next() { return toks[i++]; }
    function expect(v) {
      var t = next();
      if (t.t !== 'op' || t.v !== v) {
        throw new Error('expr: expected "' + v + '" at ' + t.pos + ' in: ' + src);
      }
      return t;
    }

    function parseExpr(minPrec) {
      var left = parseUnary();
      for (;;) {
        var t = peek();
        if (t.t === 'op' && t.v === '?' && (minPrec || 0) <= 0) {
          next();
          var a = parseExpr(0);
          expect(':');
          var b = parseExpr(0);
          left = { k: 'cond', c: left, a: a, b: b };
          continue;
        }
        if (t.t !== 'op' || !(t.v in BINARY)) break;
        var prec = BINARY[t.v];
        if (prec < (minPrec || 0)) break;
        next();
        var right = parseExpr(RIGHT[t.v] ? prec : prec + 1);
        left = { k: 'bin', op: t.v, l: left, r: right };
      }
      return left;
    }

    function parseUnary() {
      var t = peek();
      // Unary minus binds looser than ^ so that -2^2 is -4, as in mathematics.
      if (t.t === 'op' && t.v === '-') { next(); return { k: 'neg', a: parseExpr(BINARY['^']) }; }
      if (t.t === 'op' && t.v === '+') { next(); return parseUnary(); }
      if (t.t === 'op' && t.v === '!') { next(); return { k: 'not', a: parseUnary() }; }
      return parsePostfix(parsePrimary());
    }

    function parsePostfix(node) {
      // Only function calls; identifiers already carry their dots.
      var t = peek();
      if (node.k === 'id' && t.t === 'op' && t.v === '(') {
        next();
        var args = [];
        if (!(peek().t === 'op' && peek().v === ')')) {
          for (;;) {
            args.push(parseExpr(0));
            if (peek().t === 'op' && peek().v === ',') { next(); continue; }
            break;
          }
        }
        expect(')');
        return { k: 'call', fn: node.v, args: args };
      }
      return node;
    }

    function parsePrimary() {
      var t = next();
      if (t.t === 'num') return { k: 'num', v: t.v };
      if (t.t === 'id') return { k: 'id', v: t.v };
      if (t.t === 'op' && t.v === '(') {
        var e = parseExpr(0);
        expect(')');
        return e;
      }
      throw new Error('expr: unexpected ' + (t.t === 'end' ? 'end of expression' : '"' + t.v + '"') +
        ' at ' + t.pos + ' in: ' + src);
    }

    var ast = parseExpr(0);
    if (peek().t !== 'end') {
      throw new Error('expr: unexpected "' + peek().v + '" at ' + peek().pos + ' in: ' + src);
    }
    return ast;
  }

  /* ── dependency extraction ─────────────────────────────────────────────── */
  /* Identifiers that are function names are not dependencies; the first argument of
     col()/cell() is a table name and is reported as a table reference. */
  function deps(ast, out) {
    out = out || { ids: [], cols: [] };
    function add(list, v) { if (list.indexOf(v) === -1) list.push(v); }
    (function walk(n) {
      switch (n.k) {
        case 'num': return;
        case 'id': add(out.ids, n.v); return;
        case 'neg': case 'not': walk(n.a); return;
        case 'bin': walk(n.l); walk(n.r); return;
        case 'cond': walk(n.c); walk(n.a); walk(n.b); return;
        case 'call':
          if (n.fn === 'col' && n.args.length === 2 && n.args[0].k === 'id' && n.args[1].k === 'id') {
            add(out.cols, n.args[0].v + '.' + n.args[1].v);
            return;
          }
          if (n.fn === 'cell' && n.args.length === 3 && n.args.every(function (a) { return a.k === 'id'; })) {
            add(out.ids, n.args[0].v + '.' + n.args[1].v + '.' + n.args[2].v);
            return;
          }
          n.args.forEach(walk);
          return;
      }
    })(ast);
    return out;
  }

  /* ── evaluation ────────────────────────────────────────────────────────── */
  function isArr(x) { return Array.isArray(x); }

  function zip(a, b, f) {
    if (isArr(a) && isArr(b)) {
      if (a.length !== b.length) throw new Error('expr: array length mismatch ' + a.length + ' vs ' + b.length);
      return a.map(function (x, i) { return f(x, b[i]); });
    }
    if (isArr(a)) return a.map(function (x) { return f(x, b); });
    if (isArr(b)) return b.map(function (y) { return f(a, y); });
    return f(a, b);
  }

  function nul(a, b, f) {
    // null propagates like NaN would, but stays inspectable
    return function (x, y) { return (x === null || y === null) ? null : f(x, y); };
  }

  var OPS = {
    '+': nul(0, 0, function (a, b) { return a + b; }),
    '-': nul(0, 0, function (a, b) { return a - b; }),
    '*': nul(0, 0, function (a, b) { return a * b; }),
    '/': nul(0, 0, function (a, b) { return a / b; }),
    '^': nul(0, 0, function (a, b) { return Math.pow(a, b); }),
    '<': nul(0, 0, function (a, b) { return a < b ? 1 : 0; }),
    '<=': nul(0, 0, function (a, b) { return a <= b ? 1 : 0; }),
    '>': nul(0, 0, function (a, b) { return a > b ? 1 : 0; }),
    '>=': nul(0, 0, function (a, b) { return a >= b ? 1 : 0; }),
    '==': function (a, b) { return a === b ? 1 : 0; },
    '!=': function (a, b) { return a !== b ? 1 : 0; },
    '&&': function (a, b) { return (a && b) ? 1 : 0; },
    '||': function (a, b) { return (a || b) ? 1 : 0; }
  };

  /* scope: { get(id) -> value | undefined }, fns: { name: function(args, ctx) } */
  function evaluate(ast, scope, fns) {
    function ev(n) {
      switch (n.k) {
        case 'num': return n.v;
        case 'id': {
          var v = scope.get(n.v);
          if (v === undefined) throw new Error('expr: unknown identifier "' + n.v + '"');
          return v;
        }
        case 'neg': return zip(ev(n.a), 0, function (a) { return a === null ? null : -a; });
        case 'not': return ev(n.a) ? 0 : 1;
        case 'bin': {
          if (n.op === '&&') { var l = ev(n.l); return l ? (ev(n.r) ? 1 : 0) : 0; }
          if (n.op === '||') { var l2 = ev(n.l); return l2 ? 1 : (ev(n.r) ? 1 : 0); }
          return zip(ev(n.l), ev(n.r), OPS[n.op]);
        }
        case 'cond': return ev(n.c) ? ev(n.a) : ev(n.b);
        case 'call': {
          var f = fns[n.fn];
          if (!f) throw new Error('expr: unknown function "' + n.fn + '"');
          if (n.fn === 'col' || n.fn === 'cell') {
            // table name and column/row names are passed as strings
            return f(n.args.map(function (a) { return a.k === 'id' ? a.v : ev(a); }), scope);
          }
          if (n.fn === 'if') {
            // lazy branches
            return ev(n.args[0]) ? ev(n.args[1]) : ev(n.args[2]);
          }
          return f(n.args.map(ev), scope);
        }
      }
      throw new Error('expr: bad node ' + JSON.stringify(n));
    }
    return ev(ast);
  }

  /* Pretty-print an AST back to source, used for the inspector's "formula" line. */
  function print(ast) {
    function p(n, parentPrec) {
      switch (n.k) {
        case 'num': return String(n.v);
        case 'id': return n.v;
        case 'neg': return '-' + p(n.a, 7);
        case 'not': return '!' + p(n.a, 7);
        case 'cond': return '(' + p(n.c, 0) + ' ? ' + p(n.a, 0) + ' : ' + p(n.b, 0) + ')';
        case 'call': return n.fn + '(' + n.args.map(function (a) { return p(a, 0); }).join(', ') + ')';
        case 'bin': {
          var prec = BINARY[n.op];
          var s = p(n.l, prec) + ' ' + n.op + ' ' + p(n.r, prec + (RIGHT[n.op] ? 0 : 1));
          return prec < parentPrec ? '(' + s + ')' : s;
        }
      }
      return '?';
    }
    return p(ast, 0);
  }

  var api = { tokenize: tokenize, parse: parse, deps: deps, evaluate: evaluate, print: print };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).expr = api;
})(typeof window !== 'undefined' ? window : globalThis);
