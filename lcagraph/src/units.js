/* LCA Graph - unit registry.
   Every node declares a dimension. Values are stored in the dimension's canonical unit and
   converted only at the edges (display, entry, golden comparison). A model may not invent a
   unit string: it must exist here. */
(function (global) {
  'use strict';

  // canonical = display * factor
  var DIMENSIONS = {
    mass_flow:        { canonical: 't/d',        units: { 't/d': 1, 't/h': 24, 'kg/h': 0.024, 'kg/d': 0.001, 'kg/s': 86.4, 'tpd': 1 } },
    mass_hour:        { canonical: 'kg/h',       units: { 'kg/h': 1, 't/h': 1000, 't/d': 1000 / 24, 'g/h': 0.001, 'tph': 1000 } },
    mass_year:        { canonical: 'kg/y',       units: { 'kg/y': 1, 't/y': 1000, 'kt/y': 1e6, 'g/y': 0.001, 'tpa': 1000, 'ktpa': 1e6 } },
    mass:             { canonical: 'kg',         units: { 'kg': 1, 't': 1000, 'g': 0.001 } },
    volume_flow:      { canonical: 'm³/y',       units: { 'm³/y': 1, 'L/y': 0.001, 'ML/y': 1000, 'm3/y': 1 } },
    volume_hour:      { canonical: 'L/h',        units: { 'L/h': 1, 'm³/h': 1000, 'm3/h': 1000 } },
    volume_intensity: { canonical: 'm³/kg',      units: { 'm³/kg': 1, 'L/kg': 0.001, 'm3/kg': 1 } },
    mass_intensity:   { canonical: 'kg/kg',      units: { 'kg/kg': 1, 'g/kg': 0.001, 't/t': 1, 'kg/t': 0.001 } },
    energy_per_mass:  { canonical: 'kWh/kg',     units: { 'kWh/kg': 1, 'MWh/kg': 1000, 'MWh/t': 1, 'GJ/t': 1 / 3.6, 'kWh/t': 0.001, 'MJ/kg': 1 / 3.6 } },
    energy:           { canonical: 'GJ',         units: { 'GJ': 1, 'MWh': 3.6, 'kWh': 0.0036, 'MJ': 0.001, 'TJ': 1000 } },
    energy_year:      { canonical: 'GJ/y',       units: { 'GJ/y': 1, 'MWh/y': 3.6, 'kWh/y': 0.0036, 'MJ/y': 0.001, 'TJ/y': 1000, 'GWh/y': 3600 } },
    energy_rate:      { canonical: 'MJ/h',       units: { 'MJ/h': 1, 'GJ/h': 1000, 'kWh/h': 3.6, 'MWh/h': 3600, 'kW': 3.6, 'MW': 3600 } },
    energy_intensity: { canonical: 'GJ/t',       units: { 'GJ/t': 1, 'kWh/t': 0.0036, 'MJ/kg': 1, 'MWh/t': 3.6 } },
    power:            { canonical: 'MW',         units: { 'MW': 1, 'kW': 0.001, 'MWe': 1, 'GW': 1000 } },
    price_mass:       { canonical: '$/t',        units: { '$/t': 1, '$/kg': 1000, '$/g': 1e6, '£/t': 1, '£/kg': 1000, 'GBP/t': 1, 'GBP/kg': 1000, '$/dry t': 1 } },
    price_energy:     { canonical: '$/GJ',       units: { '$/GJ': 1, '$/MWh': 1 / 3.6, '$/kWh': 1000 / 3.6, '$/MJ': 1000, '£/kWh': 1000 / 3.6, '$M/TJ': 1000 } },
    price_volume:     { canonical: '$/m³',       units: { '$/m³': 1, '$/m3': 1, '$/L': 1000 } },
    currency:         { canonical: '$M',         units: { '$M': 1, '$': 1e-6, '$k': 1e-3, '£M': 1, 'M$': 1, 'MM$': 1, 'MGBP': 1, 'GBP': 1e-6, '£': 1e-6, 'kGBP': 1e-3 } },
    currency_year:    { canonical: '$M/y',       units: { '$M/y': 1, '$/y': 1e-6, '$k/y': 1e-3, '£M/y': 1, 'MGBP/y': 1, 'GBP/y': 1e-6 } },
    fraction:         { canonical: 'fraction',   units: { 'fraction': 1, '%': 0.01, 'w/w': 1 } },
    gwp_intensity:    { canonical: 'kg CO2e/kg', units: { 'kg CO2e/kg': 1, 't CO2e/t': 1, 'g CO2e/kg': 0.001, 'kg CO₂e/kg': 1 } },
    gwp_year:         { canonical: 'kt CO2e/y',  units: { 'kt CO2e/y': 1, 't CO2e/y': 0.001, 'kg CO2e/y': 1e-6 } },
    gwp_rate:         { canonical: 'kg CO2e/h',  units: { 'kg CO2e/h': 1 } },
    emission_factor:  { canonical: 'kg CO2e/unit', units: { 'kg CO2e/unit': 1, 'kg CO2e/kg': 1, 'kg CO2e/MJ': 1, 'kg CO2e/kWh': 1, 'kg CO2e/L': 1, 'kg CO2e/tkm': 1 } },
    concentration:    { canonical: 'g/L',        units: { 'g/L': 1, 'kg/m3': 1, 'kg/m³': 1, 'mg/L': 0.001 } },
    molarity:         { canonical: 'mM',         units: { 'mM': 1, 'M': 1000, 'uM': 0.001 } },
    molar_mass:       { canonical: 'kg/kmol',    units: { 'kg/kmol': 1, 'g/mol': 1, 'kg/mol': 1000 } },
    ratio:            { canonical: 'mol/mol',    units: { 'mol/mol': 1 } },
    days:             { canonical: 'd/y',        units: { 'd/y': 1 } },
    hours:            { canonical: 'h/y',        units: { 'h/y': 1 } },
    years:            { canonical: 'y',          units: { 'y': 1 } },
    temperature:      { canonical: '°C',         units: { '°C': 1, 'C': 1 } },
    heat_capacity:    { canonical: 'kJ/kg·K',    units: { 'kJ/kg·K': 1, 'kJ/kgK': 1 } },
    specific_energy:  { canonical: 'kJ/kg',      units: { 'kJ/kg': 1, 'MJ/kg': 1000, 'GJ/t': 1000 } },
    length:           { canonical: 'mm',         units: { 'mm': 1, 'm': 1000, 'um': 0.001, 'µm': 0.001 } },
    work_index:       { canonical: 'kWh/t',      units: { 'kWh/t': 1 } },
    jobs:             { canonical: 'jobs/kt',    units: { 'jobs/kt': 1, 'jobs/ktpa': 1 } },
    salary:           { canonical: '$/y',        units: { '$/y': 1, '$k/y': 1000, '£/y': 1, 'GBP/y': 1 } },
    count:            { canonical: '',           units: { '': 1 } }
  };

  function dimension(dim) {
    var d = DIMENSIONS[dim];
    if (!d) throw new Error('units: unknown dimension "' + dim + '"');
    return d;
  }

  function canonicalUnit(dim) { return dimension(dim).canonical; }

  function unitsFor(dim) { return Object.keys(dimension(dim).units); }

  function hasUnit(dim, unit) {
    return Object.prototype.hasOwnProperty.call(dimension(dim).units, unit);
  }

  function factor(dim, unit) {
    var d = dimension(dim);
    var u = unit === undefined || unit === null ? d.canonical : unit;
    if (!Object.prototype.hasOwnProperty.call(d.units, u)) {
      throw new Error('units: "' + u + '" is not a unit of ' + dim);
    }
    return d.units[u];
  }

  function toCanonical(value, dim, unit) {
    if (value === null || value === undefined) return value;
    return value * factor(dim, unit);
  }

  function fromCanonical(value, dim, unit) {
    if (value === null || value === undefined) return value;
    return value / factor(dim, unit);
  }

  function format(value, digits) {
    if (value === null || value === undefined || typeof value !== 'number' || !isFinite(value)) return '—';
    var a = Math.abs(value);
    var d = digits;
    if (d === undefined) {
      if (a === 0) d = 0;
      else if (a >= 1000) d = 0;
      else if (a >= 100) d = 1;
      else if (a >= 10) d = 2;
      else if (a >= 1) d = 3;
      else d = Math.min(6, 2 - Math.floor(Math.log10(a)));
    }
    return value.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function formatWithUnit(value, dim, unit) {
    var u = unit || canonicalUnit(dim);
    var v = fromCanonical(value, dim, u);
    var s = format(v);
    return u ? s + ' ' + u : s;
  }

  /* Parse a user entry: number, optional thousands separators, optional % suffix. */
  function parseEntry(text, dim, unit) {
    var raw = String(text === undefined || text === null ? '' : text).trim();
    if (!raw) return { ok: false, error: 'Enter a number.' };
    var pct = /%$/.test(raw);
    var cleaned = raw.replace(/%$/, '').replace(/,/g, '').replace(/\s+/g, '');
    var n = Number(cleaned);
    if (!isFinite(n)) return { ok: false, error: 'Not a number: "' + raw + '".' };
    var u = unit;
    var coerced = null;
    if (pct && dim === 'fraction' && unit !== '%') { u = '%'; coerced = 'Read as ' + n + '%.'; }
    return { ok: true, value: toCanonical(n, dim, u), coerced: coerced };
  }

  var api = {
    DIMENSIONS: DIMENSIONS,
    dimension: dimension,
    canonicalUnit: canonicalUnit,
    unitsFor: unitsFor,
    hasUnit: hasUnit,
    factor: factor,
    toCanonical: toCanonical,
    fromCanonical: fromCanonical,
    format: format,
    formatWithUnit: formatWithUnit,
    parseEntry: parseEntry
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (global.LCAG = global.LCAG || {}).units = api;
})(typeof window !== 'undefined' ? window : globalThis);
