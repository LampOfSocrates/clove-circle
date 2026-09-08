/* LCA Graph - flowsheet auto-layout.

   Builds a layered left-to-right drawing of the units and streams declared in a graph.
   Rank = longest path from a source, ignoring recycle edges; order within a rank by a
   barycentre sweep; `diagram.rank` / `diagram.order` in the document override both.
   Returns plain geometry; `renderSvg` turns it into SVG markup with the data attributes
   the app binds to (data-hit, data-flow, id="fs_<stream>"). */
(function (global) {
  'use strict';

  var BLOCK_W = 156, BLOCK_H = 64, COL_GAP = 150, ROW_GAP = 48, PAD = 40;

  function layout(graph) {
    var units = graph.units;
    var streams = graph.streams;
    var hints = graph.diagram || {};
    var ids = Object.keys(units).filter(function (u) { return units[u].kind !== 'env'; });
    var edges = [];
    Object.keys(streams).forEach(function (sid) {
      var s = streams[sid];
      edges.push({ id: sid, from: s.from, to: s.to, recycle: !!s.recycle, closes: !!s.closes, product: s.product });
    });

    /* back edges: declared recycles plus anything DFS finds to be a cycle */
    var fwd = {};
    ids.forEach(function (u) { fwd[u] = []; });
    edges.forEach(function (e) {
      if (e.from === 'env' || e.to === 'env') return;
      if (!e.recycle) fwd[e.from].push(e);
    });
    var state = {};
    (function breakCycles() {
      ids.forEach(function (u) {
        if (state[u]) return;
        var stack = [{ u: u, i: 0 }];
        state[u] = 1;
        while (stack.length) {
          var top = stack[stack.length - 1];
          if (top.i < fwd[top.u].length) {
            var e = fwd[top.u][top.i++];
            if (state[e.to] === 1) { e.recycle = true; }
            else if (!state[e.to]) { state[e.to] = 1; stack.push({ u: e.to, i: 0 }); }
          } else { state[top.u] = 2; stack.pop(); }
        }
      });
    })();

    /* rank by longest path */
    var rank = {};
    var indeg = {};
    ids.forEach(function (u) { indeg[u] = 0; rank[u] = 0; });
    edges.forEach(function (e) { if (e.from !== 'env' && e.to !== 'env' && !e.recycle) indeg[e.to]++; });
    var q = ids.filter(function (u) { return indeg[u] === 0; });
    var seen = 0;
    while (q.length) {
      var u = q.shift();
      seen++;
      edges.forEach(function (e) {
        if (e.from !== u || e.to === 'env' || e.recycle) return;
        rank[e.to] = Math.max(rank[e.to], rank[u] + 1);
        if (--indeg[e.to] === 0) q.push(e.to);
      });
    }
    ids.forEach(function (u) { if (hints.rank && hints.rank[u] !== undefined) rank[u] = hints.rank[u]; });
    // cost-only units with no streams sit in a final column
    var maxRank = ids.reduce(function (m, u) { return Math.max(m, rank[u]); }, 0);
    ids.forEach(function (u) {
      var touched = edges.some(function (e) { return e.from === u || e.to === u; });
      if (!touched && (!hints.rank || hints.rank[u] === undefined)) rank[u] = maxRank + 1;
    });
    maxRank = ids.reduce(function (m, u) { return Math.max(m, rank[u]); }, 0);

    /* order within ranks: barycentre sweeps */
    var cols = [];
    for (var r = 0; r <= maxRank; r++) cols.push([]);
    ids.forEach(function (u) { cols[rank[u]].push(u); });
    var pos = {};
    cols.forEach(function (c) { c.forEach(function (u, i) { pos[u] = i; }); });
    function sweep(dir) {
      for (var k = 0; k < cols.length; k++) {
        var r2 = dir > 0 ? k : cols.length - 1 - k;
        var col = cols[r2];
        var bary = {};
        col.forEach(function (u) {
          var nb = [];
          edges.forEach(function (e) {
            if (e.recycle) return;
            if (dir > 0 && e.to === u && e.from !== 'env' && rank[e.from] < r2) nb.push(pos[e.from]);
            if (dir < 0 && e.from === u && e.to !== 'env' && rank[e.to] > r2) nb.push(pos[e.to]);
          });
          bary[u] = nb.length ? nb.reduce(function (a, b) { return a + b; }, 0) / nb.length : pos[u];
        });
        col.sort(function (a, b) { return bary[a] - bary[b]; });
        col.forEach(function (u, i) { pos[u] = i; });
      }
    }
    sweep(1); sweep(-1); sweep(1);
    cols.forEach(function (col) {
      col.sort(function (a, b) {
        var oa = hints.order && hints.order[a] !== undefined ? hints.order[a] : pos[a] + 1000;
        var ob = hints.order && hints.order[b] !== undefined ? hints.order[b] : pos[b] + 1000;
        return oa - ob;
      });
      col.forEach(function (u, i) { pos[u] = i; });
    });

    /* coordinates: centre each column vertically */
    var tallest = cols.reduce(function (m, c) { return Math.max(m, c.length); }, 1);
    var height = PAD * 2 + tallest * BLOCK_H + (tallest - 1) * ROW_GAP + 60;
    var boxes = {};
    cols.forEach(function (col, r3) {
      var colH = col.length * BLOCK_H + (col.length - 1) * ROW_GAP;
      var y0 = (height - colH) / 2;
      col.forEach(function (u, i) {
        boxes[u] = { id: u, x: PAD + 60 + r3 * (BLOCK_W + COL_GAP), y: y0 + i * (BLOCK_H + ROW_GAP), w: BLOCK_W, h: BLOCK_H, rank: r3 };
      });
    });
    // Extra room on both sides for environment stubs and their labels.
    var width = PAD * 2 + 120 + (maxRank + 1) * BLOCK_W + maxRank * COL_GAP + 180;

    /* stream geometry */
    var outCount = {}, inCount = {}, outIdx = {}, inIdx = {};
    edges.forEach(function (e) {
      outCount[e.from] = (outCount[e.from] || 0) + 1;
      inCount[e.to] = (inCount[e.to] || 0) + 1;
    });
    function port(u, side, key, count, idx) {
      var b = boxes[u];
      var n = count[u] || 1;
      var i = idx[u] = (idx[u] || 0) + 1;
      var y = b.y + b.h * i / (n + 1);
      return { x: side === 'out' ? b.x + b.w : b.x, y: y };
    }
    var envInIdx = 0, envOutIdx = 0;
    var paths = edges.map(function (e) {
      var d, lx, ly, anchor = 'middle';
      if (e.from === 'env' && e.to === 'env') {
        d = ''; lx = 0; ly = 0;
      } else if (e.from === 'env') {
        var p = port(e.to, 'in', e.id, inCount, inIdx);
        var x0 = p.x - 90;
        d = 'M' + x0 + ' ' + p.y + ' H' + (p.x - 2);
        lx = x0; ly = p.y - 5; anchor = 'start';
        envInIdx++;
      } else if (e.to === 'env') {
        var p2 = port(e.from, 'out', e.id, outCount, outIdx);
        var x1 = p2.x + 70;
        d = 'M' + p2.x + ' ' + p2.y + ' H' + x1;
        lx = p2.x + 6; ly = p2.y - 5; anchor = 'start';
        envOutIdx++;
      } else {
        var a = port(e.from, 'out', e.id, outCount, outIdx);
        var b2 = port(e.to, 'in', e.id, inCount, inIdx);
        if (e.recycle || b2.x <= a.x) {
          // route over the top of everything between
          var top = Math.min(boxes[e.from].y, boxes[e.to].y) - 26 - (outIdx[e.from] || 0) * 14;
          d = 'M' + a.x + ' ' + a.y + ' H' + (a.x + 16) + ' V' + top + ' H' + (b2.x - 16) + ' V' + b2.y + ' H' + (b2.x - 2);
          lx = Math.min(a.x, b2.x) + 24; ly = top - 5; anchor = 'start';
        } else {
          var mid = (a.x + b2.x) / 2;
          d = 'M' + a.x + ' ' + a.y + ' H' + mid + ' V' + b2.y + ' H' + (b2.x - 2);
          // Label sits beside the source port on its own line, so several streams
          // leaving one unit stack instead of piling up mid-span.
          lx = a.x + 6; ly = a.y - 5; anchor = 'start';
        }
      }
      return { id: e.id, d: d, lx: lx, ly: ly, anchor: anchor, recycle: e.recycle, closes: e.closes, product: e.product, env: e.from === 'env' || e.to === 'env' };
    });

    return { width: width, height: height, boxes: boxes, paths: paths };
  }

  /* Split a label into at most two lines at the space nearest the middle. */
  function wrapLabel(text, max) {
    var t = String(text);
    if (t.length <= max) return [t];
    var mid = Math.floor(t.length / 2);
    var best = -1;
    for (var i = 0; i < t.length; i++) {
      if (t[i] === ' ' && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    }
    if (best === -1) return [t];
    return [t.slice(0, best), t.slice(best + 1)];
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderSvg(graph, geo) {
    var out = [];
    out.push('<svg viewBox="0 0 ' + geo.width + ' ' + geo.height + '" width="' + geo.width + '" role="img" aria-label="Process flowsheet. Click a stream or unit to inspect it.">');
    out.push('<defs><marker id="lcag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">' +
      '<path d="M1 1 L9 5 L1 9" fill="none" stroke="#8aa398" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>');
    geo.paths.forEach(function (p) {
      var s = graph.streams[p.id];
      var cls = 'lg-hit lg-stream' + (p.recycle ? ' is-recycle' : '') + (p.closes ? ' is-closes' : '') + (p.product ? ' is-product' : '');
      out.push('<g class="' + cls + '" data-hit="stream:' + p.id + '" data-title="' + esc(s.label) + '" tabindex="0" role="button">');
      out.push('<path class="lg-flow-pad" d="' + p.d + '"/>');
      out.push('<path class="lg-flow" data-flow="' + p.id + '" d="' + p.d + '" marker-end="url(#lcag-arrow)"/>');
      out.push('<text class="lg-stream-text" x="' + p.lx + '" y="' + p.ly + '" text-anchor="' + p.anchor + '">' +
        '<tspan class="lg-stream-name">' + esc(s.label) + '</tspan> <tspan class="lg-stream-label" id="fs_' + p.id + '">—</tspan></text>');
      out.push('</g>');
    });
    Object.keys(geo.boxes).forEach(function (u) {
      var b = geo.boxes[u];
      var unit = graph.units[u];
      out.push('<g class="lg-hit lg-unit lg-unit-' + esc(unit.kind) + '" data-hit="unit:' + u + '" data-title="' + esc(unit.label) + '" tabindex="0" role="button">');
      out.push('<rect class="lg-blk-pad" x="' + (b.x - 4) + '" y="' + (b.y - 4) + '" width="' + (b.w + 8) + '" height="' + (b.h + 8) + '" rx="10"/>');
      out.push('<rect class="lg-blk" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="8"/>');
      var lines = wrapLabel(unit.label, 20);
      var cx = b.x + b.w / 2;
      var y0 = b.y + (lines.length > 1 ? 22 : 27) - (unit.sub ? 3 : 0);
      out.push('<text class="lg-blk-label' + (lines.length > 1 ? ' is-two-line' : '') + '" x="' + cx + '" y="' + y0 + '" text-anchor="middle">' +
        lines.map(function (ln, i) { return '<tspan x="' + cx + '" dy="' + (i ? 14 : 0) + '">' + esc(ln) + '</tspan>'; }).join('') + '</text>');
      if (unit.sub) out.push('<text class="lg-blk-sub" x="' + cx + '" y="' + (b.y + b.h - 10) + '" text-anchor="middle">' + esc(wrapLabel(unit.sub, 26)[0]) + '</text>');
      out.push('</g>');
    });
    out.push('</svg>');
    return out.join('');
  }

  var api = { layout: layout, renderSvg: renderSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).layout = api;
})(typeof window !== 'undefined' ? window : globalThis);
