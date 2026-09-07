/* Clove Circle — unit registry.
   Every variable declares a dimension; the unit picker only ever offers units of
   that dimension, so a mass flow can never be entered as an energy. Values are
   stored canonically and converted only on commit. */
(function (global) {
  'use strict';

  // to: canonical = display * factor
  var DIMENSIONS = {
    mass_flow: {
      canonical: 't/d',
      units: { 't/d': 1, 't/h': 24, 'kg/h': 0.024, 'kg/d': 0.001, 'kg/s': 86.4 }
    },
    mass: {
      canonical: 'kg',
      units: { 'kg': 1, 't': 1000, 'g': 0.001 }
    },
    mass_year: {
      canonical: 'kg/y',
      units: { 'kg/y': 1, 't/y': 1000, 'g/y': 0.001 }
    },
    mass_hour: {
      canonical: 'kg/h',
      units: { 'kg/h': 1, 't/h': 1000, 't/d': 1000 / 24, 'g/h': 0.001 }
    },
    volume_flow: {
      canonical: 'm³/y',
      units: { 'm³/y': 1, 'L/y': 0.001, 'ML/y': 1000 }
    },
    volume_intensity: {
      canonical: 'm³/kg',
      units: { 'm³/kg': 1, 'L/kg': 0.001 }
    },
    mass_intensity: {
      canonical: 'kg/kg',
      units: { 'kg/kg': 1, 'g/kg': 0.001, 't/t': 1 }
    },
    energy_per_mass: {
      canonical: 'kWh/kg',
      units: { 'kWh/kg': 1, 'MWh/kg': 1000, 'MWh/t': 1, 'GJ/t': 1 / 3.6 }
    },
    energy: {
      canonical: 'GJ',
      units: { 'GJ': 1, 'MWh': 3.6, 'kWh': 0.0036, 'MJ': 0.001 }
    },
    energy_intensity: {
      canonical: 'GJ/t',
      units: { 'GJ/t': 1, 'kWh/t': 0.0036, 'MJ/kg': 1 }
    },
    price_mass: {
      canonical: '$/t',
      units: { '$/t': 1, '$/kg': 1000, '$/g': 1e6 }
    },
    price_energy: {
      canonical: '$/GJ',
      units: { '$/GJ': 1, '$/MWh': 1 / 3.6, '$/kWh': 1000 / 3.6 }
    },
    currency: {
      canonical: '$M',
      units: { '$M': 1, '$': 1e-6, '$k': 1e-3 }
    },
    fraction: {
      canonical: 'fraction',
      units: { 'fraction': 1, '%': 0.01 }
    },
    gwp_intensity: {
      canonical: 'kg CO2e/kg',
      units: { 'kg CO2e/kg': 1, 't CO2e/t': 1, 'g CO2e/kg': 0.001 }
    },
    gwp: {
      canonical: 'kt CO2e/y',
      units: { 'kt CO2e/y': 1, 't CO2e/y': 0.001 }
    },
    ratio: { canonical: 'mol/mol', units: { 'mol/mol': 1 } },
    days: { canonical: 'd/y', units: { 'd/y': 1 } },
    years: { canonical: 'y', units: { 'y': 1 } },
    count: { canonical: '', units: { '': 1 } },
    concentration: {
      canonical: 'g/L',
      units: { 'g/L': 1, 'kg/m3': 1, 'mg/L': 0.001 }
    },
    molarity: {
      canonical: 'mM',
      units: { 'mM': 1, 'M': 1000, 'uM': 0.001 }
    }
  };

  function dim(name) {
    var d = DIMENSIONS[name];
    if (!d) throw new Error('cc-units: unknown dimension "' + name + '"');
    return d;
  }

  function unitsFor(name) { return Object.keys(dim(name).units); }

  function canonicalUnit(name) { return dim(name).canonical; }

  function factor(name, unit) {
    var f = dim(name).units[unit];
    if (f === undefined) {
      throw new Error('cc-units: "' + unit + '" is not a unit of ' + name);
    }
    return f;
  }

  /* Display value -> canonical value. */
  function toCanonical(value, dimension, unit) {
    return value * factor(dimension, unit);
  }

  /* Canonical value -> display value in `unit`. */
  function fromCanonical(value, dimension, unit) {
    return value / factor(dimension, unit);
  }

  /* Accepts "85%", "0.85", "36,000", "3.6e4". Percent-vs-fraction is the classic
     student error, so for fraction dimensions a trailing % is honoured and a bare
     number > 1 is read as a percentage rather than silently producing nonsense. */
  function parseEntry(raw, dimension, unit) {
    var text = String(raw).trim().replace(/,/g, '');
    var pct = /%$/.test(text);
    if (pct) text = text.slice(0, -1).trim();
    var n = Number(text);
    if (text === '' || !isFinite(n)) return { ok: false, error: 'Not a number' };
    if (dimension === 'fraction') {
      if (pct || n > 1) return { ok: true, value: n / 100, coerced: pct ? null : 'read as a percentage' };
      return { ok: true, value: n };
    }
    if (pct) return { ok: false, error: '% is only meaningful for a fraction' };
    return { ok: true, value: toCanonical(n, dimension, unit) };
  }

  function format(value, digits) {
    if (value === null || value === undefined || !isFinite(value)) return '—';
    var d = digits;
    if (d === undefined) {
      var a = Math.abs(value);
      d = a === 0 ? 0 : a < 0.01 ? 4 : a < 1 ? 3 : a < 100 ? 2 : a < 10000 ? 1 : 0;
    }
    return value.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function formatWithUnit(value, dimension, unit, digits) {
    var shown = fromCanonical(value, dimension, unit);
    var u = unit === '' ? '' : ' ' + unit;
    return format(shown, digits) + u;
  }

  global.CCUnits = {
    DIMENSIONS: DIMENSIONS,
    unitsFor: unitsFor,
    canonicalUnit: canonicalUnit,
    toCanonical: toCanonical,
    fromCanonical: fromCanonical,
    parseEntry: parseEntry,
    format: format,
    formatWithUnit: formatWithUnit
  };
})(window);
