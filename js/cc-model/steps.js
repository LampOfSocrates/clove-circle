/* Clove Circle - the step controller.

   Renders the step rail, the teaching card, the field list, the solve button and
   the closure panel, and keeps the flowsheet in sync. The teaching copy for each
   stage is generic - it is the method, not the case study - and each case supplies
   only its own "try it" prompt. */
(function (global) {
  'use strict';

  var U = global.CCUnits;

  /* The method, told once. Every case study walks the same eight steps, which are
     the four ISO 14040 phases with the TEA sequence interleaved. */
  var LIBRARY = {
    scope: {
      phase: 'ISO 14040 — Goal & scope',
      question: 'What exactly are we measuring, and where do we draw the line?',
      concept: 'Every LCA answer is meaningless without two declarations. The ' +
        'functional unit says what one unit of the thing is, so that two studies can ' +
        'be compared at all. The system boundary says which processes are counted and ' +
        'which are cut off. Change either one and the number changes, which is why they ' +
        'come first and never last.',
      formula: 'Result  =  impact per functional unit, within a stated boundary'
    },
    mass: {
      phase: 'Foundation of everything downstream',
      question: 'Where does every kilogram that enters the plant end up?',
      concept: 'Mass is conserved, so what goes in must come out — as product, as ' +
        'co-product, or as waste. The balance is what converts a process sketch into ' +
        'numbers. Nothing downstream is trustworthy if this does not close: the ' +
        'inventory, the impacts and the costs are all scaled from these flows.',
      formula: 'Σ mass in  =  Σ mass out        closure error = (out − in) ÷ in',
      why: 'A balance that closes to within about 1% is usually accepted. A larger gap ' +
        'means a stream has been missed or double-counted.'
    },
    lci: {
      phase: 'ISO 14040 — Inventory analysis',
      question: 'How much energy and material does one functional unit actually take?',
      concept: 'The inventory takes the plant-scale flows from the mass balance and ' +
        'divides them down to the functional unit. This is the step that makes a ' +
        '36,000 t/d plant comparable with a laboratory process: everything is ' +
        'restated per unit of product.',
      formula: 'inventory per FU  =  annual flow ÷ annual production'
    },
    lcia: {
      phase: 'ISO 14040 — Impact assessment',
      question: 'What environmental damage does that inventory represent?',
      concept: 'Each inventory flow is multiplied by a characterisation factor that ' +
        'converts it into a common currency of harm — for climate, kg CO₂ equivalent. ' +
        'The factors come from an impact method such as ReCiPe or IPCC GWP100; they ' +
        'are not measured by the study, they are taken from it.',
      formula: 'impact  =  Σ ( inventory flow × characterisation factor )',
      why: 'A capture process can show a negative or reduced net GWP because CO₂ taken ' +
        'out of the stack is credited against the energy used to convert it.'
    },
    capex: {
      phase: 'TEA — Capital cost',
      question: 'What does it cost to build?',
      concept: 'Equipment cost is scaled from a known plant of a different size using ' +
        'the six-tenths rule: cost rises with capacity, but less than proportionally, ' +
        'because a vessel twice the volume needs nowhere near twice the steel. The Lang ' +
        'factor then grows delivered equipment into total capital by adding piping, ' +
        'instrumentation, civils, engineering and contingency.',
      formula: 'C₂ = C₁ × (S₂ ÷ S₁)ⁿ × (CEPCI₂ ÷ CEPCI₁)      TCI = Lang × Σ C',
      why: 'n is about 0.6–0.7 for most process equipment. The CEPCI ratio brings a ' +
        'historic quoted cost up to today’s money.'
    },
    opex: {
      phase: 'TEA — Operating cost & revenue',
      question: 'What does it cost to run for a year, and what does it earn?',
      concept: 'Variable costs track throughput — feedstock, energy, reagents. Fixed ' +
        'costs do not — labour, maintenance, insurance. Co-products are credited ' +
        'against cost rather than ignored, which is often what decides whether a ' +
        'process is viable at all.',
      formula: 'annual cost = annualised capital + variable + fixed + feedstock'
    },
    dcf: {
      phase: 'TEA — Profitability',
      question: 'Is it worth building?',
      concept: 'Money now is worth more than money later, so future cash flows are ' +
        'discounted before being summed. The result is NPV. Setting NPV to zero and ' +
        'solving for the product price instead gives the minimum selling price — the ' +
        'number that says whether this can compete with the incumbent.',
      formula: 'NPV = −TCI + Σ  CFₜ ÷ (1 + r)ᵗ        MSP: the price at which NPV = 0',
      why: 'The minimum selling price is usually the most quotable output of a TEA, ' +
        'because it can be compared directly against a market price.'
    },
    interpret: {
      phase: 'ISO 14040 — Interpretation',
      question: 'What is this answer actually sensitive to, and what would break it?',
      concept: 'An LCA or TEA result is a function of its assumptions, so the final ' +
        'step is to find which assumptions matter. Change one input at a time and watch ' +
        'which ones move the answer. The ones that barely move it can be estimated ' +
        'roughly; the ones that move it a lot are where the real work belongs.',
      formula: 'sensitivity  =  % change in result ÷ % change in input'
    }
  };

  /* A 0.1% tolerance must not print as "0%". */
  function tolText(t) {
    var pct = t * 100;
    return (pct < 1 ? pct.toFixed(pct < 0.1 ? 2 : 1) : pct.toFixed(0)) + '%';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function CCSteps(opts) {
    this.root = opts.root;
    this.model = opts.model;
    this.engine = new global.CCEngine(this.model);
    this.stageIds = this.model.stages.map(function (s) { return s.id; });
    // 'scope' and 'interpret' bookend the solvable stages.
    this.steps = ['scope'].concat(this.stageIds).concat(['interpret']);
    this.active = 'scope';

    this.$rail = this.root.querySelector('[data-cc-rail]');
    this.$card = this.root.querySelector('[data-cc-card]');
    this.$fields = this.root.querySelector('[data-cc-fields]');
    this.$kpis = this.root.querySelector('[data-cc-kpis]');
    this.$inspector = this.root.querySelector('[data-cc-inspector]');
    this.$svg = this.root.querySelector('[data-cc-diagram] svg');

    var self = this;
    this.inspector = new global.CCInspector(this.$inspector, this.engine, {
      onChange: function () { self.render(); }
    });
    this.diagram = new global.CCDiagram(this.$svg, this.engine, {
      onSelect: function (sel) {
        self.picked = null;
        self.diagram.clearHighlight();
        self.root.querySelectorAll('.is-picked').forEach(function (n) {
          n.classList.remove('is-picked');
        });
        self.inspector.show(sel);
      }
    });

    this.bindChrome();
    this.render();

    var self = this;
    window.addEventListener('resize', function () { self.postHeight(); });
    window.addEventListener('load', function () { self.postHeight(); });
  }

  CCSteps.prototype.bindChrome = function () {
    var self = this;
    var reset = this.root.querySelector('[data-cc-reset]');
    if (reset) {
      reset.addEventListener('click', function () {
        self.engine.reset();
        self.inspector.showEmpty();
        self.active = 'scope';
        self.render();
      });
    }
    var all = this.root.querySelector('[data-cc-solve-all]');
    if (all) {
      all.addEventListener('click', function () {
        self.engine.solveAll();
        self.active = self.stageIds[self.stageIds.length - 1];
        self.render();
      });
    }
  };

  CCSteps.prototype.stageMeta = function (id) {
    return this.model.stages.filter(function (s) { return s.id === id; })[0];
  };

  /* Point at one variable: highlight it on the flowsheet, mark the row that asked,
     and open it in the inspector so the formula or the field is right there. */
  CCSteps.prototype.pick = function (varId, row) {
    var v = this.model.vars[varId];
    if (!v) return;

    if (this.picked === varId) { this.clearPick(); return; }
    this.picked = varId;

    this.diagram.highlight([varId]);
    if (v.hit) this.diagram.select(v.hit);

    this.root.querySelectorAll('.is-picked').forEach(function (n) {
      n.classList.remove('is-picked');
    });
    if (row) row.classList.add('is-picked');

    // Show the whole hit group, so a block's other parameters come too.
    var group = v.hit ? this.$svg.querySelector('[data-hit="' + v.hit + '"]') : null;
    var vars = group
      ? (group.getAttribute('data-vars') || '').split(',')
          .map(function (x) { return x.trim(); }).filter(Boolean)
      : [varId];

    this.inspector.show({
      hit: v.hit || null,
      title: group ? (group.getAttribute('data-title') || v.label) : v.label,
      vars: vars,
      editable: v.kind === 'input'
    });
  };

  CCSteps.prototype.clearPick = function () {
    this.picked = null;
    this.diagram.clearHighlight();
    this.diagram.select(null);
    this.root.querySelectorAll('.is-picked').forEach(function (n) {
      n.classList.remove('is-picked');
    });
    this.inspector.showEmpty();
  };

  CCSteps.prototype.go = function (stepId) {
    this.active = stepId;
    this.picked = null;
    this.diagram.clearHighlight();
    this.diagram.select(null);
    this.inspector.showEmpty();
    this.render();
  };

  /* ── rail ─────────────────────────────────────────────────────────────── */
  CCSteps.prototype.renderRail = function () {
    var self = this;
    this.$rail.innerHTML = '';
    this.steps.forEach(function (id, i) {
      var meta = self.stageMeta(id);
      var isStage = !!meta;
      var btn = el('button', 'cc-step');
      btn.type = 'button';
      btn.setAttribute('data-step', id);

      btn.appendChild(el('span', 'cc-step-n', String(i)));
      var body = el('span', 'cc-step-body');
      body.appendChild(el('span', 'cc-step-title',
        isStage ? meta.title : (id === 'scope' ? 'Goal & scope' : 'Interpretation')));

      var state = el('span', 'cc-step-state');
      if (isStage) {
        if (!self.engine.isUnlocked(id)) { state.textContent = 'Locked'; btn.classList.add('is-locked'); }
        else if (self.engine.isStale(id)) { state.textContent = 'Not run'; btn.classList.add('is-stale'); }
        else { state.textContent = 'Solved'; btn.classList.add('is-solved'); }
      } else {
        state.textContent = id === 'scope' ? 'Read first' : 'Review';
      }
      body.appendChild(state);
      btn.appendChild(body);

      if (id === self.active) btn.classList.add('is-active');
      btn.addEventListener('click', function () { self.go(id); });
      self.$rail.appendChild(btn);
    });
  };

  /* ── teaching card ────────────────────────────────────────────────────── */
  CCSteps.prototype.renderCard = function () {
    var self = this;
    var id = this.active;
    var lib = LIBRARY[id];
    var meta = this.stageMeta(id);
    var copy = (this.model.stepCopy || {})[id] || {};
    this.$card.innerHTML = '';

    var head = el('div', 'cc-card-head');
    head.appendChild(el('span', 'cc-card-phase', lib.phase));
    head.appendChild(el('h3', null, meta ? meta.title : (id === 'scope' ? 'Goal & scope' : 'Interpretation')));
    this.$card.appendChild(head);

    this.$card.appendChild(el('p', 'cc-card-question', lib.question));
    this.$card.appendChild(el('p', 'cc-card-concept', lib.concept));

    var f = el('div', 'cc-card-formula');
    f.appendChild(el('span', 'cc-slot-label', 'The method'));
    f.appendChild(el('code', null, lib.formula));
    if (lib.why) f.appendChild(el('p', 'cc-card-why', lib.why));
    this.$card.appendChild(f);

    if (id === 'scope') {
      var s = el('div', 'cc-card-scope');
      var fu = el('div', 'cc-scope-item');
      fu.appendChild(el('span', 'cc-slot-label', 'Functional unit'));
      fu.appendChild(el('p', null, this.model.functionalUnit));
      s.appendChild(fu);
      var bd = el('div', 'cc-scope-item');
      bd.appendChild(el('span', 'cc-slot-label', 'System boundary'));
      bd.appendChild(el('p', null, this.model.boundary));
      s.appendChild(bd);
      this.$card.appendChild(s);
    }

    if (meta) {
      this.$card.appendChild(this.renderThisCase(id));

      var closure = this.engine.closure(id);
      if (closure && !this.engine.isStale(id)) {
        this.$card.appendChild(this.renderClosure(closure));
      }

      var act = el('div', 'cc-card-actions');
      var btn = el('button', 'cc-solve-btn', meta.verb);
      btn.type = 'button';
      btn.setAttribute('data-cc-solve', id);
      var unlocked = this.engine.isUnlocked(id);
      btn.disabled = !unlocked;
      if (!unlocked) btn.title = 'Run the earlier steps first.';
      if (!this.engine.isStale(id)) btn.classList.add('is-done');
      btn.addEventListener('click', function () {
        var r = self.engine.solve(id);
        if (!r.ok) { window.alert(r.error); return; }
        self.render();
      });
      act.appendChild(btn);

      if (!unlocked) {
        act.appendChild(el('span', 'cc-card-lock', 'Locked until the previous step has been run.'));
      } else if (this.engine.isStale(id)) {
        act.appendChild(el('span', 'cc-card-lock', 'Inputs have changed — this step needs running.'));
      }
      this.$card.appendChild(act);
    }

    var tryIt = copy.tryIt || (id === 'interpret' ? null : undefined);
    if (tryIt) {
      var t = el('div', 'cc-card-try');
      t.appendChild(el('span', 'cc-slot-label', 'Try it'));
      t.appendChild(el('p', null, tryIt));
      this.$card.appendChild(t);
    }

    if (id === 'interpret') this.$card.appendChild(this.renderSummary());
  };

  /* Worked numbers for this case, straight from the engine so they stay true. */
  CCSteps.prototype.renderThisCase = function (stageId) {
    var self = this;
    var wrap = el('div', 'cc-card-thiscase');
    wrap.appendChild(el('span', 'cc-slot-label', 'In this case study'));

    var stale = this.engine.isStale(stageId);
    if (stale) {
      wrap.appendChild(el('p', 'cc-thiscase-empty',
        'Press “' + this.stageMeta(stageId).verb + '” to calculate this step.'));
      return wrap;
    }

    var table = el('table', 'cc-thiscase-table');
    var tb = el('tbody');
    Object.keys(this.model.vars).forEach(function (id) {
      var v = self.model.vars[id];
      if (v.stage !== stageId || v.kind !== 'computed') return;
      var val = self.engine.get(id);
      if (val === undefined || !isFinite(val)) return;

      var tr = el('tr');
      tr.appendChild(el('td', 'cc-tc-label', v.label));
      var ex = el('td', 'cc-tc-expr');
      ex.appendChild(el('code', null, v.expr || ''));
      tr.appendChild(ex);
      tr.appendChild(el('td', 'cc-tc-val',
        U.formatWithUnit(val, v.dim, v.unit || U.canonicalUnit(v.dim))));

      // Rows that correspond to something drawn on the flowsheet light it up.
      if (self.diagram.hasVar(id)) {
        tr.classList.add('is-linked');
        tr.setAttribute('tabindex', '0');
        tr.setAttribute('role', 'button');
        tr.setAttribute('aria-label', 'Show ' + v.label + ' on the flowsheet');
        var pick = function (e) {
          if (e) e.preventDefault();
          self.pick(id, tr);
        };
        tr.addEventListener('click', pick);
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') pick(e);
        });
      }

      var d = self.engine.delta(id);
      var dt = el('td', 'cc-tc-delta');
      if (d !== null && Math.abs(d) > 0.0005) {
        dt.textContent = (d > 0 ? '+' : '') + (d * 100).toFixed(1) + '%';
        dt.classList.add(d > 0 ? 'is-up' : 'is-down');
      }
      tr.appendChild(dt);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    wrap.appendChild(table);
    return wrap;
  };

  CCSteps.prototype.renderClosure = function (c) {
    var wrap = el('div', 'cc-closure' + (c.ok ? ' is-ok' : ' is-bad'));
    wrap.appendChild(el('span', 'cc-slot-label', c.label));
    var row = el('div', 'cc-closure-row');
    row.appendChild(el('span', null, 'In ' + U.format(c.in) + ' ' + c.unit));
    row.appendChild(el('span', null, 'Out ' + U.format(c.out) + ' ' + c.unit));
    row.appendChild(el('span', 'cc-closure-err',
      'Error ' + (c.error * 100).toFixed(2) + '%'));
    row.appendChild(el('span', 'cc-closure-verdict',
      c.ok ? '✓ closes within ' + tolText(c.tolerance)
        : '✗ outside ' + tolText(c.tolerance) + ' — a stream is missing'));
    wrap.appendChild(row);
    return wrap;
  };

  CCSteps.prototype.renderSummary = function () {
    var self = this;
    var wrap = el('div', 'cc-card-summary');
    wrap.appendChild(el('span', 'cc-slot-label', 'Where you ended up'));
    var unsolved = this.stageIds.filter(function (s) { return self.engine.isStale(s); });
    if (unsolved.length) {
      wrap.appendChild(el('p', 'cc-thiscase-empty',
        'Run every step to see the full result. Still to run: ' + unsolved.join(', ') + '.'));
      return wrap;
    }
    var list = el('ul', 'cc-summary-list');
    (this.model.kpis || []).forEach(function (id) {
      var v = self.model.vars[id];
      if (!v) return;
      var li = el('li');
      li.appendChild(el('span', 'cc-sum-label', v.label));
      li.appendChild(el('span', 'cc-sum-val',
        U.formatWithUnit(self.engine.get(id), v.dim, v.unit || U.canonicalUnit(v.dim))));
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  };

  /* ── fields for the active stage ──────────────────────────────────────── */
  CCSteps.prototype.renderFields = function () {
    var self = this;
    this.$fields.innerHTML = '';
    var stageId = this.active;
    if (!this.stageMeta(stageId)) {
      this.$fields.appendChild(el('p', 'cc-fields-empty',
        'This step has no inputs of its own — it reads what the earlier steps produced.'));
      return;
    }

    var ids = Object.keys(this.model.vars).filter(function (id) {
      var v = self.model.vars[id];
      return v.stage === stageId && v.kind === 'input';
    });

    if (!ids.length) {
      this.$fields.appendChild(el('p', 'cc-fields-empty', 'No user inputs at this step.'));
      return;
    }

    this.$fields.appendChild(el('span', 'cc-slot-label', 'Inputs for this step'));
    ids.forEach(function (id) {
      var v = self.model.vars[id];
      var row = el('div', 'cc-mini-field');
      var lab;
      if (v.hit && self.diagram.hasVar(id)) {
        // On the flowsheet: the label is a button that points at it.
        lab = el('button', 'cc-mini-label', v.label);
        lab.type = 'button';
        lab.setAttribute('aria-label', 'Show ' + v.label + ' on the flowsheet');
        lab.addEventListener('click', function () { self.pick(id, row); });
      } else {
        lab = el('label', 'cc-mini-label', v.label);
        lab.setAttribute('for', 'm_' + id);
      }
      row.appendChild(lab);

      var unit = self.engine.display[id] || v.unit || U.canonicalUnit(v.dim);
      var box = el('input', 'cc-mini-value');
      box.type = 'text';
      box.id = 'm_' + id;
      box.setAttribute('data-cc-field', id);
      box.setAttribute('inputmode', 'decimal');
      box.value = U.format(U.fromCanonical(self.engine.get(id), v.dim, unit));
      row.appendChild(box);
      row.appendChild(el('span', 'cc-mini-unit', unit));

      var commit = function () {
        var parsed = U.parseEntry(box.value, v.dim, unit);
        if (!parsed.ok) { box.classList.add('has-error'); return; }
        box.classList.remove('has-error');
        self.engine.setValue(id, parsed.value, unit);
        self.render();
      };
      box.addEventListener('change', commit);
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });

      if (v.hit && self.diagram.hasVar(id)) {
        row.classList.add('is-on-diagram');
        row.title = 'Also editable by clicking the flowsheet';
      }
      self.$fields.appendChild(row);
    });
  };

  /* ── KPI strip ────────────────────────────────────────────────────────── */
  CCSteps.prototype.renderKpis = function () {
    var self = this;
    if (!this.$kpis) return;
    this.$kpis.innerHTML = '';
    (this.model.kpis || []).forEach(function (id) {
      var v = self.model.vars[id];
      if (!v) return;
      var val = self.engine.get(id);
      var stale = self.engine.isStale(v.stage);
      var card = el('div', 'cc-kpi' + (stale ? ' is-stale' : ''));
      card.appendChild(el('span', 'cc-kpi-label', v.label));
      card.appendChild(el('span', 'cc-kpi-val',
        (stale || val === undefined || !isFinite(val)) ? '—'
          : U.formatWithUnit(val, v.dim, v.unit || U.canonicalUnit(v.dim))));
      if (stale) card.appendChild(el('span', 'cc-kpi-note', 'not yet run'));
      self.$kpis.appendChild(card);
    });
  };

  /* Report height to a host page so an embedding iframe can size itself. The
     tallest step is far taller than the first, so a fixed min-height either
     clips or leaves a gap. */
  CCSteps.prototype.postHeight = function () {
    if (window.parent === window) return;
    try {
      window.parent.postMessage({
        ccSbsHeight: Math.ceil(document.body.scrollHeight),
        ccSbsModel: this.model.id
      }, '*');
    } catch (e) { /* cross-origin host: nothing to do */ }
  };

  CCSteps.prototype.render = function () {
    this.renderRail();
    this.renderCard();
    this.renderFields();
    this.renderKpis();
    this.diagram.render();
    if (this.picked) this.diagram.highlight([this.picked]);
    if (this.inspector.current) this.inspector.show(this.inspector.current);

    var self = this;
    this.postHeight();
    // Fonts and the flowsheet settle a beat after the DOM is written.
    window.setTimeout(function () { self.postHeight(); }, 120);
  };

  global.CCSteps = CCSteps;
})(typeof window !== 'undefined' ? window : globalThis);
