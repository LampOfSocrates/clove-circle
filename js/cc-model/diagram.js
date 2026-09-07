/* Clove Circle - flowsheet binding.

   The SVG is the control surface: any <g class="cc-hit"> with data-vars becomes a
   click and keyboard target, and any element whose id matches a variable's svgId
   is rewritten after each solve. Nothing here is case-specific - swapping in a
   different flowsheet needs no JS change, only the same data attributes. */
(function (global) {
  'use strict';

  var U = global.CCUnits;

  function CCDiagram(svg, engine, opts) {
    this.svg = svg;
    this.engine = engine;
    this.model = engine.model;
    this.onSelect = (opts && opts.onSelect) || function () {};
    this.selected = null;
    this.bind();
  }

  CCDiagram.prototype.bind = function () {
    var self = this;
    var hits = this.svg.querySelectorAll('.cc-hit');
    Array.prototype.forEach.call(hits, function (g) {
      var vars = (g.getAttribute('data-vars') || '').split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean);

      // Every editable target must reach the keyboard, not just the mouse.
      if (!g.hasAttribute('tabindex')) g.setAttribute('tabindex', '0');
      if (!g.hasAttribute('role')) g.setAttribute('role', 'button');

      var editable = vars.some(function (id) {
        var v = self.model.vars[id];
        return v && v.kind === 'input';
      });
      g.classList.add(editable ? 'cc-hit-input' : 'cc-hit-computed');

      var fire = function (e) {
        e.preventDefault();
        self.select(g.getAttribute('data-hit'));
        self.onSelect({
          hit: g.getAttribute('data-hit'),
          title: g.getAttribute('data-title') || '',
          vars: vars,
          editable: editable
        });
      };
      g.addEventListener('click', fire);
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') fire(e);
      });
    });
  };

  CCDiagram.prototype.select = function (hitId) {
    this.selected = hitId;
    var all = this.svg.querySelectorAll('.cc-hit');
    Array.prototype.forEach.call(all, function (g) {
      g.classList.toggle('is-selected', g.getAttribute('data-hit') === hitId);
    });
  };

  /* Rewrite every bound label, mark stale stages, scale stream widths. */
  CCDiagram.prototype.render = function () {
    var self = this;
    var model = this.model;
    var engine = this.engine;

    // Widths are scaled against the largest flow on the sheet so the diagram
    // stays readable whatever the throughput.
    var maxFlow = 0;
    Object.keys(model.vars).forEach(function (id) {
      var v = model.vars[id];
      if (v.dim !== 'mass_flow') return;
      var val = engine.get(id);
      if (isFinite(val) && val > maxFlow) maxFlow = val;
    });

    Object.keys(model.vars).forEach(function (id) {
      var v = model.vars[id];
      if (!v.svgId) return;
      var el = self.svg.querySelector('#' + v.svgId);
      if (!el) return;

      var val = engine.get(id);
      var stale = engine.isStale(v.stage);

      if (val === undefined || !isFinite(val)) {
        el.textContent = v.label + ': --';
      } else {
        el.textContent = U.formatWithUnit(val, v.dim, v.unit || U.canonicalUnit(v.dim));
      }
      el.classList.toggle('is-stale', stale);

      var delta = engine.delta(id);
      el.classList.toggle('is-changed', !stale && delta !== null && Math.abs(delta) > 0.0005);

      // Scale the stroke of any path tagged with this variable.
      var flows = self.svg.querySelectorAll('[data-flow="' + id + '"]');
      Array.prototype.forEach.call(flows, function (p) {
        var w = 1.5;
        if (maxFlow > 0 && isFinite(val)) {
          w = 1.5 + 8 * Math.sqrt(Math.max(val, 0) / maxFlow);
        }
        p.style.strokeWidth = w.toFixed(2);
        p.classList.toggle('is-stale', stale);
      });
    });

    // Blocks grey out while their stage is unsolved.
    var hits = this.svg.querySelectorAll('.cc-hit');
    Array.prototype.forEach.call(hits, function (g) {
      var vars = (g.getAttribute('data-vars') || '').split(',')
        .map(function (s) { return s.trim(); }).filter(Boolean);
      var stale = vars.some(function (id) {
        var v = model.vars[id];
        return v && v.kind === 'computed' && engine.isStale(v.stage);
      });
      g.classList.toggle('is-stale', stale);
    });
  };

  global.CCDiagram = CCDiagram;
})(typeof window !== 'undefined' ? window : globalThis);
