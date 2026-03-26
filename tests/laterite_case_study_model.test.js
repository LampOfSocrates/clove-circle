const assert = require('node:assert/strict');

const lateriteModule = require('../case_studies/laterite-case-study.js');

assert.equal(
  typeof lateriteModule.calculateLateriteModel,
  'function',
  'laterite-case-study.js should export calculateLateriteModel for regression testing'
);

const result = lateriteModule.calculateLateriteModel({
  feed: 360,
  moisture: 25,
  solids: 50,
  na2so4: 60,
  feso4b: 3,
  feso4m: 25,
  acc: 0.1,
  irr: 0.1,
  reagentPrice: 0.26,
  electricityPrice: 0.0644,
  heatPrice: 0.03,
  metalPrice: 18.5,
  lateritePrice: 75,
  labourCost: 85000,
});

function approx(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`
  );
}

approx(result.mass.nclWet, 480, 1e-9, 'ncl wet feed');
approx(result.mass.bcl, 340, 1e-9, 'bulk coarse laterite');
approx(result.mass.bfl, 20, 1e-9, 'bulk fine laterite');
approx(result.mass.mnox, 2.4, 1e-9, 'mn oxides concentrate');

approx(result.gwp.qOven, 383.95384615384614, 1e-9, 'oven duty');
approx(result.gwp.electricityAllocated, 2.0658678908343786, 1e-9, 'allocated electricity');
approx(result.gwp.bioleachVolumeMn, 36, 1e-9, 'mn bioleach volume');
approx(result.gwp.feso4MnKg, 0.9, 1e-9, 'mn FeSO4 use');
approx(result.gwp.totalPerKgNcl, 0.001500055081388002, 1e-12, 'gwp per kg ncl');
approx(result.gwp.allocatedMn, 0.8958654826077103, 1e-12, 'allocated gwp mn');
approx(result.gwp.allocatedNi, 7.3624142010258025, 1e-12, 'allocated gwp ni');
approx(result.gwp.allocatedCo, 28.670777549464873, 1e-12, 'allocated gwp co');

approx(result.tea.reagentsTpa, 137.80799999999996, 1e-9, 'reagents tpa');
approx(result.tea.totalCapitalInvestment, 3.447898023108217, 1e-12, 'tci');
approx(result.tea.totalOpex, 1.2501447511743244, 1e-12, 'total opex');
approx(result.tea.totalCost, 1.5949345534851462, 1e-12, 'total cost');
approx(result.tea.productValue, 2.884224, 1e-12, 'product value');
approx(result.tea.netMargin, 1.2892894465148539, 1e-12, 'net margin');
approx(result.tea.npv10, 4.474227499679148, 1e-12, '10 year npv');

console.log('laterite model regression passed');
