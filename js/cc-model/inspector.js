/* Clove Circle - the inspector panel.

   Clicking a stream or a block opens this. An input variable gets a value box and
   a unit picker limited to its own dimension; a computed variable is read-only and
   shows the formula and the inputs that produced it, which is the part a textbook
   cannot do. */
(function (global) {
  'use strict';

  var U = global.CCUnits;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function CCInspector(root, engine, opts) {
    this.root = root;
    this.engine = engine;
    this.model = engine.model;
    this.onChange = (opts && opts.onChange) || function () {};
    this.current = null;
    this.showEmpty();
  }

  CCInspector.prototype.showEmpty = function () {
    this.current = null;
    this.root.innerHTML = '';
    var box = el('div', 'cc-insp-empty');
    box.appendChild(el('div', 'cc-insp-empty-icon', '◇'));
    box.appendChild(el('p', null,
      'Click any stream or unit on the flowsheet to see what it is and, where it is an input, to change it.'));
    box.appendChild(el('p', 'cc-insp-empty-hint',
      'Amber items are yours to set. Grey items are calculated — click one to see the formula behind it.'));
    this.root.appendChild(box);
  };

  CCInspector.prototype.show = function (sel) {
    var self = this;
    this.current = sel;
    this.root.innerHTML = '';

    var head = el('div', 'cc-insp-head');
    head.appendChild(el('h4', null, sel.title || 'Selected'));
    head.appendChild(el('span', 'cc-insp-tag', sel.editable ? 'You set this' : 'Calculated'));
    this.root.appendChild(head);

    if (!sel.vars.length) { this.showEmpty(); return; }

    sel.vars.forEach(function (id) {
      var v = self.model.vars[id];
      if (!v) return;
      self.root.appendChild(v.kind === 'input' ? self.inputRow(v) : self.computedRow(v));
    });
  };

  CCInspector.prototype.inputRow = function (v) {
    var self = this;
    var engine = this.engine;
    var wrap = el('div', 'cc-field cc-field-input');

    var lab = el('label', 'cc-field-label', v.label);
    lab.setAttribute('for', 'f_' + v.id);
    wrap.appendChild(lab);

    var row = el('div', 'cc-field-row');
    var box = el('input', 'cc-field-value');
    box.type = 'text';
    box.id = 'f_' + v.id;
    box.setAttribute('inputmode', 'decimal');

    var unit = engine.display[v.id] || v.unit || U.canonicalUnit(v.dim);
    box.value = U.format(U.fromCanonical(engine.get(v.id), v.dim, unit));

    var picker = el('select', 'cc-field-unit');
    U.unitsFor(v.dim).forEach(function (u) {
      var o = el('option', null, u === '' ? '—' : u);
      o.value = u;
      if (u === unit) o.selected = true;
      picker.appendChild(o);
    });
    // A single-unit dimension has nothing to choose, so don't offer a choice.
    if (U.unitsFor(v.dim).length < 2) picker.disabled = true;

    row.appendChild(box);
    row.appendChild(picker);
    wrap.appendChild(row);

    var note = el('div', 'cc-field-note');
    wrap.appendChild(note);

    if (v.source) wrap.appendChild(el('p', 'cc-field-source', v.source));
    if (v.range) {
      wrap.appendChild(el('p', 'cc-field-range',
        'Typical range: ' + U.format(U.fromCanonical(v.range[0], v.dim, unit)) +
        ' – ' + U.format(U.fromCanonical(v.range[1], v.dim, unit)) +
        (unit ? ' ' + unit : '')));
    }

    var commit = function () {
      var u = picker.value;
      var parsed = U.parseEntry(box.value, v.dim, u);
      if (!parsed.ok) {
        wrap.classList.add('has-error');
        note.textContent = parsed.error;
        return;
      }
      wrap.classList.remove('has-error');
      note.textContent = parsed.coerced ? parsed.coerced : '';

      if (v.range && (parsed.value < v.range[0] || parsed.value > v.range[1])) {
        wrap.classList.add('has-warning');
        note.textContent = 'Outside the typical range — allowed, but check it is what you mean.';
      } else {
        wrap.classList.remove('has-warning');
      }

      engine.setValue(v.id, parsed.value, u);
      box.value = U.format(U.fromCanonical(engine.get(v.id), v.dim, u));
      self.onChange(v.id);
    };

    box.addEventListener('change', commit);
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
    picker.addEventListener('change', function () {
      // Changing the unit re-expresses the same physical quantity; it is not an edit.
      var canonical = engine.get(v.id);
      engine.display[v.id] = picker.value;
      box.value = U.format(U.fromCanonical(canonical, v.dim, picker.value));
      note.textContent = '';
    });

    return wrap;
  };

  CCInspector.prototype.computedRow = function (v) {
    var self = this;
    var engine = this.engine;
    var wrap = el('div', 'cc-field cc-field-computed');

    wrap.appendChild(el('div', 'cc-field-label', v.label));

    var value = engine.get(v.id);
    var unit = v.unit || U.canonicalUnit(v.dim);
    var stale = engine.isStale(v.stage);
    var out = el('div', 'cc-field-readout' + (stale ? ' is-stale' : ''),
      value === undefined || !isFinite(value) ? 'Not yet calculated'
        : U.formatWithUnit(value, v.dim, unit));
    wrap.appendChild(out);

    if (stale) {
      wrap.appendChild(el('p', 'cc-field-note',
        'Stale — an input it depends on has changed. Re-run this step to update it.'));
    }

    if (v.expr) {
      var f = el('div', 'cc-field-formula');
      f.appendChild(el('span', 'cc-formula-label', 'Formula'));
      f.appendChild(el('code', null, v.expr));
      wrap.appendChild(f);
    }

    if (v.deps && v.deps.length) {
      var deps = el('div', 'cc-field-deps');
      deps.appendChild(el('span', 'cc-formula-label', 'Built from'));
      var list = el('ul');
      v.deps.forEach(function (d) {
        var dv = self.model.vars[d];
        if (!dv) return;
        var dval = engine.get(d);
        var du = dv.unit || U.canonicalUnit(dv.dim);
        var li = el('li');
        li.appendChild(el('span', 'cc-dep-name', dv.label));
        li.appendChild(el('span', 'cc-dep-val',
          dval === undefined || !isFinite(dval) ? '--' : U.formatWithUnit(dval, dv.dim, du)));
        li.classList.add(dv.kind === 'input' ? 'is-input' : 'is-computed');
        list.appendChild(li);
      });
      deps.appendChild(list);
      wrap.appendChild(deps);
    }

    return wrap;
  };

  global.CCInspector = CCInspector;
})(typeof window !== 'undefined' ? window : globalThis);
