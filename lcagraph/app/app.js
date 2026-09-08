/* LCA Graph - the generic step-by-step app.

   Loads a PML document (built-in by name, or uploaded), compiles it into a calc graph,
   draws the flowsheet from the topology, and walks the eight steps: goal & scope, the
   model's solve stages, and interpretation (targets + sensitivity). Nothing here is
   case-specific. */
(function (global) {
  'use strict';

  var L = global.LCAG;
  var U = L.units;

  var LIBRARY = {
    scope: {
      phase: 'ISO 14040 — Goal & scope',
      question: 'What exactly are we measuring, and where do we draw the line?',
      concept: 'Every LCA answer is meaningless without two declarations. The functional unit says what one unit of the thing is, so that two studies can be compared at all. The system boundary says which processes are counted and which are cut off. Change either one and the number changes, which is why they come first and never last.',
      formula: 'Result  =  impact per functional unit, within a stated boundary'
    },
    mass: {
      phase: 'Foundation of everything downstream',
      question: 'Where does every kilogram that enters the plant end up?',
      concept: 'Mass is conserved, so what goes in must come out — as product, as co-product, or as waste. The balance is what converts a process sketch into numbers. Nothing downstream is trustworthy if this does not close: the inventory, the impacts and the costs are all scaled from these flows.',
      formula: 'Σ mass in  =  Σ mass out        closure error = (out − in) ÷ in',
      why: 'A balance that closes to within about 1% is usually accepted. A larger gap means a stream has been missed or double-counted.'
    },
    lci: {
      phase: 'ISO 14040 — Inventory analysis',
      question: 'How much energy and material does one functional unit actually take?',
      concept: 'The inventory takes the plant-scale flows from the mass balance and divides them down to the functional unit. This is the step that makes a large plant comparable with a laboratory process: everything is restated per unit of product.',
      formula: 'inventory per FU  =  annual flow ÷ annual production'
    },
    lcia: {
      phase: 'ISO 14040 — Impact assessment',
      question: 'What environmental damage does that inventory represent?',
      concept: 'Each inventory flow is multiplied by a characterisation factor that converts it into a common currency of harm — for climate, kg CO₂ equivalent. The factors come from an impact method such as ReCiPe or IPCC GWP100; they are not measured by the study, they are taken from it.',
      formula: 'impact  =  Σ ( inventory flow × characterisation factor )'
    },
    capex: {
      phase: 'TEA — Capital cost',
      question: 'What does it cost to build?',
      concept: 'Equipment cost is scaled from a known plant of a different size using the six-tenths rule: cost rises with capacity, but less than proportionally. The Lang factor then grows delivered equipment into total capital by adding piping, instrumentation, civils, engineering and contingency.',
      formula: 'C₂ = C₁ × (S₂ ÷ S₁)ⁿ × (CEPCI₂ ÷ CEPCI₁)      TCI = Lang × Σ C',
      why: 'n is about 0.6–0.7 for most process equipment. The CEPCI ratio brings a historic quoted cost up to today’s money.'
    },
    opex: {
      phase: 'TEA — Operating cost & revenue',
      question: 'What does it cost to run for a year, and what does it earn?',
      concept: 'Variable costs track throughput — feedstock, energy, reagents. Fixed costs do not — labour, maintenance, insurance. Co-products are credited against cost rather than ignored, which is often what decides whether a process is viable at all.',
      formula: 'annual cost = annualised capital + variable + fixed + feedstock'
    },
    dcf: {
      phase: 'TEA — Profitability',
      question: 'Is it worth building?',
      concept: 'Money now is worth more than money later, so future cash flows are discounted before being summed. The result is NPV. Setting NPV to zero and solving for the product price instead gives the minimum selling price — the number that says whether this can compete with the incumbent.',
      formula: 'NPV = −TCI + Σ  CFₜ ÷ (1 + r)ᵗ        MSP: the price at which NPV = 0',
      why: 'The minimum selling price is usually the most quotable output of a TEA, because it can be compared directly against a market price.'
    },
    interpret: {
      phase: 'ISO 14040 — Interpretation',
      question: 'What is this answer actually sensitive to, and what would break it?',
      concept: 'An LCA or TEA result is a function of its assumptions, so the final step is to find which assumptions matter. Pick a target, see what it depends on, then move the inputs one at a time, sweep them, compare scenarios, or sample them all at once.',
      formula: 'sensitivity  =  % change in result ÷ % change in input'
    }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function fmt(v, dim, unit) {
    if (v === null || v === undefined) return '—';
    if (Array.isArray(v)) return '[' + v.length + ' values]';
    return U.formatWithUnit(v, dim || 'count', unit);
  }
  function fmtNum(v, digits) { return U.format(v, digits); }

  function LGApp(root) {
    this.root = root;
    this.$ = function (sel) { return root.querySelector(sel); };
    this.active = 'scope';
    this.picked = null;
    this.bindChrome();
    var m = new URLSearchParams(location.search).get('model');
    var sel = this.$('[data-lg-model]');
    if (m && sel) sel.value = m;
    if (global.parent !== global) document.body.classList.add('is-embedded');
    this.loadBuiltin(sel ? sel.value : (m || 'flue2chem'));
  }

  /* ── loading ───────────────────────────────────────────────────────────── */
  LGApp.prototype.status = function (msg, isError) {
    var s = this.$('[data-lg-status]');
    s.textContent = msg || '';
    s.classList.toggle('is-error', !!isError);
  };

  LGApp.prototype.loadBuiltin = function (id) {
    var self = this;
    // A draft handed over by the beta page lives in sessionStorage, not on disk.
    if (id === 'draft') {
      var raw = null;
      try { raw = sessionStorage.getItem('lcagraph-draft'); } catch (e) {}
      if (!raw) { this.status('No draft found in this browser session. Go back to the beta page and draft a model first.', true); return; }
      try { this.load(JSON.parse(raw)); } catch (e) { this.status('The draft could not be read: ' + e.message, true); }
      return;
    }
    this.status('Loading ' + id + '…');
    fetch('../models/' + id + '.pml.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (doc) { self.load(doc); })
      .catch(function (e) {
        self.status('Could not load the built-in model "' + id + '" (' + e.message + '). Upload a .pml.json instead.', true);
      });
  };

  LGApp.prototype.load = function (doc) {
    var self = this;
    var v = L.validate.validate(doc);
    if (v.errors.length) {
      this.status('Model rejected: ' + v.errors.map(function (e) { return e.where + ': ' + e.message; }).join(' · '), true);
      return;
    }
    this.lint = v.warnings;
    this.doc = doc;
    this.graph = v.graph;
    this.solver = new L.solve.Solver(this.graph);
    this.stageIds = this.graph.stages;
    this.steps = ['scope'].concat(this.stageIds).concat(['interpret']);
    this.active = 'scope';
    this.picked = null;
    this.sensResults = {};
    this.$('[data-lg-title]').textContent = doc.meta.title || doc.meta.id;
    this.$('[data-lg-subtitle]').textContent = doc.meta.subtitle || '';
    document.title = (doc.meta.title || 'LCA Graph') + ' | LCA Graph';
    this.status(Object.keys(this.graph.nodes).length + ' nodes in the calc graph · ' +
      (Object.keys(this.graph.units).length - 1) + ' units · ' + Object.keys(this.graph.streams).length + ' streams' +
      (this.graph.tears.length ? ' · recycle solved by iteration: ' + this.graph.tears.join(', ') : ''));
    this.buildDiagram();
    this.solver.on(function () { self.render(); });
    this.render();
  };

  LGApp.prototype.bindChrome = function () {
    var self = this;
    var sel = this.$('[data-lg-model]');
    if (sel) sel.addEventListener('change', function () {
      var url = new URL(location.href); url.searchParams.set('model', sel.value); history.replaceState(null, '', url);
      self.loadBuiltin(sel.value);
    });
    var up = this.$('[data-lg-upload]');
    if (up) up.addEventListener('change', function () {
      var f = up.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { self.load(JSON.parse(r.result)); }
        catch (e) { self.status('Upload failed: ' + e.message, true); }
      };
      r.readAsText(f);
    });
    this.$('[data-lg-solve-all]').addEventListener('click', function () {
      if (!self.solver) return;
      self.solver.solveAll();
      self.active = self.stageIds[self.stageIds.length - 1];
      self.render();
    });
    this.$('[data-lg-reset]').addEventListener('click', function () {
      if (!self.solver) return;
      self.solver.reset(); self.active = 'scope'; self.picked = null; self.render();
    });
    this.$('[data-lg-download]').addEventListener('click', function () { self.download(); });
    this.$('[data-lg-lint]').addEventListener('click', function () { self.showLint(); });
  };

  /* Save the document with the current inputs as defaults, so a case can be re-uploaded. */
  LGApp.prototype.download = function () {
    if (!this.doc) return;
    var self = this;
    var doc = JSON.parse(JSON.stringify(this.doc));
    Object.keys(doc.params || {}).forEach(function (id) {
      var n = self.graph.nodes[id];
      var v = self.solver.get(id);
      doc.params[id].default = v === null || v === undefined ? null : U.fromCanonical(v, n.dim, n.unit);
    });
    Object.keys(doc.tables || {}).forEach(function (t) {
      var tb = self.graph.tables[t];
      tb.rowIds.forEach(function (r) {
        Object.keys(doc.tables[t].columns).forEach(function (c) {
          var n = self.graph.nodes[t + '.' + r + '.' + c];
          if (!n || n.kind !== 'cell') return;
          var v = self.solver.get(n.id);
          doc.tables[t].rows[r][c] = v === null || v === undefined ? null : U.fromCanonical(v, n.dim, n.unit);
        });
      });
    });
    var blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (doc.meta.id || 'model') + '.case.pml.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  LGApp.prototype.showLint = function () {
    var box = this.$('[data-lg-inspector]');
    box.innerHTML = '';
    var head = el('div', 'lg-insp-head');
    head.appendChild(el('h4', null, 'Model check'));
    head.appendChild(el('span', 'lg-insp-tag', this.lint.length + ' notes'));
    box.appendChild(head);
    if (!this.lint.length) { box.appendChild(el('p', 'lg-empty', 'No warnings. The document compiles cleanly and every input is used.')); return; }
    var ul = el('ul', 'lg-lint');
    this.lint.forEach(function (w) {
      var li = el('li'); li.appendChild(el('code', null, w.where)); li.appendChild(document.createTextNode(' ' + w.message)); ul.appendChild(li);
    });
    box.appendChild(ul);
  };

  /* ── diagram ───────────────────────────────────────────────────────────── */
  LGApp.prototype.buildDiagram = function () {
    var self = this;
    var wrap = this.$('[data-lg-diagram]');
    this.geo = L.layout.layout(this.graph);
    wrap.innerHTML = L.layout.renderSvg(this.graph, this.geo);
    this.$svg = wrap.querySelector('svg');
    // A unit is "input" if any param points at it or at one of its inbound env streams.
    var paramHits = {};
    Object.keys(this.graph.nodes).forEach(function (id) {
      var n = self.graph.nodes[id];
      if (n.kind === 'param' && n.hit) paramHits[n.hit] = true;
    });
    Object.keys(this.graph.units).forEach(function (u) {
      if ((self.graph.units[u].params || []).length) paramHits[u] = true;
    });
    Array.prototype.forEach.call(this.$svg.querySelectorAll('.lg-hit'), function (g) {
      var hit = g.getAttribute('data-hit');
      var key = hit.split(':')[1];
      if (paramHits[key]) g.classList.add('is-input');
      var fire = function (e) { e.preventDefault(); self.select(hit); };
      g.addEventListener('click', fire);
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') fire(e); });
    });
  };

  LGApp.prototype.renderDiagram = function () {
    var self = this;
    var svg = this.$svg; if (!svg) return;
    var maxFlow = 0;
    Object.keys(this.graph.streams).forEach(function (id) {
      var n = self.graph.nodes[id];
      var v = self.solver.get(id);
      if (n.dim && /^mass/.test(n.dim) && typeof v === 'number' && v > maxFlow) maxFlow = v;
    });
    Object.keys(this.graph.streams).forEach(function (id) {
      var n = self.graph.nodes[id];
      var v = self.solver.get(id);
      var stale = self.solver.isStale(id);
      var label = svg.querySelector('#fs_' + id);
      if (label) {
        label.textContent = (v === undefined || v === null) ? '—' : fmt(v, n.dim, n.unit);
        label.classList.toggle('is-stale', stale);
        var d = self.solver.delta(id);
        label.classList.toggle('is-changed', !stale && d !== null && Math.abs(d) > 0.0005);
      }
      var flow = svg.querySelector('[data-flow="' + id + '"]');
      if (flow) {
        var w = 1.5;
        if (maxFlow > 0 && typeof v === 'number' && /^mass/.test(n.dim)) w = 1.5 + 7 * Math.sqrt(Math.max(v, 0) / maxFlow);
        flow.style.strokeWidth = w.toFixed(2);
        flow.classList.toggle('is-stale', stale);
      }
    });
    Object.keys(this.graph.units).forEach(function (u) {
      var g = svg.querySelector('[data-hit="unit:' + u + '"]'); if (!g) return;
      var stale = Object.keys(self.graph.streams).some(function (s) {
        var st = self.graph.streams[s];
        return (st.from === u || st.to === u) && self.solver.isStale(s);
      });
      g.classList.toggle('is-stale', stale);
    });
    Array.prototype.forEach.call(svg.querySelectorAll('.lg-hit'), function (g) {
      g.classList.toggle('is-selected', g.getAttribute('data-hit') === self.picked);
    });
  };

  /* What a click on the flowsheet opens: the stream node and the params that point at it,
     or a unit's params and its streams. */
  LGApp.prototype.select = function (hit) {
    var self = this;
    this.picked = hit;
    var kind = hit.split(':')[0], key = hit.split(':')[1];
    var vars = [];
    var title = '';
    if (kind === 'stream') {
      var s = this.graph.streams[key];
      title = s.label;
      Object.keys(this.graph.nodes).forEach(function (id) {
        var n = self.graph.nodes[id];
        if (n.kind === 'param' && n.hit === key) vars.push(id);
      });
      vars.push(key);
      (s.components || []).forEach(function (c) { vars.push(key + '.' + c); });
    } else if (kind === 'unit') {
      var u = this.graph.units[key];
      title = u.label;
      (u.params || []).forEach(function (p) { if (self.graph.nodes[p]) vars.push(p); });
      Object.keys(this.graph.nodes).forEach(function (id) {
        var n = self.graph.nodes[id];
        if (n.kind === 'param' && n.hit === key && vars.indexOf(id) === -1) vars.push(id);
      });
      Object.keys(this.graph.streams).forEach(function (sid) {
        var st = self.graph.streams[sid];
        if (st.to === key || st.from === key) vars.push(sid);
      });
    } else if (kind === 'node') {
      var n0 = this.graph.nodes[key];
      title = n0 ? n0.label : key;
      vars.push(key);
      if (n0 && n0.hit) {
        Object.keys(this.graph.nodes).forEach(function (id) {
          var n = self.graph.nodes[id];
          if (n.kind === 'param' && n.hit === n0.hit && id !== key) vars.push(id);
        });
      }
    }
    this.renderInspector(title, vars);
    this.renderDiagram();
    this.highlightRows(key);
  };

  LGApp.prototype.pickNode = function (id) {
    var n = this.graph.nodes[id]; if (!n) return;
    if (n.kind === 'stream') return this.select('stream:' + id);
    if (n.kind === 'component') return this.select('stream:' + n.stream);
    if (n.hit && this.graph.streams[n.hit]) return this.select('stream:' + n.hit);
    if (n.hit && this.graph.units[n.hit]) return this.select('unit:' + n.hit);
    this.select('node:' + id);
  };

  LGApp.prototype.highlightRows = function (key) {
    Array.prototype.forEach.call(this.root.querySelectorAll('[data-node]'), function (r) {
      r.classList.toggle('is-picked', r.getAttribute('data-node') === key);
    });
  };

  /* ── inspector ─────────────────────────────────────────────────────────── */
  LGApp.prototype.renderInspector = function (title, vars) {
    var self = this;
    var box = this.$('[data-lg-inspector]');
    box.innerHTML = '';
    if (!vars || !vars.length) {
      box.appendChild(el('p', 'lg-empty', 'Click any stream or unit on the flowsheet, or any row in a table, to see what it is and, where it is an input, to change it. Amber items are yours to set; grey items show the formula behind them.'));
      return;
    }
    var head = el('div', 'lg-insp-head');
    head.appendChild(el('h4', null, title || 'Selected'));
    var editable = vars.some(function (id) { return self.solver.isLeaf(id) && self.graph.nodes[id].editable; });
    head.appendChild(el('span', 'lg-insp-tag', editable ? 'You set this' : 'Calculated'));
    box.appendChild(head);
    vars.forEach(function (id) {
      var n = self.graph.nodes[id]; if (!n) return;
      box.appendChild(self.solver.isLeaf(id) ? self.inputRow(n) : self.computedRow(n));
    });
  };

  LGApp.prototype.noteBadges = function (n) {
    var self = this;
    var frag = document.createDocumentFragment();
    (n.notes || []).forEach(function (nid) {
      var note = (self.doc.meta.notes || []).filter(function (x) { return x.id === nid; })[0];
      if (!note) return;
      var b = el('span', 'lg-badge lg-badge-' + note.level, note.level === 'quirk' ? 'quirk: ' + note.title : note.title);
      b.title = note.text;
      frag.appendChild(b);
    });
    return frag;
  };

  LGApp.prototype.inputRow = function (n) {
    var self = this;
    var wrap = el('div', 'lg-field');
    var lab = el('label', 'lg-field-label', n.label);
    lab.setAttribute('for', 'f_' + n.id.replace(/\./g, '_'));
    lab.appendChild(this.noteBadges(n));
    wrap.appendChild(lab);
    if (!n.editable) {
      wrap.appendChild(el('div', 'lg-field-readout', fmt(self.solver.get(n.id), n.dim, n.unit)));
      wrap.appendChild(el('p', 'lg-field-source', 'Fixed constant in this case. ' + (n.source || '')));
      return wrap;
    }
    var row = el('div', 'lg-field-row');
    var box = el('input', 'lg-field-value');
    box.type = 'text'; box.id = 'f_' + n.id.replace(/\./g, '_'); box.setAttribute('inputmode', 'decimal');
    var unit = n.unit || U.canonicalUnit(n.dim);
    var cur = this.solver.get(n.id);
    box.value = cur === null || cur === undefined ? '' : fmtNum(U.fromCanonical(cur, n.dim, unit));
    var picker = el('select', 'lg-field-unit');
    U.unitsFor(n.dim).forEach(function (u) {
      var o = el('option', null, u === '' ? '—' : u); o.value = u; if (u === unit) o.selected = true; picker.appendChild(o);
    });
    if (U.unitsFor(n.dim).length < 2) picker.disabled = true;
    row.appendChild(box); row.appendChild(picker); wrap.appendChild(row);
    var note = el('div', 'lg-field-note'); wrap.appendChild(note);
    if (n.source) wrap.appendChild(el('p', 'lg-field-source', n.source));
    if (n.range) wrap.appendChild(el('p', 'lg-field-source', 'Typical range: ' + fmtNum(U.fromCanonical(n.range[0], n.dim, unit)) + ' – ' + fmtNum(U.fromCanonical(n.range[1], n.dim, unit)) + (unit ? ' ' + unit : '')));
    var commit = function () {
      var u = picker.value;
      if (box.value.trim() === '' && n.nullable) { self.solver.set(n.id, null); return; }
      var parsed = U.parseEntry(box.value, n.dim, u);
      if (!parsed.ok) { wrap.classList.add('has-error'); note.textContent = parsed.error; return; }
      wrap.classList.remove('has-error');
      note.textContent = parsed.coerced || '';
      if (n.range && (parsed.value < n.range[0] || parsed.value > n.range[1])) {
        wrap.classList.add('has-warning'); note.textContent = 'Outside the typical range — allowed, but check it is what you mean.';
      } else wrap.classList.remove('has-warning');
      self.solver.set(n.id, parsed.value);
      box.value = fmtNum(U.fromCanonical(self.solver.get(n.id), n.dim, u));
    };
    box.addEventListener('change', commit);
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
    picker.addEventListener('change', function () {
      var c = self.solver.get(n.id);
      box.value = c === null ? '' : fmtNum(U.fromCanonical(c, n.dim, picker.value));
    });
    return wrap;
  };

  LGApp.prototype.computedRow = function (n) {
    var self = this;
    var wrap = el('div', 'lg-field');
    var lab = el('div', 'lg-field-label', n.label);
    lab.appendChild(this.noteBadges(n));
    wrap.appendChild(lab);
    var x = this.solver.explain(n.id);
    var out = el('div', 'lg-field-readout' + (x.stale ? ' is-stale' : ''),
      x.value === undefined || x.value === null ? 'Not yet calculated' : fmt(x.value, n.dim, n.unit));
    wrap.appendChild(out);
    if (x.stale && x.value !== undefined) wrap.appendChild(el('p', 'lg-field-note', 'Stale — an input it depends on has changed. Re-run this step to update it.'));
    if (n.basis) wrap.appendChild(el('p', 'lg-field-source', n.basis));
    if (x.formula) {
      var f = el('div', 'lg-field-formula');
      f.appendChild(el('span', 'lg-formula-label', 'Formula'));
      f.appendChild(el('code', null, x.formula));
      wrap.appendChild(f);
    }
    if (x.inputs.length) {
      wrap.appendChild(el('span', 'lg-formula-label', 'Built from'));
      var ul = el('ul', 'lg-deps');
      x.inputs.slice(0, 40).forEach(function (d) {
        var li = el('li', d.kind === 'param' || d.kind === 'cell' || d.kind === 'const' ? 'is-input' : 'is-computed');
        li.appendChild(el('span', 'lg-dep-name', d.label));
        li.appendChild(el('span', 'lg-dep-val', d.value === undefined || d.value === null ? '—' : fmt(d.value, d.dim, d.unit)));
        li.addEventListener('click', function () { self.pickNode(d.id); });
        ul.appendChild(li);
      });
      if (x.inputs.length > 40) ul.appendChild(el('li', null, '… and ' + (x.inputs.length - 40) + ' more'));
      wrap.appendChild(ul);
    }
    return wrap;
  };

  /* ── render ────────────────────────────────────────────────────────────── */
  LGApp.prototype.render = function () {
    if (!this.graph) return;
    this.renderNotes();
    this.renderRail();
    this.renderKpis();
    this.renderDiagram();
    this.renderCard();
    this.renderFields();
    this.renderTryIt();
    this.postHeight();
  };

  /* The notes are the honesty of the model, so they stay on screen. A collapsed
     strip keeps every title one click away without hiding the flowsheet. */
  LGApp.prototype.renderNotes = function () {
    var self = this;
    var box = this.$('[data-lg-notes]');
    box.innerHTML = '';
    var notes = this.doc.meta.notes || [];
    if (!notes.length) return;
    var bar = el('div', 'lg-notes-bar');
    var quirks = notes.filter(function (n) { return n.level === 'quirk'; }).length;
    bar.appendChild(el('span', 'lg-notes-count', notes.length + ' model note' + (notes.length === 1 ? '' : 's') +
      (quirks ? ' · ' + quirks + ' reproduced quirk' + (quirks === 1 ? '' : 's') + ' from the published dashboard' : '')));
    var toggle = el('button', null, this.notesCollapsed ? 'Show notes' : 'Collapse notes'); toggle.type = 'button';
    toggle.setAttribute('data-lg-notes-toggle', '');
    toggle.addEventListener('click', function () { self.notesCollapsed = !self.notesCollapsed; self.renderNotes(); self.postHeight(); });
    bar.appendChild(toggle);
    box.appendChild(bar);
    if (this.notesCollapsed) {
      var strip = el('div', 'lg-note-nodes');
      notes.forEach(function (note) {
        var b = el('button', 'lg-note-chip lg-note-chip-' + (note.level || 'info'), note.title); b.type = 'button'; b.title = note.text;
        b.addEventListener('click', function () { self.notesCollapsed = false; self.renderNotes(); if (note.nodes && note.nodes[0]) self.pickNode(note.nodes[0]); });
        strip.appendChild(b);
      });
      box.appendChild(strip);
      return;
    }
    notes.forEach(function (note) {
      var d = el('div', 'lg-note lg-note-' + (note.level || 'info'));
      d.appendChild(el('span', 'lg-note-tag', note.level === 'quirk' ? 'Reproduced quirk' : note.level));
      var body = el('div');
      var b = el('b', null, note.title + '. '); body.appendChild(b);
      body.appendChild(document.createTextNode(note.text));
      d.appendChild(body);
      if (note.nodes && note.nodes.length) {
        var chips = el('div', 'lg-note-nodes');
        note.nodes.forEach(function (id) {
          var n = self.graph.nodes[id]; if (!n) return;
          var btn = el('button', null, n.label); btn.type = 'button';
          btn.addEventListener('click', function () { self.pickNode(id); });
          chips.appendChild(btn);
        });
        d.appendChild(chips);
      }
      box.appendChild(d);
    });
  };

  LGApp.prototype.stageMeta = function (id) {
    return this.graph.stageMeta.filter(function (s) { return s.id === id; })[0];
  };

  LGApp.prototype.renderRail = function () {
    var self = this;
    var rail = this.$('[data-lg-rail]');
    rail.innerHTML = '';
    this.steps.forEach(function (id, i) {
      var meta = self.stageMeta(id);
      var btn = el('button', 'lg-step'); btn.type = 'button'; btn.setAttribute('data-step', id);
      btn.appendChild(el('span', 'lg-step-n', String(i)));
      var body = el('span');
      body.appendChild(el('span', 'lg-step-title', meta ? meta.title : (id === 'scope' ? 'Goal & scope' : 'Interpretation')));
      body.appendChild(el('br'));
      var state = el('span', 'lg-step-state');
      if (meta) {
        if (self.solver.errors[id]) { state.textContent = 'Error'; btn.classList.add('is-error'); }
        else if (!self.solver.isUnlocked(id)) { state.textContent = 'Locked'; btn.classList.add('is-locked'); }
        else if (!self.solver.isSolved(id)) { state.textContent = self.solver.stageIsDirty(id) ? 'Not run' : 'Ready'; btn.classList.add('is-stale'); }
        else { state.textContent = 'Solved'; btn.classList.add('is-solved'); }
      } else state.textContent = id === 'scope' ? 'Read first' : 'Review';
      body.appendChild(state);
      btn.appendChild(body);
      if (id === self.active) btn.classList.add('is-active');
      btn.addEventListener('click', function () { self.active = id; self.render(); });
      rail.appendChild(btn);
    });
  };

  LGApp.prototype.kpiIds = function () {
    var self = this;
    var ids = Object.keys(this.graph.nodes).filter(function (id) { return self.graph.nodes[id].kpi; });
    return ids.slice(0, 6);
  };

  LGApp.prototype.renderKpis = function () {
    var self = this;
    var box = this.$('[data-lg-kpis]');
    box.innerHTML = '';
    this.kpiIds().forEach(function (id) {
      var n = self.graph.nodes[id];
      var v = self.solver.get(id);
      var stale = self.solver.isStale(id);
      var d = el('div', 'lg-kpi' + (stale ? ' is-stale' : ''));
      d.setAttribute('data-node', id);
      d.appendChild(el('div', 'lg-kpi-label', n.label));
      d.appendChild(el('div', 'lg-kpi-val', v === undefined || v === null ? '—' : fmt(v, n.dim, n.unit)));
      var delta = self.solver.delta(id);
      var note = el('div', 'lg-kpi-note', stale ? 'stale' : (delta !== null && Math.abs(delta) > 0.0005 ? (delta > 0 ? '▲ ' : '▼ ') + (Math.abs(delta) * 100).toFixed(1) + '% since last run' : self.stageMeta(n.stage) ? self.stageMeta(n.stage).title : ''));
      if (delta !== null && !stale && Math.abs(delta) > 0.0005) d.classList.add('is-changed');
      d.appendChild(note);
      d.addEventListener('click', function () { self.pickNode(id); });
      box.appendChild(d);
    });
  };

  LGApp.prototype.renderTryIt = function () {
    var box = this.$('[data-lg-tryit]');
    box.innerHTML = '';
    var meta = this.stageMeta(this.active);
    var copy = (this.doc.stepCopy || {})[this.active];
    var text = (meta && meta.tryIt) || (copy && copy.tryIt);
    if (!text) return;
    var d = el('div', 'lg-try');
    d.appendChild(el('b', null, 'Try it'));
    d.appendChild(document.createTextNode(text));
    box.appendChild(d);
  };

  /* ── card ──────────────────────────────────────────────────────────────── */
  LGApp.prototype.renderCard = function () {
    var self = this;
    var card = this.$('[data-lg-card]');
    card.innerHTML = '';
    var id = this.active;
    var lib = LIBRARY[id] || { phase: 'Step', question: '', concept: '', formula: '' };
    var meta = this.stageMeta(id);
    card.appendChild(el('div', 'lg-card-phase', lib.phase));
    card.appendChild(el('h2', null, meta ? meta.title : (id === 'scope' ? 'Goal & scope' : 'Interpretation')));
    if (lib.question) card.appendChild(el('p', 'lg-card-q', lib.question));
    if (lib.concept) card.appendChild(el('p', null, lib.concept));
    if (lib.formula) card.appendChild(el('div', 'lg-card-formula', lib.formula));
    if (lib.why) card.appendChild(el('p', null, lib.why));

    if (id === 'scope') return this.renderScope(card);
    if (id === 'interpret') return this.renderInterpret(card);

    /* solve button + status */
    var solve = el('div', 'lg-solve');
    var btn = el('button', null, meta.verb || 'Run ' + meta.title); btn.type = 'button';
    btn.setAttribute('data-lg-solve', id);
    btn.disabled = !this.solver.isUnlocked(id);
    var msg = el('span', 'lg-solve-msg');
    if (!this.solver.isUnlocked(id)) msg.textContent = 'Locked — solve the earlier steps first.';
    else if (this.solver.errors[id]) { msg.textContent = this.solver.errors[id]; msg.classList.add('is-error'); }
    else if (this.solver.isSolved(id)) msg.textContent = 'Solved. Change an input on the right and run again to see what moves.';
    else msg.textContent = 'Ready to run.';
    btn.addEventListener('click', function () {
      var r = self.solver.solve(id);
      if (r.ok) {
        var next = self.steps[self.steps.indexOf(id) + 1];
        if (next && next !== 'interpret') self.active = next; else self.active = 'interpret';
      }
      self.render();
    });
    solve.appendChild(btn); solve.appendChild(msg);
    card.appendChild(solve);

    /* closures and constraints */
    this.solver.closures(id).forEach(function (c) {
      var has = typeof c.error === 'number' && !self.solver.isStale(c.id + '.error');
      var d = el('div', 'lg-closure' + (has ? (c.ok ? ' is-ok' : ' is-bad') : ''));
      d.appendChild(el('b', null, c.label));
      var r1 = el('div', 'lg-closure-row'); r1.appendChild(el('span', null, 'In')); r1.appendChild(el('span', null, has ? fmt(c.in, c.dim, c.unit) : '—')); d.appendChild(r1);
      var r2 = el('div', 'lg-closure-row'); r2.appendChild(el('span', null, 'Out')); r2.appendChild(el('span', null, has ? fmt(c.out, c.dim, c.unit) : '—')); d.appendChild(r2);
      var r3 = el('div', 'lg-closure-row'); r3.appendChild(el('span', null, 'Closure error (tolerance ' + (c.tolerance * 100).toFixed(c.tolerance < 0.01 ? 2 : 0) + '%)'));
      r3.appendChild(el('span', 'lg-closure-err', has ? (c.error * 100).toFixed(2) + '%' + (c.ok ? ' ✓' : ' ✗') : 'not yet run')); d.appendChild(r3);
      card.appendChild(d);
    });
    this.solver.constraints(id).forEach(function (c) {
      var evaluated = !self.solver.isStale(c.id) && self.solver.get(c.id) !== undefined;
      var d = el('div', 'lg-constraint ' + (!evaluated ? '' : c.ok ? 'is-ok' : (c.severity === 'hard' ? 'is-hard' : 'is-soft')));
      d.textContent = (evaluated ? (c.ok ? '✓ ' : '✗ ') : '· ') + c.message + (c.severity === 'hard' ? ' (required)' : ' (advisory)');
      card.appendChild(d);
    });

    /* worked numbers */
    var groups = {};
    this.solver.stageNodes(id).forEach(function (nid) {
      var n = self.graph.nodes[nid];
      if (self.solver.isLeaf(nid) || n.kind === 'constraint' || n.kind === 'array' || n.role === 'check') return;
      if (n.kind === 'rowderived') return;
      var g = n.kind === 'stream' || n.kind === 'component' ? 'Streams' : (n.role && n.role !== 'derived' ? n.role : 'Calculated');
      (groups[g] = groups[g] || []).push(nid);
    });
    Object.keys(groups).forEach(function (g) {
      card.appendChild(el('div', 'lg-group', g));
      var scroll = el('div', 'lg-scroll');
      var t = el('table', 'lg-table');
      var thead = el('thead'); var hr = el('tr');
      ['Quantity', 'Value', 'Formula'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
      thead.appendChild(hr); t.appendChild(thead);
      var tb = el('tbody');
      groups[g].forEach(function (nid) {
        var n = self.graph.nodes[nid];
        var v = self.solver.get(nid);
        var stale = self.solver.isStale(nid);
        var tr = el('tr', 'is-clickable'); tr.setAttribute('data-node', nid);
        var td1 = el('td', null, n.label); td1.appendChild(self.noteBadges(n)); tr.appendChild(td1);
        tr.appendChild(el('td', 'num' + (stale ? ' is-stale' : ''), v === undefined || v === null ? '—' : fmt(v, n.dim, n.unit)));
        var td3 = el('td'); td3.appendChild(el('code', null, n.exprText || '')); tr.appendChild(td3);
        tr.addEventListener('click', function () { self.pickNode(nid); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); scroll.appendChild(t); card.appendChild(scroll);
    });

    /* per-row derived tables of this stage (equipment costs, LCIA totals, ...) */
    Object.keys(this.graph.tables).forEach(function (tn) {
      var tbl = self.graph.tables[tn];
      var derivedCols = Object.keys(tbl.columns).filter(function (c) { return tbl.columns[c].derived && self.graph.nodes[tbl.columns[c].derived].stage === id; });
      if (!derivedCols.length) return;
      card.appendChild(el('div', 'lg-group', tbl.label));
      card.appendChild(self.tableView(tn, derivedCols, false));
    });
  };

  /* Table renderer: `cols` to show; editable cells become inputs when `edit`. */
  LGApp.prototype.tableView = function (tn, cols, edit) {
    var self = this;
    var tbl = this.graph.tables[tn];
    var scroll = el('div', 'lg-scroll');
    var t = el('table', 'lg-table');
    var thead = el('thead'); var hr = el('tr');
    hr.appendChild(el('th', null, 'Row'));
    cols.forEach(function (c) {
      var cs = tbl.columns[c];
      hr.appendChild(el('th', null, (cs.label || c) + (cs.unit ? ' (' + cs.unit + ')' : '')));
    });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    tbl.rowIds.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', null, tbl.rows[r].label || r));
      cols.forEach(function (c) {
        var nid = tn + '.' + r + '.' + c;
        var n = self.graph.nodes[nid];
        var td = el('td', 'num');
        if (!n) { td.textContent = String(tbl.rows[r][c] === undefined ? '' : tbl.rows[r][c]); tr.appendChild(td); return; }
        var v = self.solver.get(nid);
        if (edit && n.editable) {
          var inp = el('input'); inp.type = 'text'; inp.setAttribute('inputmode', 'decimal');
          inp.id = 'f_' + nid.replace(/\./g, '_');
          inp.value = v === null || v === undefined ? '' : fmtNum(U.fromCanonical(v, n.dim, n.unit));
          var commit = function () {
            if (inp.value.trim() === '' && n.nullable) { self.solver.set(nid, null); return; }
            var p = U.parseEntry(inp.value, n.dim, n.unit);
            if (!p.ok) { inp.style.borderColor = '#a32d2d'; return; }
            inp.style.borderColor = '';
            self.solver.set(nid, p.value);
          };
          inp.addEventListener('change', commit);
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
          td.appendChild(inp);
        } else {
          td.textContent = v === null || v === undefined ? '—' : fmtNum(U.fromCanonical(v, n.dim, n.unit));
          if (self.solver.isStale(nid)) td.classList.add('is-stale');
          if (n.kind === 'rowderived') { td.style.cursor = 'pointer'; td.addEventListener('click', function () { self.select('node:' + nid); }); }
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb); scroll.appendChild(t);
    return scroll;
  };

  LGApp.prototype.renderScope = function (card) {
    var self = this;
    var m = this.doc.meta;
    var t = el('table', 'lg-table');
    var tb = el('tbody');
    var rows = [['Functional unit', m.functionalUnit], ['System boundary', m.boundary], ['Source', m.source], ['Currency', m.currency]];
    if (this.graph.allocation) {
      Object.keys(this.graph.allocation).forEach(function (k) {
        var a = self.graph.allocation[k];
        rows.push(['Allocation (' + k.toUpperCase() + ')', (a.method || '') + (a.basis ? ' — ' + a.basis : '')]);
      });
    }
    if (this.graph.lcia && this.graph.lcia.method) rows.push(['Impact method', this.graph.lcia.method + ' · ' + ((this.graph.lcia.categories || []).length) + ' categories']);
    rows.forEach(function (r) {
      if (!r[1]) return;
      var tr = el('tr'); tr.appendChild(el('td', null, r[0])); tr.appendChild(el('td', null, r[1])); tb.appendChild(tr);
    });
    t.appendChild(tb); card.appendChild(el('div', 'lg-group', 'This case')); card.appendChild(t);

    card.appendChild(el('div', 'lg-group', 'The calculation graph'));
    var counts = {};
    Object.keys(this.graph.nodes).forEach(function (id) { var k = self.graph.nodes[id].stage; counts[k] = (counts[k] || 0) + 1; });
    var t2 = el('table', 'lg-table'); var tb2 = el('tbody');
    this.stageIds.forEach(function (s) {
      var inputs = Object.keys(self.graph.nodes).filter(function (id) { var n = self.graph.nodes[id]; return n.stage === s && self.solver.isLeaf(id) && n.editable; }).length;
      var tr = el('tr'); tr.appendChild(el('td', null, self.stageMeta(s).title));
      tr.appendChild(el('td', 'num', counts[s] + ' nodes')); tr.appendChild(el('td', 'num', inputs + ' inputs you can set')); tb2.appendChild(tr);
    });
    t2.appendChild(tb2); card.appendChild(t2);

    if (Object.keys(this.graph.targets).length) {
      card.appendChild(el('div', 'lg-group', 'Calculation targets available'));
      var chips = el('div', 'lg-chips');
      Object.keys(this.graph.targets).forEach(function (k) {
        var c = el('span', 'lg-chip', self.graph.targets[k].label || k);
        c.addEventListener('click', function () { self.active = 'interpret'; self.targetChoice = k; self.render(); });
        chips.appendChild(c);
      });
      card.appendChild(chips);
    }
  };

  /* ── interpretation: targets and sensitivity ───────────────────────────── */
  LGApp.prototype.renderInterpret = function (card) {
    var self = this;
    var sec = el('div', 'lg-section');
    sec.appendChild(el('h3', null, 'Calculation targets'));
    sec.appendChild(el('p', 'lg-mini', 'Pick what you want to know. The graph shows which steps and which inputs that answer needs, and computes just that part.'));
    var line = el('div', 'lg-inline');
    var sel = el('select');
    Object.keys(this.graph.targets).forEach(function (k) {
      var o = el('option', null, self.graph.targets[k].label || k); o.value = 't:' + k; sel.appendChild(o);
    });
    var og = el('optgroup'); og.label = 'Any calculated quantity';
    Object.keys(this.graph.nodes).forEach(function (id) {
      var n = self.graph.nodes[id];
      if (self.solver.isLeaf(id) || n.kind === 'array' || n.kind === 'rowderived' || n.kind === 'constraint' || n.role === 'check') return;
      var o = el('option', null, n.label + ' (' + self.stageMeta(n.stage).title + ')'); o.value = 'n:' + id; og.appendChild(o);
    });
    sel.appendChild(og);
    if (this.targetChoice) sel.value = 't:' + this.targetChoice;
    var go = el('button', null, 'Analyse'); go.type = 'button';
    var compute = el('button', 'lg-secondary', 'Compute now'); compute.type = 'button';
    line.appendChild(sel); line.appendChild(go); line.appendChild(compute);
    sec.appendChild(line);
    var out = el('div', 'lg-result'); sec.appendChild(out);
    var nodesFor = function () {
      var v = sel.value;
      return v.indexOf('t:') === 0 ? self.graph.targets[v.slice(2)].nodes : [v.slice(2)];
    };
    var analyse = function () {
      out.innerHTML = '';
      var ids = nodesFor();
      var a = L.targets.analyse(self.solver, ids);
      var t = el('table', 'lg-table'); var tb = el('tbody');
      var add = function (k, v) { var tr = el('tr'); tr.appendChild(el('td', null, k)); var td = el('td'); if (typeof v === 'string') td.textContent = v; else td.appendChild(v); tr.appendChild(td); tb.appendChild(tr); };
      add('Targets', ids.map(function (id) { return self.graph.nodes[id].label; }).join(', '));
      add('Steps needed', a.stages.map(function (s) { return self.stageMeta(s).title; }).join(' → '));
      add('Graph size', a.subgraph.length + ' nodes, ' + a.inputs.length + ' inputs (' + a.editable.length + ' editable)');
      var chips = el('div', 'lg-chips');
      a.editable.forEach(function (id) {
        var c = el('span', 'lg-chip' + (a.missing.indexOf(id) !== -1 ? ' is-missing' : ''), self.graph.nodes[id].label);
        c.addEventListener('click', function () { self.pickNode(id); });
        chips.appendChild(c);
      });
      add('Inputs you set', chips);
      if (a.missing.length) add('Missing', a.missing.map(function (id) { return self.graph.nodes[id].label; }).join(', '));
      t.appendChild(tb); out.appendChild(t);
    };
    go.addEventListener('click', analyse);
    compute.addEventListener('click', function () {
      analyse();
      var ids = nodesFor();
      var r = L.targets.compute(self.solver, ids);
      var t = el('table', 'lg-table'); var tb = el('tbody');
      ids.forEach(function (id) {
        var n = self.graph.nodes[id];
        var tr = el('tr', 'is-clickable'); tr.appendChild(el('td', null, n.label)); tr.appendChild(el('td', 'num', fmt(r.values[id], n.dim, n.unit)));
        tr.addEventListener('click', function () { self.pickNode(id); });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      out.appendChild(el('div', 'lg-group', 'Computed directly from the current inputs' + (r.converged ? '' : ' (recycle did not converge)')));
      out.appendChild(t);
    });
    card.appendChild(sec);
    if (this.targetChoice) { analyse(); this.targetChoice = null; }

    /* sensitivity */
    var s2 = el('div', 'lg-section');
    s2.appendChild(el('h3', null, 'Sensitivity analysis'));
    s2.appendChild(el('p', 'lg-mini', 'Each analysis re-runs only the part of the graph the target needs. Values are in the input’s own unit. Nothing here changes the case on the left.'));
    var specs = this.graph.sensitivity;
    Object.keys(specs).forEach(function (k) { s2.appendChild(self.specView(k, specs[k])); });
    /* ad-hoc tornado on any KPI */
    var adhoc = el('div', 'lg-spec');
    var h = el('div', 'lg-spec-head'); h.appendChild(el('b', null, 'Quick tornado on any KPI'));
    var l2 = el('div', 'lg-inline');
    var ksel = el('select');
    this.kpiIds().forEach(function (id) { var o = el('option', null, self.graph.nodes[id].label); o.value = id; ksel.appendChild(o); });
    var dl = el('input'); dl.type = 'number'; dl.value = '10'; dl.min = '1'; dl.max = '90'; dl.style.width = '70px';
    var run = el('button', null, 'Run ±%'); run.type = 'button';
    l2.appendChild(ksel); l2.appendChild(dl); l2.appendChild(run);
    adhoc.appendChild(h); adhoc.appendChild(l2);
    var res = el('div'); adhoc.appendChild(res);
    run.addEventListener('click', function () {
      res.innerHTML = '';
      var r = L.sensitivity.oat(self.solver, { kind: 'oat', target: ksel.value, params: 'editable', delta: Number(dl.value) / 100 });
      res.appendChild(self.resultView(r));
    });
    s2.appendChild(adhoc);
    card.appendChild(s2);
  };

  LGApp.prototype.specView = function (key, spec) {
    var self = this;
    var box = el('div', 'lg-spec');
    var head = el('div', 'lg-spec-head');
    var title = el('div');
    title.appendChild(el('b', null, spec.label || key));
    title.appendChild(el('br'));
    var ids = spec.targets || [spec.target];
    var desc = spec.kind.toUpperCase() + ' → ' + ids.map(function (id) { return self.graph.nodes[id] ? self.graph.nodes[id].label : id; }).join(', ');
    if (spec.kind === 'oat') desc += ' · ±' + ((spec.delta === undefined ? 0.1 : spec.delta) * 100) + '% on ' + (Array.isArray(spec.params) ? spec.params.length + ' inputs' : 'every editable input');
    if (spec.kind === 'sweep') desc += ' · ' + spec.param + (spec.param2 ? ' × ' + spec.param2 : '');
    if (spec.kind === 'scenario') desc += ' · ' + Object.keys(spec.scenarios || {}).length + ' scenarios';
    if (spec.kind === 'montecarlo') desc += ' · n=' + (spec.n || 1000) + ', seed ' + (spec.seed === undefined ? 1 : spec.seed) + ', ' + Object.keys(spec.params || {}).length + ' distributions';
    title.appendChild(el('code', null, desc));
    head.appendChild(title);
    var run = el('button', null, 'Run'); run.type = 'button';
    var l = el('div', 'lg-inline'); l.appendChild(run); head.appendChild(l);
    box.appendChild(head);
    var res = el('div');
    box.appendChild(res);
    var show = function () {
      res.innerHTML = '';
      try {
        var t0 = performance.now();
        var r = L.sensitivity.run(self.solver, spec);
        self.sensResults[key] = r;
        res.appendChild(self.resultView(r));
        res.appendChild(el('p', 'lg-mini', 'Ran in ' + (performance.now() - t0).toFixed(0) + ' ms.'));
      } catch (e) { res.appendChild(el('p', 'lg-status is-error', e.message)); }
    };
    run.addEventListener('click', show);
    if (this.sensResults[key]) { res.appendChild(this.resultView(this.sensResults[key])); }
    return box;
  };

  LGApp.prototype.resultView = function (r) {
    var self = this;
    var nodes = this.graph.nodes;
    var box = el('div', 'lg-result');
    var t, tb, hr;
    if (r.kind === 'oat') {
      var tid = r.targets[0]; var tn = nodes[tid];
      box.appendChild(el('h4', null, 'Tornado: ' + tn.label + ' (base ' + fmt(r.base[tid], tn.dim, tn.unit) + ')'));
      var span = 0;
      r.rows.forEach(function (row) {
        var p = row.results[tid];
        if (typeof p.low === 'number') span = Math.max(span, Math.abs(p.low - p.base));
        if (typeof p.high === 'number') span = Math.max(span, Math.abs(p.high - p.base));
      });
      t = el('table', 'lg-table'); hr = el('tr');
      ['Input', 'Low → high', 'Result at low', 'Result at high', 'Swing', ''].forEach(function (h) { hr.appendChild(el('th', null, h)); });
      t.appendChild(el('thead')).appendChild(hr); tb = el('tbody');
      r.rows.forEach(function (row) {
        var p = row.results[tid];
        var tr = el('tr', 'is-clickable');
        tr.appendChild(el('td', null, row.label));
        tr.appendChild(el('td', 'num', fmtNum(U.fromCanonical(row.lo, row.dim, row.unit)) + ' → ' + fmtNum(U.fromCanonical(row.hi, row.dim, row.unit)) + (row.unit ? ' ' + row.unit : '')));
        tr.appendChild(el('td', 'num', fmt(p.low, tn.dim, tn.unit)));
        tr.appendChild(el('td', 'num', fmt(p.high, tn.dim, tn.unit)));
        tr.appendChild(el('td', 'num', p.swing === null ? '—' : fmt(p.swing, tn.dim, tn.unit)));
        var td = el('td'); var bar = el('div', 'lg-bar');
        if (span > 0 && typeof p.low === 'number' && typeof p.high === 'number') {
          var lo = Math.min(p.low, p.high) - p.base, hi = Math.max(p.low, p.high) - p.base;
          var a = el('span', lo < 0 ? 'lo' : 'hi'); a.style.left = (50 + 50 * Math.min(lo, 0) / span) + '%'; a.style.width = (50 * Math.abs(Math.min(lo, 0)) / span) + '%'; bar.appendChild(a);
          var b = el('span', 'hi'); b.style.left = '50%'; b.style.width = (50 * Math.max(hi, 0) / span) + '%'; bar.appendChild(b);
        }
        var i = el('i'); i.style.left = '50%'; bar.appendChild(i);
        td.appendChild(bar); tr.appendChild(td);
        tr.addEventListener('click', function () { self.pickNode(row.param); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); box.appendChild(el('div', 'lg-scroll')).appendChild(t);
    } else if (r.kind === 'sweep') {
      var p1 = nodes[r.param];
      box.appendChild(el('h4', null, p1.label + ' sweep'));
      t = el('table', 'lg-table'); hr = el('tr');
      hr.appendChild(el('th', null, p1.label + (p1.unit ? ' (' + p1.unit + ')' : '')));
      r.targets.forEach(function (id) { hr.appendChild(el('th', null, nodes[id].label)); });
      t.appendChild(el('thead')).appendChild(hr); tb = el('tbody');
      r.points.forEach(function (pt) {
        var tr = el('tr'); tr.appendChild(el('td', 'num', fmtNum(U.fromCanonical(pt.x, p1.dim, p1.unit))));
        r.targets.forEach(function (id) { tr.appendChild(el('td', 'num', fmt(pt.values[id], nodes[id].dim, nodes[id].unit))); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); box.appendChild(el('div', 'lg-scroll')).appendChild(t);
    } else if (r.kind === 'sweep2') {
      var q1 = nodes[r.param], q2 = nodes[r.param2], tid2 = r.targets[0];
      box.appendChild(el('h4', null, nodes[tid2].label + ' over ' + q1.label + ' × ' + q2.label));
      t = el('table', 'lg-table'); hr = el('tr');
      hr.appendChild(el('th', null, q2.label + ' ↓ / ' + q1.label + ' →'));
      r.x.forEach(function (x) { hr.appendChild(el('th', null, fmtNum(U.fromCanonical(x, q1.dim, q1.unit)))); });
      t.appendChild(el('thead')).appendChild(hr); tb = el('tbody');
      r.grid.forEach(function (row, j) {
        var tr = el('tr'); tr.appendChild(el('td', 'num', fmtNum(U.fromCanonical(r.y[j], q2.dim, q2.unit))));
        row.forEach(function (cell) { tr.appendChild(el('td', 'num', fmtNum(U.fromCanonical(cell[tid2], nodes[tid2].dim, nodes[tid2].unit)))); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); box.appendChild(el('div', 'lg-scroll')).appendChild(t);
    } else if (r.kind === 'scenario') {
      box.appendChild(el('h4', null, 'Scenarios'));
      t = el('table', 'lg-table'); hr = el('tr');
      hr.appendChild(el('th', null, 'Scenario'));
      r.targets.forEach(function (id) { hr.appendChild(el('th', null, nodes[id].label)); hr.appendChild(el('th', null, 'Δ')); });
      t.appendChild(el('thead')).appendChild(hr); tb = el('tbody');
      var base = el('tr'); base.appendChild(el('td', null, 'Base case'));
      r.targets.forEach(function (id) { base.appendChild(el('td', 'num', fmt(r.base[id], nodes[id].dim, nodes[id].unit))); base.appendChild(el('td', 'num', '')); });
      tb.appendChild(base);
      r.rows.forEach(function (row) {
        var tr = el('tr'); tr.appendChild(el('td', null, row.name));
        r.targets.forEach(function (id) {
          tr.appendChild(el('td', 'num', fmt(row.values[id], nodes[id].dim, nodes[id].unit)));
          tr.appendChild(el('td', 'num', row.change[id] === null ? '—' : (row.change[id] * 100).toFixed(1) + '%'));
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb); box.appendChild(el('div', 'lg-scroll')).appendChild(t);
    } else if (r.kind === 'montecarlo') {
      r.targets.forEach(function (id) {
        var s = r.stats[id]; var n = nodes[id];
        box.appendChild(el('h4', null, n.label + ' — ' + s.n + ' samples' + (r.failures ? ', ' + r.failures + ' failed' : '')));
        var hist = el('div', 'lg-hist');
        var mx = Math.max.apply(null, s.histogram.bins.concat([1]));
        s.histogram.bins.forEach(function (c) { var b = el('span'); b.style.height = (100 * c / mx) + '%'; hist.appendChild(b); });
        box.appendChild(hist);
        box.appendChild(el('p', 'lg-mini', fmt(s.histogram.lo, n.dim, n.unit) + ' … ' + fmt(s.histogram.hi, n.dim, n.unit)));
        t = el('table', 'lg-table'); tb = el('tbody');
        [['Mean', s.mean], ['Std dev', s.sd], ['P5', s.p5], ['P10', s.p10], ['Median', s.p50], ['P90', s.p90], ['P95', s.p95]].forEach(function (row) {
          var tr = el('tr'); tr.appendChild(el('td', null, row[0])); tr.appendChild(el('td', 'num', fmt(row[1], n.dim, n.unit))); tb.appendChild(tr);
        });
        var tr2 = el('tr'); tr2.appendChild(el('td', null, 'Probability > 0')); tr2.appendChild(el('td', 'num', s.probPositive === null ? '—' : (s.probPositive * 100).toFixed(1) + '%')); tb.appendChild(tr2);
        t.appendChild(tb); box.appendChild(t);
      });
    }
    return box;
  };

  /* ── fields (right column) ─────────────────────────────────────────────── */
  LGApp.prototype.renderFields = function () {
    var self = this;
    var box = this.$('[data-lg-fields]');
    box.innerHTML = '';
    var head = el('div', 'lg-fields-head');
    var id = this.active;
    if (id === 'scope' || id === 'interpret') {
      head.appendChild(el('h3', null, id === 'scope' ? 'Inputs by step' : 'All inputs'));
      box.appendChild(head);
      box.appendChild(el('p', 'lg-mini', 'Every amber number on the flowsheet is an input. Open a step to edit its inputs, or click a stream or unit.'));
      this.stageIds.forEach(function (s) {
        var ids = self.stageInputs(s);
        if (!ids.length) return;
        box.appendChild(el('div', 'lg-group', self.stageMeta(s).title + ' · ' + ids.length));
        var chips = el('div', 'lg-chips');
        ids.slice(0, 30).forEach(function (pid) {
          var c = el('span', 'lg-chip', self.graph.nodes[pid].label);
          c.addEventListener('click', function () { self.pickNode(pid); });
          chips.appendChild(c);
        });
        if (ids.length > 30) chips.appendChild(el('span', 'lg-mini', '… +' + (ids.length - 30)));
        box.appendChild(chips);
      });
      return;
    }
    head.appendChild(el('h3', null, 'Inputs for this step'));
    head.appendChild(el('span', 'lg-mini', this.stageMeta(id).title));
    box.appendChild(head);
    var ids = this.stageInputs(id).filter(function (pid) { return self.graph.nodes[pid].kind === 'param'; });
    if (!ids.length) box.appendChild(el('p', 'lg-mini', 'No free inputs at this step — everything follows from earlier steps and fixed constants.'));
    ids.forEach(function (pid) {
      var row = self.inputRow(self.graph.nodes[pid]);
      row.setAttribute('data-node', pid);
      box.appendChild(row);
    });
    /* editable tables of this stage */
    Object.keys(this.graph.tables).forEach(function (tn) {
      var tbl = self.graph.tables[tn];
      if (tbl.stage !== id) return;
      var cols = Object.keys(tbl.columns).filter(function (c) { return tbl.columns[c].type !== 'text' && !tbl.columns[c].derived; });
      var anyEditable = cols.some(function (c) { return tbl.columns[c].editable; });
      box.appendChild(el('div', 'lg-group', tbl.label + (anyEditable ? ' · editable cells' : ' · fixed data')));
      box.appendChild(self.tableView(tn, cols, true));
    });
    /* constants used at this step, collapsed */
    var consts = this.solver.stageNodes(id).filter(function (nid) { var n = self.graph.nodes[nid]; return n.kind === 'param' && !n.editable; });
    if (consts.length) {
      var det = el('details');
      det.appendChild(el('summary', 'lg-group', 'Fixed constants at this step · ' + consts.length));
      var t = el('table', 'lg-table'); var tb = el('tbody');
      consts.forEach(function (nid) {
        var n = self.graph.nodes[nid];
        var tr = el('tr', 'is-clickable'); tr.setAttribute('data-node', nid);
        var td = el('td', null, n.label); td.appendChild(self.noteBadges(n)); tr.appendChild(td);
        tr.appendChild(el('td', 'num', fmt(self.solver.get(nid), n.dim, n.unit)));
        tr.addEventListener('click', function () { self.pickNode(nid); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); det.appendChild(t); box.appendChild(det);
    }
  };

  LGApp.prototype.stageInputs = function (stageId) {
    var self = this;
    return Object.keys(this.graph.nodes).filter(function (id) {
      var n = self.graph.nodes[id];
      return n.stage === stageId && (n.kind === 'param' || n.kind === 'cell') && n.editable;
    });
  };

  LGApp.prototype.postHeight = function () {
    if (global.parent === global) return;
    try {
      // Same message shape as the step-by-step pages, so resources.html sizes this frame too.
      global.parent.postMessage({ ccSbsHeight: Math.ceil(document.body.scrollHeight), ccSbsModel: this.doc ? this.doc.meta.id : null }, '*');
    } catch (e) { /* cross-origin parent: nothing to do */ }
  };

  global.LGApp = LGApp;
})(typeof window !== 'undefined' ? window : globalThis);
