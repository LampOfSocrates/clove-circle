/* LCA Graph - built-in functions available inside expressions.

   Each function takes (args, scope). Scalar math is elementwise on arrays. Anything that
   needs a table (col, cell) reaches it through scope.table(name). Financial helpers work on
   plain arrays of yearly cash flows, index 0 = year 1 unless t0 says otherwise. */
(function (global) {
  'use strict';

  function isArr(x) { return Array.isArray(x); }

  function map1(f) {
    return function (args) {
      var x = args[0];
      if (isArr(x)) return x.map(function (v) { return v === null ? null : f(v); });
      return x === null ? null : f(x);
    };
  }

  function num(x, name) {
    if (x === null || x === undefined) return null;
    if (isArr(x)) throw new Error('functions: ' + name + ' expects a scalar');
    return x;
  }

  function arr(x, name) {
    if (!isArr(x)) throw new Error('functions: ' + name + ' expects an array');
    return x;
  }

  function npv(series, r, t0) {
    var s = arr(series, 'npv');
    var k = t0 === undefined || t0 === null ? 1 : t0;
    var acc = 0;
    for (var i = 0; i < s.length; i++) {
      if (s[i] === null) return null;
      acc += s[i] / Math.pow(1 + r, i + k);
    }
    return acc;
  }

  /* Root of f on [lo, hi] by Brent's method. Returns null if not bracketed. */
  function brent(f, lo, hi, tol, maxIter) {
    tol = tol || 1e-10;
    maxIter = maxIter || 200;
    var a = lo, b = hi, fa = f(a), fb = f(b);
    if (fa === null || fb === null || !isFinite(fa) || !isFinite(fb)) return null;
    if (fa === 0) return a;
    if (fb === 0) return b;
    if (fa * fb > 0) return null;
    var c = a, fc = fa, d = b - a, e = d;
    for (var it = 0; it < maxIter; it++) {
      if (fb * fc > 0) { c = a; fc = fa; d = b - a; e = d; }
      if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
      var tol1 = 2 * 1e-16 * Math.abs(b) + 0.5 * tol;
      var xm = 0.5 * (c - b);
      if (Math.abs(xm) <= tol1 || fb === 0) return b;
      if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
        var s = fb / fa, p, q, r2;
        if (a === c) { p = 2 * xm * s; q = 1 - s; }
        else {
          q = fa / fc; r2 = fb / fc;
          p = s * (2 * xm * q * (q - r2) - (b - a) * (r2 - 1));
          q = (q - 1) * (r2 - 1) * (s - 1);
        }
        if (p > 0) q = -q;
        p = Math.abs(p);
        if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) { e = d; d = p / q; }
        else { d = xm; e = d; }
      } else { d = xm; e = d; }
      a = b; fa = fb;
      if (Math.abs(d) > tol1) b += d; else b += xm > 0 ? tol1 : -tol1;
      fb = f(b);
      if (fb === null || !isFinite(fb)) return null;
    }
    return b;
  }

  var FNS = {
    /* scalar math */
    abs: map1(Math.abs), sqrt: map1(Math.sqrt), exp: map1(Math.exp),
    ln: map1(Math.log), log: map1(Math.log), log10: map1(Math.log10),
    floor: map1(Math.floor), ceil: map1(Math.ceil),
    round: function (args) {
      var d = args.length > 1 ? args[1] : 0;
      var m = Math.pow(10, d);
      return map1(function (v) { return Math.round(v * m) / m; })(args);
    },
    pow: function (args) { return Math.pow(args[0], args[1]); },
    min: function (args) {
      var flat = [].concat.apply([], args.map(function (a) { return isArr(a) ? a : [a]; }));
      if (flat.some(function (v) { return v === null; })) return null;
      return Math.min.apply(null, flat);
    },
    max: function (args) {
      var flat = [].concat.apply([], args.map(function (a) { return isArr(a) ? a : [a]; }));
      if (flat.some(function (v) { return v === null; })) return null;
      return Math.max.apply(null, flat);
    },
    /* if() is evaluated lazily by expr.js; this is a fallback for direct callers */
    'if': function (args) { return args[0] ? args[1] : args[2]; },
    isnull: function (args) { return args[0] === null || args[0] === undefined ? 1 : 0; },
    coalesce: function (args) {
      for (var i = 0; i < args.length; i++) if (args[i] !== null && args[i] !== undefined) return args[i];
      return null;
    },
    isfinite: function (args) { return typeof args[0] === 'number' && isFinite(args[0]) ? 1 : 0; },

    /* arrays */
    sum: function (args) {
      var flat = [].concat.apply([], args.map(function (a) { return isArr(a) ? a : [a]; }));
      var t = 0;
      for (var i = 0; i < flat.length; i++) { if (flat[i] === null) return null; t += flat[i]; }
      return t;
    },
    mean: function (args) { var s = FNS.sum(args); var n = FNS.count(args); return s === null || !n ? null : s / n; },
    count: function (args) { return [].concat.apply([], args.map(function (a) { return isArr(a) ? a : [a]; })).length; },
    len: function (args) { return isArr(args[0]) ? args[0].length : 1; },
    at: function (args) { var a = arr(args[0], 'at'); var i = args[1]; return i < 0 || i >= a.length ? null : a[i]; },
    cumsum: function (args) {
      var a = arr(args[0], 'cumsum'); var t = 0;
      return a.map(function (v) { if (v === null || t === null) { t = null; return null; } t += v; return t; });
    },
    repeat: function (args) {
      var n = Math.max(0, Math.round(num(args[1], 'repeat') || 0));
      var out = []; for (var i = 0; i < n; i++) out.push(args[0]); return out;
    },
    seq: function (args) {
      var a = args[0], b = args[1], out = [];
      for (var i = a; i <= b; i++) out.push(i); return out;
    },
    concat: function (args) { return [].concat.apply([], args.map(function (a) { return isArr(a) ? a : [a]; })); },
    set_at: function (args) { var a = arr(args[0], 'set_at').slice(); a[args[1]] = args[2]; return a; },
    add_at: function (args) {
      var a = arr(args[0], 'add_at').slice(); var i = args[1];
      if (i >= 0 && i < a.length && a[i] !== null) a[i] += args[2]; return a;
    },

    /* tables: resolved through scope */
    col: function (args, scope) { return scope.column(args[0], args[1]); },
    cell: function (args, scope) { return scope.get(args[0] + '.' + args[1] + '.' + args[2]); },

    /* engineering correlations */
    six_tenths: function (args) {
      var base = args[0], size = args[1], baseSize = args[2], n = args[3], cb = args[4], cn = args[5];
      if ([base, size, baseSize, n].some(function (v) { return v === null; })) return null;
      var esc = (cb === null || cb === undefined || cn === null || cn === undefined) ? 1 : cn / cb;
      return base * Math.pow(size / baseSize, n) * esc;
    },
    /* Bond law, kWh/t, sizes in mm (converted to µm inside). */
    bond: function (args) {
      var bwi = args[0], f80 = args[1], p80 = args[2];
      if (bwi === null || f80 === null || p80 === null) return null;
      return 10 * bwi * (1 / Math.sqrt(p80 * 1000) - 1 / Math.sqrt(f80 * 1000));
    },

    /* finance */
    annuity: function (args) {
      var r = args[0], n = args[1];
      if (r === null || n === null) return null;
      if (r === 0) return n;
      return (1 - Math.pow(1 + r, -n)) / r;
    },
    npv: function (args) { return npv(args[0], args[1], args[2]); },
    discounted: function (args) {
      var s = arr(args[0], 'discounted'), r = args[1], k = args[2] === undefined ? 1 : args[2];
      return s.map(function (v, i) { return v === null ? null : v / Math.pow(1 + r, i + k); });
    },
    irr: function (args) {
      var s = arr(args[0], 'irr');
      if (s.some(function (v) { return v === null; })) return null;
      var f = function (r) { return npv(s, r, 0); };
      var root = brent(f, -0.99, 10, 1e-10, 300);
      return root === null ? null : root;
    },
    payback: function (args) {
      var s = arr(args[0], 'payback');
      var cum = 0;
      for (var i = 0; i < s.length; i++) {
        if (s[i] === null) return null;
        var prev = cum;
        cum += s[i];
        if (cum >= 0 && i > 0) {
          // linear interpolation inside the crossing year
          var frac = s[i] === 0 ? 0 : (-prev) / s[i];
          return (i - 1) + frac;
        }
      }
      return null;
    }
  };

  var api = { FNS: FNS, brent: brent, npv: npv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).functions = api;
})(typeof window !== 'undefined' ? window : globalThis);
