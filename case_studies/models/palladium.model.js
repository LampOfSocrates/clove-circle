/* Palladium bio-recovery - simplified teaching model.
   Formulae mirror the published Pd bio-recovery LCA/TEA dashboard, so the numbers
   here track the full standalone tool. The diagram is a simplified flowsheet. */
(function (global) {
  'use strict';
  global.CC_MODELS = global.CC_MODELS || {};

  var M_PD = 0.10642;        // kg/mol
  var TRIS_MW = 0.15760;     // kg/mol
  var NACL_MW = 0.05844;     // kg/mol
  var H2O_PRICE = 1.5;       // $/m3
  var ELEC_PRICE = 0.12;     // $/kWh
  var ELEC_PER_M3 = 3.5;     // kWh/m3
  var CALC_KWH_PER_KG_PD = 800;
  var BIOCAT_KG_PER_KG_PD = 2.7;
  var LCA_PD_KG_PER_M3 = 0.031926;
  var PER_L_TO_PER_KG_PD = 1000 / LCA_PD_KG_PER_M3;
  var GWP_TRIS_PER_L = 1.17940474e-1;   // kg CO2e per litre of solution, Tris precursor
  var GWP_NACL_PER_L = 2.39029140e-3;
  var PEC = 7500000;         // sum of the purchased equipment list, $
  var FIXED = {
    acid_base: 75000, steam: 250000, cooling: 100000, waste: 150000, qaqc: 200000,
    labour: 3 * 4 * 60000 + 3 * 110000
  };

  var V = {};
  function input(id, o) { o.id = id; o.kind = 'input'; V[id] = o; }
  function computed(id, o) { o.id = id; o.kind = 'computed'; V[id] = o; }

  /* -- Stage 1: mass balance ------------------------------------------- */
  input('throughput', {
    label: 'Leachate throughput', stage: 'mass', dim: 'volume_flow', unit: 'm3/y',
    default: 10000, range: [1000, 100000], svgId: 'fs_feed', hit: 'stream-feed',
    source: 'Volume of Pd-bearing solution treated per year - spent catalyst leachate or e-waste liquor.'
  });
  input('feed_pd', {
    label: 'Pd concentration in feed', stage: 'mass', dim: 'molarity', unit: 'mM',
    default: 1.0, range: [0.05, 10], hit: 'stream-feed',
    source: 'Pd(II) in the incoming liquor. 1 mM is about 106 mg/L - typical of a dilute secondary stream.'
  });
  input('recovery', {
    label: 'Recovery efficiency', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.95, range: [0.5, 1.0], hit: 'block-bioreactor',
    source: 'Fraction of the incoming Pd reduced onto the biocatalyst. Shewanella systems report 90-99%.'
  });
  input('tris_mm', {
    label: 'Tris-HCl buffer', stage: 'mass', dim: 'molarity', unit: 'mM',
    default: 100, range: [0, 300], hit: 'block-buffer',
    source: 'Buffer strength needed to hold pH during bioreduction. The single largest environmental burden.'
  });
  input('nacl_mm', {
    label: 'NaCl', stage: 'mass', dim: 'molarity', unit: 'mM',
    default: 150, range: [0, 500], hit: 'block-buffer',
    source: 'Ionic strength adjustment for cell viability.'
  });
  input('biocat_cycles', {
    label: 'Biocatalyst reuse cycles', stage: 'mass', dim: 'count', unit: '',
    default: 10, range: [1, 50], hit: 'block-bioreactor',
    source: 'How many batches one biomass charge survives before replacement.'
  });

  computed('pd_in', {
    label: 'Pd entering', stage: 'mass', dim: 'mass_year', unit: 'kg/y',
    svgId: 'fs_pdin',
    deps: ['throughput', 'feed_pd'], expr: 'throughput × 1000 × (feed_pd ÷ 1000) × 0.10642',
    fn: function (v) { return v.throughput * 1000 * (v.feed_pd / 1000) * M_PD; }
  });
  computed('pd_recovered', {
    label: 'Pd recovered', stage: 'mass', dim: 'mass_year', unit: 'kg/y',
    svgId: 'fs_pd', hit: 'stream-pd',
    deps: ['pd_in', 'recovery'], expr: 'pd_in × recovery',
    fn: function (v) { return v.pd_in * v.recovery; }
  });
  computed('pd_lost', {
    label: 'Pd lost to raffinate', stage: 'mass', dim: 'mass_year', unit: 'kg/y',
    svgId: 'fs_pdlost', hit: 'stream-pdlost',
    deps: ['pd_in', 'recovery'], expr: 'pd_in × (1 − recovery)',
    fn: function (v) { return v.pd_in * (1 - v.recovery); }
  });
  computed('tris_t', {
    label: 'Tris-HCl consumed', stage: 'mass', dim: 'mass_year', unit: 't/y',
    svgId: 'fs_tris', hit: 'stream-tris',
    deps: ['throughput', 'tris_mm'], expr: 'throughput × (tris_mm ÷ 1000 × 0.15760 × 1000) ÷ 1000',
    fn: function (v) { return v.throughput * (v.tris_mm / 1000 * TRIS_MW * 1000) / 1000; }
  });
  computed('nacl_t', {
    label: 'NaCl consumed', stage: 'mass', dim: 'mass_year', unit: 't/y',
    svgId: 'fs_nacl', hit: 'stream-nacl',
    deps: ['throughput', 'nacl_mm'], expr: 'throughput × (nacl_mm ÷ 1000 × 0.05844 × 1000) ÷ 1000',
    fn: function (v) { return v.throughput * (v.nacl_mm / 1000 * NACL_MW * 1000) / 1000; }
  });
  computed('biocat_kg', {
    label: 'Biocatalyst make-up', stage: 'mass', dim: 'mass_year', unit: 'kg/y',
    svgId: 'fs_biocat', hit: 'stream-biocat',
    deps: ['pd_recovered', 'biocat_cycles'], expr: '2.7 × pd_recovered ÷ reuse cycles',
    fn: function (v) { return BIOCAT_KG_PER_KG_PD * v.pd_recovered / v.biocat_cycles; }
  });

  /* -- Stage 2: inventory, per 1 kg Pd ---------------------------------- */
  computed('tris_per_kg', {
    label: 'Tris-HCl per kg Pd', stage: 'lci', dim: 'mass_intensity', unit: 'kg/kg',
    deps: ['tris_t', 'pd_recovered'], expr: 'tris_t × 1000 ÷ pd_recovered',
    fn: function (v) { return v.tris_t * 1000 / v.pd_recovered; }
  });
  computed('nacl_per_kg', {
    label: 'NaCl per kg Pd', stage: 'lci', dim: 'mass_intensity', unit: 'kg/kg',
    deps: ['nacl_t', 'pd_recovered'], expr: 'nacl_t × 1000 ÷ pd_recovered',
    fn: function (v) { return v.nacl_t * 1000 / v.pd_recovered; }
  });
  computed('water_per_kg', {
    label: 'Process water per kg Pd', stage: 'lci', dim: 'volume_intensity', unit: 'm3/kg',
    deps: ['throughput', 'pd_recovered'], expr: 'throughput ÷ pd_recovered',
    fn: function (v) { return v.throughput / v.pd_recovered; }
  });
  computed('elec_kwh', {
    label: 'Electricity consumed', stage: 'lci', dim: 'count', unit: '',
    deps: ['throughput', 'pd_recovered'], expr: 'throughput × 3.5 + 800 × pd_recovered   (kWh/y)',
    fn: function (v) { return v.throughput * ELEC_PER_M3 + CALC_KWH_PER_KG_PD * v.pd_recovered; }
  });
  computed('elec_per_kg', {
    label: 'Electricity per kg Pd', stage: 'lci', dim: 'energy_per_mass', unit: 'kWh/kg',
    deps: ['elec_kwh', 'pd_recovered'], expr: 'elec_kwh ÷ pd_recovered',
    fn: function (v) { return v.elec_kwh / v.pd_recovered; }
  });
  computed('biocat_per_kg', {
    label: 'Biocatalyst per kg Pd', stage: 'lci', dim: 'mass_intensity', unit: 'kg/kg',
    deps: ['biocat_kg', 'pd_recovered'], expr: 'biocat_kg ÷ pd_recovered',
    fn: function (v) { return v.biocat_kg / v.pd_recovered; }
  });

  /* -- Stage 3: impact assessment --------------------------------------- */
  input('gwp_elec', {
    label: 'Grid electricity GWP', stage: 'lcia', dim: 'count', unit: '',
    default: 0.207, range: [0.0, 0.9],
    source: 'kg CO2e per kWh. UK grid average is about 0.21.'
  });
  computed('gwp_buffer', {
    label: 'GWP from buffer precursors', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['tris_mm', 'nacl_mm'],
    expr: '(0.1179 × tris_mm/100 + 0.00239 × nacl_mm/150) × 31,322 L per kg Pd',
    fn: function (v) {
      return (GWP_TRIS_PER_L * (v.tris_mm / 100) + GWP_NACL_PER_L * (v.nacl_mm / 150)) * PER_L_TO_PER_KG_PD;
    }
  });
  computed('gwp_electricity', {
    label: 'GWP from electricity', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['elec_per_kg', 'gwp_elec'], expr: 'elec_per_kg × gwp_elec',
    fn: function (v) { return v.elec_per_kg * v.gwp_elec; }
  });
  computed('gwp_per_kg', {
    label: 'Total GWP per kg Pd', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['gwp_buffer', 'gwp_electricity'], expr: 'gwp_buffer + gwp_electricity',
    fn: function (v) { return v.gwp_buffer + v.gwp_electricity; }
  });

  /* -- Stage 4: capital cost -------------------------------------------- */
  input('lang', {
    label: 'Lang factor', stage: 'capex', dim: 'count', unit: '',
    default: 4.0, range: [2, 6],
    source: 'Total installed cost divided by purchased equipment cost. 3.6-4.2 for solid-fluid plants.'
  });
  computed('pec', {
    label: 'Purchased equipment cost', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['lang'], expr: 'sum of the equipment list (fixed at this design)',
    fn: function () { return PEC / 1e6; }
  });
  computed('tic', {
    label: 'Total installed cost', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['pec', 'lang'], expr: 'Lang factor × purchased equipment cost',
    fn: function (v) { return v.lang * v.pec; }
  });
  computed('working_capital', {
    label: 'Working capital', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['tic'], expr: '0.10 × total installed cost',
    fn: function (v) { return 0.1 * v.tic; }
  });
  computed('tci', {
    label: 'Total capital investment', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['tic', 'working_capital'], expr: 'installed cost + working capital',
    fn: function (v) { return v.tic + v.working_capital; }
  });

  /* -- Stage 5: operating cost and revenue ------------------------------ */
  input('tris_price', {
    label: 'Tris-HCl price', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 10000, range: [1000, 40000],
    source: '$/kg of Tris-HCl. Bulk buffer chemistry is expensive at this scale.'
  });
  input('nacl_price', {
    label: 'NaCl price', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 200, range: [50, 1000], source: '$/kg of sodium chloride, bulk.'
  });
  input('biocat_price', {
    label: 'Biocatalyst production cost', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 5000000, range: [500000, 20000000],
    source: '$/kg dry cell mass, covering fermentation, harvest and purification.'
  });
  input('pd_price', {
    label: 'Pd market price', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 48000000, range: [10000000, 120000000],
    source: '$/kg of palladium. Historically volatile - it has traded from $15k to $95k/kg.'
  });

  computed('cost_tris', {
    label: 'Tris-HCl cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['tris_t', 'tris_price'], expr: 'tris_t × 1000 × price per kg',
    fn: function (v) { return v.tris_t * 1000 * (v.tris_price / 1000) / 1e6; }
  });
  computed('cost_nacl', {
    label: 'NaCl cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['nacl_t', 'nacl_price'], expr: 'nacl_t × 1000 × price per kg',
    fn: function (v) { return v.nacl_t * 1000 * (v.nacl_price / 1000) / 1e6; }
  });
  computed('cost_biocat', {
    label: 'Biocatalyst make-up cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['biocat_kg', 'biocat_price'], expr: 'biocat_kg × price per kg',
    fn: function (v) { return v.biocat_kg * (v.biocat_price / 1000) / 1e6; }
  });
  computed('cost_utilities', {
    label: 'Water, electricity, steam, cooling', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['throughput', 'elec_kwh'],
    expr: 'water + electricity + fixed steam and cooling',
    fn: function (v) {
      return (v.throughput * H2O_PRICE + v.elec_kwh * ELEC_PRICE +
        FIXED.steam + FIXED.cooling) / 1e6;
    }
  });
  computed('cost_fixed', {
    label: 'Labour, maintenance, insurance, overheads', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['tic'],
    expr: 'labour × 1.5 + 0.04 × TIC + 0.015 × TIC + fixed acids, waste and QA',
    fn: function (v) {
      return (FIXED.labour * 1.5 + FIXED.acid_base + FIXED.waste + FIXED.qaqc) / 1e6 +
        0.055 * v.tic;
    }
  });
  computed('opex_total', {
    label: 'Total operating cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['cost_tris', 'cost_nacl', 'cost_biocat', 'cost_utilities', 'cost_fixed'],
    expr: 'sum of every operating line item',
    fn: function (v) {
      return v.cost_tris + v.cost_nacl + v.cost_biocat + v.cost_utilities + v.cost_fixed;
    }
  });
  computed('revenue', {
    label: 'Pd revenue', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['pd_recovered', 'pd_price'], expr: 'pd_recovered × Pd price per kg',
    fn: function (v) { return v.pd_recovered * (v.pd_price / 1000) / 1e6; }
  });

  /* -- Stage 6: profitability ------------------------------------------- */
  input('discount', {
    label: 'Discount rate', stage: 'dcf', dim: 'fraction', unit: '%',
    default: 0.1, range: [0.02, 0.3], source: 'Cost of capital used to discount future cash flows.'
  });
  input('life', {
    label: 'Project life', stage: 'dcf', dim: 'years', unit: 'y',
    default: 15, range: [3, 30], source: 'Operating years over which the investment is judged.'
  });
  input('tax', {
    label: 'Tax rate', stage: 'dcf', dim: 'fraction', unit: '%',
    default: 0.25, range: [0, 0.5], source: 'Corporation tax on operating profit.'
  });
  input('dep', {
    label: 'Depreciation life', stage: 'dcf', dim: 'years', unit: 'y',
    default: 10, range: [3, 20], source: 'Straight-line depreciation period for the installed plant.'
  });

  computed('depreciation', {
    label: 'Annual depreciation', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['tic', 'dep'], expr: 'TIC ÷ depreciation life',
    fn: function (v) { return v.tic / v.dep; }
  });
  computed('ebit', {
    label: 'Operating profit (EBIT)', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['revenue', 'opex_total', 'depreciation'],
    expr: 'revenue − opex − depreciation',
    fn: function (v) { return v.revenue - v.opex_total - v.depreciation; }
  });
  computed('cash_flow', {
    label: 'Annual cash flow', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['ebit', 'tax', 'depreciation'],
    expr: 'EBIT − tax on positive EBIT + depreciation added back',
    fn: function (v) {
      var taxPaid = Math.max(0, v.ebit) * v.tax;
      return v.ebit - taxPaid + v.depreciation;
    }
  });
  computed('npv', {
    label: 'NPV', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['cash_flow', 'discount', 'life', 'tci', 'working_capital'],
    expr: '−TCI + Σ CF ÷ (1 + r)ᵗ, with working capital recovered in the final year',
    fn: function (v) {
      var T = Math.round(v.life), npv = -v.tci;
      for (var t = 1; t <= T; t++) {
        var cf = v.cash_flow + (t === T ? v.working_capital : 0);
        npv += cf / Math.pow(1 + v.discount, t);
      }
      return npv;
    }
  });
  computed('msp', {
    label: 'Minimum selling price', stage: 'dcf', dim: 'price_mass', unit: '$/kg',
    deps: ['tci', 'discount', 'life', 'depreciation', 'tax', 'opex_total', 'pd_recovered'],
    expr: 'price at which NPV = 0:  ((annualised TCI − D) ÷ (1 − tax) + opex + D) ÷ pd_recovered',
    fn: function (v) {
      var T = Math.round(v.life);
      var annuity = (1 - Math.pow(1 + v.discount, -T)) / v.discount;
      var annualised = v.tci / annuity;
      var reqRev = ((annualised - v.depreciation) / (1 - v.tax)) + v.opex_total + v.depreciation;
      return reqRev * 1e6 / v.pd_recovered * 1000;
    }
  });
  computed('payback', {
    label: 'Simple payback', stage: 'dcf', dim: 'years', unit: 'y',
    deps: ['tci', 'cash_flow'], expr: 'TCI ÷ annual cash flow',
    fn: function (v) { return v.cash_flow > 0 ? v.tci / v.cash_flow : NaN; }
  });

  global.CC_MODELS.palladium = {
    id: 'palladium',
    title: 'Palladium bio-recovery',
    subtitle: 'Recovering a critical metal from dilute solution using a bacterial biocatalyst.',
    functionalUnit: '1 kg of palladium recovered',
    boundary: 'Cradle-to-gate. Starts at the Pd-bearing leachate arriving on site, ends at refined Pd. Excludes production of the waste stream itself and any downstream use.',
    fullTool: '../../standalone/palladium-biorecovery-lca-tea.html',
    vars: V,
    stages: [
      { id: 'mass', title: 'Mass balance', verb: 'Do mass balance' },
      { id: 'lci', title: 'Life cycle inventory', verb: 'Build inventory' },
      { id: 'lcia', title: 'Impact assessment', verb: 'Run impact assessment' },
      { id: 'capex', title: 'Capital cost', verb: 'Estimate CAPEX' },
      { id: 'opex', title: 'Operating cost & revenue', verb: 'Cost the operation' },
      { id: 'dcf', title: 'Profitability', verb: 'Run cash flow' }
    ],
    stepCopy: {
      scope: {
        tryIt: 'Note that the functional unit is 1 kg of Pd recovered, not 1 m³ of solution ' +
          'treated. That single choice is why a dilute feed looks so bad here: the same buffer ' +
          'burden gets divided by far less metal.'
      },
      mass: {
        tryIt: 'Click the feed stream and drop the Pd concentration from 1.0 to 0.3 mM, then ' +
          're-run. The Pd recovered falls by two thirds while the buffer and water flows do not ' +
          'move at all — the plant does the same work for a third of the product.'
      },
      lci: {
        tryIt: 'Look at Tris-HCl per kg Pd. It is measured in tonnes of buffer per kilogram of ' +
          'metal. Now halve the Tris concentration to 50 mM and re-run to see how directly the ' +
          'inventory follows it.'
      },
      lcia: {
        tryIt: 'The buffer dominates. Set Tris to 25 mM and re-run — if the chemistry tolerated ' +
          'it, that one change would do more for the carbon footprint than switching to ' +
          'renewable electricity.'
      },
      capex: {
        tryIt: 'The equipment list is fixed at this design, so only the Lang factor moves total ' +
          'capital. Try 3.0 against 4.0 and see the spread a single estimating convention creates.'
      },
      opex: {
        tryIt: 'Compare the Tris-HCl cost against every other line. Then raise the biocatalyst ' +
          'reuse cycles from 10 to 30 in the mass balance step and re-run everything — reuse is ' +
          'the cheapest lever available.'
      },
      dcf: {
        tryIt: 'Set the Pd price to $15,000/kg, near its historic low, and re-run. A process ' +
          'that depends on a volatile commodity price is a different investment proposition ' +
          'from one that does not.'
      },
      interpret: {
        tryIt: 'Feed concentration, Tris molarity and Pd price dominate everything else here. ' +
          'Two are process design choices and one is entirely outside your control.'
      }
    },
    closure: {
      mass: {
        label: 'Palladium balance closure',
        unit: 'kg/y',
        in: ['pd_in'],
        out: ['pd_recovered', 'pd_lost'],
        tolerance: 0.001
      }
    },
    kpis: ['pd_recovered', 'gwp_per_kg', 'tci', 'msp', 'npv', 'payback']
  };
})(typeof window !== 'undefined' ? window : globalThis);
