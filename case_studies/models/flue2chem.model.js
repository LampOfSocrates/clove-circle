/* Flue2Chem - simplified teaching model.
   Formulae mirror the published Flue2Chem TEA/LCA worksheet, so the numbers here
   track the full standalone dashboard. The diagram is a simplified flowsheet,
   not the full process. */
(function (global) {
  'use strict';
  global.CC_MODELS = global.CC_MODELS || {};

  var V = {};
  function input(id, o) { o.id = id; o.kind = 'input'; V[id] = o; }
  function computed(id, o) { o.id = id; o.kind = 'computed'; V[id] = o; }

  /* -- Stage 1: mass balance ------------------------------------------- */
  input('flue_in', {
    label: 'Flue gas throughput', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    default: 36000, range: [5000, 80000], svgId: 'fs_flue', hit: 'stream-flue',
    source: 'Stack flow for a large industrial CO2 point source (Flue2Chem basis case).'
  });
  input('co2_frac', {
    label: 'CO₂ in flue gas', stage: 'mass', dim: 'fraction', unit: 'fraction',
    default: 0.22, range: [0.03, 0.5], hit: 'block-capture',
    source: 'Mass fraction. Post-combustion flue gas is typically 4-15%; 22% reflects an enriched source.'
  });
  input('co2_rec', {
    label: 'CO₂ recovered by capture', stage: 'mass', dim: 'fraction', unit: 'fraction',
    default: 0.85, range: [0.5, 0.99], hit: 'block-capture',
    source: 'Capture rate of the absorber. 85-95% is the usual amine-scrubbing design range.'
  });
  input('co2_conc', {
    label: 'CO₂ purity after capture', stage: 'mass', dim: 'fraction', unit: 'fraction',
    default: 0.9, range: [0.5, 0.999], hit: 'block-capture',
    source: 'Mass fraction CO2 in the captured gas leaving the capture unit.'
  });
  input('h2_co2_ratio', {
    label: 'H₂ : CO₂ molar ratio', stage: 'mass', dim: 'ratio', unit: 'mol/mol',
    default: 3, range: [1, 6], hit: 'block-ft',
    source: 'Stoichiometric requirement of the synthesis step; 3:1 is the RWGS/FT design ratio.'
  });
  input('surf_yield', {
    label: 'Surfactant yield', stage: 'mass', dim: 'fraction', unit: 'fraction',
    default: 0.14, range: [0.02, 0.4], hit: 'block-ft',
    source: 'kg surfactant per kg CO2 in the raw flue gas - the overall carbon-to-product yield.'
  });
  input('opdays', {
    label: 'Operating days per year', stage: 'mass', dim: 'days', unit: 'd/y',
    default: 365, range: [300, 365],
    source: 'On-stream time. 330 d/y is a common turnaround allowance; 365 assumes continuous operation.'
  });

  computed('co2_in_flue', {
    label: 'CO₂ in flue gas', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['flue_in', 'co2_frac'], expr: 'flue_in × co2_frac',
    fn: function (v) { return v.flue_in * v.co2_frac; }
  });
  computed('co2_recovered', {
    label: 'CO₂ recovered', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['co2_in_flue', 'co2_rec'], expr: 'co2_in_flue × co2_rec',
    fn: function (v) { return v.co2_in_flue * v.co2_rec; }
  });
  computed('surfactant', {
    label: 'Surfactant product', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_surf', hit: 'stream-surf',
    deps: ['surf_yield', 'co2_frac', 'flue_in'], expr: 'surf_yield × co2_frac × flue_in',
    fn: function (v) { return v.surf_yield * v.co2_frac * v.flue_in; }
  });
  computed('eo', {
    label: 'Ethylene oxide', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_eo', hit: 'stream-eo',
    deps: ['surfactant'], expr: '0.59 × surfactant',
    fn: function (v) { return 0.59 * v.surfactant; }
  });
  computed('ethanol', {
    label: 'Ethanol', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_eth', hit: 'stream-eth',
    deps: ['eo'], expr: 'eo × 46/44   (molecular weight ratio)',
    fn: function (v) { return v.eo * 46 / 44; }
  });
  computed('h2_eth', {
    label: 'H₂ to ethanol plant', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['ethanol'], expr: '0.947 × ethanol',
    fn: function (v) { return 0.947 * v.ethanol; }
  });
  computed('co2_eth', {
    label: 'CO₂ to ethanol plant', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['h2_eth', 'h2_co2_ratio'],
    expr: 'h2_eth ÷ (2r/(2r+44)) × 44/(2r+44),  r = H2:CO2 ratio',
    fn: function (v) {
      var d = v.h2_co2_ratio * 2 + 44;
      return v.h2_eth / (v.h2_co2_ratio * 2 / d) * 44 / d;
    }
  });
  computed('gas_eth', {
    label: 'CO₂-rich gas to ethanol plant', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_gaseth', hit: 'stream-gaseth',
    deps: ['co2_eth', 'co2_conc'], expr: 'co2_eth ÷ co2_conc',
    fn: function (v) { return v.co2_eth / v.co2_conc; }
  });
  computed('co2_ft', {
    label: 'CO₂ to FT synthesis', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['co2_recovered', 'co2_eth'], expr: 'co2_recovered − co2_eth',
    fn: function (v) { return v.co2_recovered - v.co2_eth; }
  });
  computed('h2_ft', {
    label: 'H₂ to FT synthesis', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['co2_ft', 'h2_co2_ratio'], expr: 'co2_ft ÷ 44 × 2r',
    fn: function (v) { return v.co2_ft / 44 * v.h2_co2_ratio * 2; }
  });
  computed('h2_total', {
    label: 'H₂ from electrolysis', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_h2', hit: 'stream-h2',
    deps: ['h2_ft', 'h2_eth'], expr: 'h2_ft + h2_eth',
    fn: function (v) { return v.h2_ft + v.h2_eth; }
  });
  computed('gas_ft', {
    label: 'CO₂-rich gas to FT', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_gasft', hit: 'stream-gasft',
    deps: ['co2_ft', 'co2_conc'], expr: 'co2_ft ÷ co2_conc',
    fn: function (v) { return v.co2_ft / v.co2_conc; }
  });
  computed('alcohol', {
    label: 'Alcohol intermediate', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_alc', hit: 'stream-alc',
    deps: ['surfactant'], expr: '0.41 × surfactant',
    fn: function (v) { return 0.41 * v.surfactant; }
  });
  computed('ft_coprod', {
    label: 'FT co-product', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['surfactant'], expr: '0.10 × surfactant',
    fn: function (v) { return 0.1 * v.surfactant; }
  });
  computed('ft_flue', {
    label: 'FT off-gas', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['gas_ft', 'h2_ft', 'alcohol', 'ft_coprod'],
    expr: 'gas_ft + h2_ft − alcohol − ft_coprod',
    fn: function (v) { return v.gas_ft + v.h2_ft - v.alcohol - v.ft_coprod; }
  });
  computed('eth_rich', {
    label: 'Ethanol-rich stream', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['ethanol', 'eo'], expr: 'ethanol + 0.05 × eo',
    fn: function (v) { return v.ethanol + v.eo * 0.05; }
  });
  computed('eth_coprod', {
    label: 'Ethanol-plant co-product', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['gas_eth', 'h2_eth', 'eth_rich'], expr: '0.445 × (gas_eth + h2_eth − eth_rich)',
    fn: function (v) { return (v.gas_eth + v.h2_eth - v.eth_rich) * 0.445; }
  });
  computed('ww_eth', {
    label: 'Ethanol-plant wastewater', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['gas_eth', 'h2_eth', 'eth_rich'], expr: '0.555 × (gas_eth + h2_eth − eth_rich)',
    fn: function (v) { return (v.gas_eth + v.h2_eth - v.eth_rich) * 0.555; }
  });
  computed('eo_byprod', {
    label: 'EO-plant by-product', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    deps: ['ethanol', 'eo'], expr: 'ethanol − eo + 0.05 × eo',
    fn: function (v) { return v.ethanol - v.eo + v.eo * 0.05; }
  });
  computed('rem_flue', {
    label: 'Remaining flue gas', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_remflue', hit: 'stream-remflue',
    deps: ['flue_in', 'gas_ft', 'gas_eth'], expr: 'flue_in − gas_ft − gas_eth',
    fn: function (v) { return v.flue_in - v.gas_ft - v.gas_eth; }
  });
  /* Closing definition. The standalone dashboard shows this stream net of
     electrolytic H2; here the H2 mass is kept in the outputs so the balance
     closes and the closure check means something. */
  computed('exhaust', {
    label: 'Exhaust + water', stage: 'mass', dim: 'mass_flow', unit: 't/d',
    svgId: 'fs_exhaust', hit: 'stream-exhaust',
    deps: ['rem_flue', 'ft_flue', 'ww_eth'], expr: 'rem_flue + ft_flue + wastewater',
    fn: function (v) { return v.rem_flue + v.ft_flue + v.ww_eth; }
  });

  /* -- Stage 2: life cycle inventory ----------------------------------- */
  input('elec_cc', {
    label: 'Electricity for CO₂ capture', stage: 'lci', dim: 'energy_intensity', unit: 'GJ/t',
    default: 0.7, range: [0.2, 3],
    source: 'Per tonne of CO2 in the flue gas. Amine capture is typically 0.5-1.2 GJ/t as electricity.'
  });
  input('elec_h2', {
    label: 'Electricity for electrolytic H₂', stage: 'lci', dim: 'count', unit: '',
    default: 39.4, range: [30, 60],
    source: 'kWh per kg H2. 39.4 is near the thermodynamic limit for PEM; commercial units run 50-55.'
  });
  input('onsite', {
    label: 'Electricity generated on site', stage: 'lci', dim: 'fraction', unit: '%',
    default: 0.1, range: [0, 0.5],
    source: 'Fraction of demand met on site rather than imported from the grid.'
  });

  computed('surf_ktpa', {
    label: 'Surfactant output (ktpa)', stage: 'lci', dim: 'count', unit: '',
    deps: ['surfactant', 'opdays'], expr: 'surfactant × opdays ÷ 1000',
    fn: function (v) { return v.surfactant * v.opdays / 1000; }
  });
  computed('h2_ktpa', {
    label: 'H₂ requirement (ktpa)', stage: 'lci', dim: 'count', unit: '',
    deps: ['h2_total', 'opdays'], expr: 'h2_total × opdays ÷ 1000',
    fn: function (v) { return v.h2_total * v.opdays / 1000; }
  });
  computed('coprod_ktpa', {
    label: 'Co-products (ktpa)', stage: 'lci', dim: 'count', unit: '',
    deps: ['ft_coprod', 'eth_coprod', 'eo_byprod', 'opdays'],
    expr: '(ft_coprod + eth_coprod + eo_byprod) × opdays ÷ 1000',
    fn: function (v) { return (v.ft_coprod + v.eth_coprod + v.eo_byprod) * v.opdays / 1000; }
  });
  computed('elec_total', {
    label: 'Electricity consumed (MWh/y)', stage: 'lci', dim: 'count', unit: '',
    deps: ['elec_h2', 'h2_ktpa', 'elec_cc', 'co2_frac', 'flue_in', 'opdays'],
    expr: '(elec_h2 × 10⁶ × h2_ktpa + (elec_cc × co2_frac × 1000 ÷ 3.6) × flue_in × opdays) ÷ 1000',
    fn: function (v) {
      return (v.elec_h2 * 1000 * v.h2_ktpa * 1000 +
        (v.elec_cc * v.co2_frac * 1000 / 3.6) * v.flue_in * v.opdays) / 1000;
    }
  });
  computed('elec_onsite', {
    label: 'Electricity generated on site (MWh/y)', stage: 'lci', dim: 'count', unit: '',
    deps: ['onsite', 'elec_total'], expr: 'onsite × elec_total',
    fn: function (v) { return v.onsite * v.elec_total; }
  });
  computed('elec_net', {
    label: 'Net electricity imported (MWh/y)', stage: 'lci', dim: 'count', unit: '',
    deps: ['elec_total', 'elec_onsite'], expr: 'elec_total − elec_onsite',
    fn: function (v) { return v.elec_total - v.elec_onsite; }
  });
  computed('elec_per_kg', {
    label: 'Electricity per kg surfactant (kWh/kg)', stage: 'lci', dim: 'count', unit: '',
    deps: ['elec_net', 'surf_ktpa'], expr: 'elec_net × 1000 ÷ (surf_ktpa × 10⁶)',
    fn: function (v) { return v.elec_net * 1000 / (v.surf_ktpa * 1e6); }
  });

  /* -- Stage 3: impact assessment -------------------------------------- */
  input('gwp_elec', {
    label: 'Grid electricity GWP', stage: 'lcia', dim: 'count', unit: '',
    default: 0.207, range: [0.0, 0.9],
    source: 'kg CO2e per kWh. UK grid average is about 0.21; a renewable contract approaches 0.02.'
  });
  computed('gwp_electricity', {
    label: 'GWP from electricity (kt CO₂e/y)', stage: 'lcia', dim: 'count', unit: '',
    deps: ['elec_net', 'gwp_elec'], expr: 'elec_net × 1000 × gwp_elec ÷ 10⁶',
    fn: function (v) { return v.elec_net * 1000 * v.gwp_elec / 1e6; }
  });
  computed('co2_utilised', {
    label: 'CO₂ taken out of the stack (kt/y)', stage: 'lcia', dim: 'count', unit: '',
    deps: ['co2_recovered', 'opdays'], expr: 'co2_recovered × opdays ÷ 1000',
    fn: function (v) { return v.co2_recovered * v.opdays / 1000; }
  });
  computed('gwp_net', {
    label: 'Net GWP (kt CO₂e/y)', stage: 'lcia', dim: 'count', unit: '',
    deps: ['gwp_electricity', 'co2_utilised'], expr: 'gwp_electricity − co2_utilised',
    fn: function (v) { return v.gwp_electricity - v.co2_utilised; }
  });
  computed('gwp_per_kg', {
    label: 'GWP per kg surfactant', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['gwp_net', 'surf_ktpa'], expr: 'gwp_net ÷ surf_ktpa',
    fn: function (v) { return v.gwp_net / v.surf_ktpa; }
  });

  /* -- Stage 4: capital cost ------------------------------------------- */
  input('lang', {
    label: 'Lang factor', stage: 'capex', dim: 'count', unit: '',
    default: 5.03, range: [3, 6],
    source: 'Total capital divided by delivered equipment cost. 4.7-5.0 for fluid-processing plants (Peters & Timmerhaus).'
  });

  function sixTenths(base, size, baseSize, n, cepciBase, cepciNow) {
    return base * Math.pow(size / baseSize, n) * cepciNow / cepciBase;
  }

  computed('equip_cost', {
    label: 'Delivered equipment cost', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['elec_onsite', 'opdays', 'flue_in', 'co2_frac', 'surfactant', 'eo',
      'eo_byprod', 'gas_ft', 'h2_ft'],
    expr: 'Σ over units of  base × (size ÷ base size)ⁿ × (CEPCI_now ÷ CEPCI_base)',
    fn: function (v) {
      var gasTreat = sixTenths(1.6, v.elec_onsite / v.opdays / 24, 1, 0.7, 800, 800);
      var capture = sixTenths(28 * 0.77, v.flue_in * v.co2_frac / 24 * 1000 / 44, 9600, 0.7, 394.3, 800);
      var surfSyn = sixTenths(3.5 * 0.77, v.surfactant / 24, 87.5, 0.72, 402, 800);
      var eoPlant = sixTenths(3.5 * 0.77, (v.eo + v.eo_byprod) / 24, 87.5, 0.72, 402, 800);
      var ftSyn = sixTenths(25.3 * 0.77, (v.gas_ft + v.h2_ft) / 24 * 23 * 1000 / 3600, 100, 0.72, 394.3, 800);
      var ftUpg = sixTenths(233 * 0.77, (v.surfactant + 0.16 * v.flue_in * v.co2_frac * 0.77) / 24, 286, 0.7, 394.3, 800);
      var alcSyn = sixTenths(3.5 * 0.77, 0.56 * v.surfactant / 24, 87.5, 0.72, 394.3, 800);
      var ferm = sixTenths(0.67 * 0.77, 0.56 * v.surfactant / 24, 1.04, 0.8, 402, 800);
      var purif = sixTenths(2.92 * 0.77, 0.56 * v.surfactant / 24, 18.466, 0.8, 402, 800);
      return gasTreat + capture + surfSyn + eoPlant + ftSyn + ftUpg + alcSyn + ferm + purif;
    }
  });
  computed('tci', {
    label: 'Total capital investment', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['equip_cost', 'lang'], expr: 'equip_cost × Lang factor',
    fn: function (v) { return v.equip_cost * v.lang; }
  });

  /* -- Stage 5: operating cost and revenue ----------------------------- */
  input('acc', {
    label: 'Annual capital charge', stage: 'opex', dim: 'fraction', unit: 'fraction',
    default: 0.1, range: [0.05, 0.25],
    source: 'Fraction of total capital charged to each operating year.'
  });
  input('elcost', {
    label: 'Electricity cost ($/kWh)', stage: 'opex', dim: 'count', unit: '',
    default: 0.25, range: [0.02, 0.6], source: 'Industrial tariff.'
  });
  input('sprice', {
    label: 'Surfactant price', stage: 'opex', dim: 'price_mass', unit: '$/t',
    default: 7500, range: [2000, 15000],
    source: 'Market price of the fossil-derived surfactant this product displaces.'
  });
  input('cprice', {
    label: 'Co-product price', stage: 'opex', dim: 'price_mass', unit: '$/t',
    default: 1500, range: [0, 5000],
    source: 'Blended price for FT, ethanol-plant and EO-plant co-products.'
  });
  input('flgp', {
    label: 'Flue gas price', stage: 'opex', dim: 'price_mass', unit: '$/t',
    default: 0, range: [0, 50],
    source: 'Paid to the emitter for the flue gas. Zero if taken as a free waste stream.'
  });
  input('indopex', {
    label: 'Indirect opex factor', stage: 'opex', dim: 'fraction', unit: 'fraction',
    default: 0.06, range: [0, 0.2],
    source: 'Maintenance, insurance and overheads as a fraction of annualised equipment cost.'
  });
  input('laboh', {
    label: 'Labour overhead', stage: 'opex', dim: 'count', unit: '',
    default: 1.9, range: [1, 3],
    source: 'Multiplier on base salary covering employment on-costs and supervision.'
  });
  input('salary', {
    label: 'Worker salary ($/y)', stage: 'opex', dim: 'count', unit: '',
    default: 50000, range: [20000, 120000], source: 'Per worker per year.'
  });
  input('jobs', {
    label: 'Jobs per ktpa surfactant', stage: 'opex', dim: 'count', unit: '',
    default: 1, range: [0.2, 5], source: 'Staffing intensity of the plant.'
  });
  input('misc', {
    label: 'Miscellaneous opex factor', stage: 'opex', dim: 'fraction', unit: 'fraction',
    default: 0.2, range: [0, 0.5],
    source: 'Contingency applied to the sum of variable and fixed operating costs.'
  });

  computed('capex_annual', {
    label: 'Annualised capital', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['tci', 'acc'], expr: 'tci × annual capital charge',
    fn: function (v) { return v.tci * v.acc; }
  });
  computed('opex_var', {
    label: 'Variable opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['elec_net', 'elcost'], expr: 'elec_net × electricity cost ÷ 1000',
    fn: function (v) { return v.elec_net * v.elcost / 1000; }
  });
  computed('opex_fix', {
    label: 'Fixed opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['indopex', 'equip_cost', 'acc', 'salary', 'laboh', 'jobs', 'surf_ktpa'],
    expr: 'indopex × equip_cost × acc + salary × overhead × jobs × surf_ktpa ÷ 10⁶',
    fn: function (v) {
      return v.indopex * v.equip_cost * v.acc + v.salary * v.laboh * v.jobs * v.surf_ktpa / 1e6;
    }
  });
  computed('opex_total', {
    label: 'Total opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['misc', 'opex_var', 'opex_fix'], expr: '(1 + misc) × (opex_var + opex_fix)',
    fn: function (v) { return (1 + v.misc) * (v.opex_var + v.opex_fix); }
  });
  computed('feed_cost', {
    label: 'Feedstock cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['flue_in', 'flgp', 'opdays'], expr: 'flue_in × flue gas price × opdays ÷ 10⁶',
    fn: function (v) { return v.flue_in * v.flgp * v.opdays / 1e6; }
  });
  computed('rev_surf', {
    label: 'Surfactant revenue', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['surf_ktpa', 'sprice'], expr: 'surf_ktpa × surfactant price ÷ 1000',
    fn: function (v) { return v.surf_ktpa * v.sprice / 1000; }
  });
  computed('rev_coprod', {
    label: 'Co-product revenue', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['coprod_ktpa', 'cprice'], expr: 'coprod_ktpa × co-product price ÷ 1000',
    fn: function (v) { return v.coprod_ktpa * v.cprice / 1000; }
  });

  /* -- Stage 6: profitability ------------------------------------------ */
  input('irr', {
    label: 'Discount rate', stage: 'dcf', dim: 'fraction', unit: 'fraction',
    default: 0.1, range: [0.02, 0.3],
    source: 'Rate used to discount future cash flows. 8-12% is typical for process industry projects.'
  });

  computed('cost_total', {
    label: 'Total annual cost', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['capex_annual', 'opex_total', 'feed_cost'],
    expr: 'capex_annual + opex_total + feed_cost',
    fn: function (v) { return v.capex_annual + v.opex_total + v.feed_cost; }
  });
  computed('value_total', {
    label: 'Total annual revenue', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['rev_surf', 'rev_coprod'], expr: 'rev_surf + rev_coprod',
    fn: function (v) { return v.rev_surf + v.rev_coprod; }
  });
  computed('margin', {
    label: 'Economic margin', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['value_total', 'cost_total'], expr: 'value_total − cost_total',
    fn: function (v) { return v.value_total - v.cost_total; }
  });
  computed('mssp', {
    label: 'Minimum selling price', stage: 'dcf', dim: 'price_mass', unit: '$/t',
    deps: ['capex_annual', 'opex_total', 'feed_cost', 'rev_coprod', 'surf_ktpa'],
    expr: '(capex_annual + opex_total + feed_cost − rev_coprod) × 10⁶ ÷ (surf_ktpa × 1000)',
    fn: function (v) {
      return (v.capex_annual + v.opex_total + v.feed_cost - v.rev_coprod) * 1e6 / (v.surf_ktpa * 1000);
    }
  });
  computed('npv', {
    label: 'NPV over 20 years', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['margin', 'irr', 'tci'],
    expr: '−TCI + Σ margin ÷ (1 + r)ᵗ  for t = 1…20',
    fn: function (v) {
      var cum = -v.tci;
      for (var t = 1; t <= 20; t++) cum += v.margin / Math.pow(1 + v.irr, t);
      return cum;
    }
  });

  global.CC_MODELS.flue2chem = {
    id: 'flue2chem',
    title: 'Flue2Chem — CO₂ capture to surfactant',
    subtitle: 'Turning a flue gas stream into a surfactant that today comes from fossil feedstock.',
    functionalUnit: '1 kg of surfactant at the factory gate',
    boundary: 'Cradle-to-gate. Starts at the flue gas leaving the stack, ends at surfactant ready to ship. Excludes use phase and end of life.',
    fullTool: '../../standalone/flue2chem-lca-tea.html',
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
        tryIt: 'Before touching anything, note the functional unit. Every number you are ' +
          'about to calculate is “per 1 kg of surfactant” — change the product and none of ' +
          'them are comparable any more.'
      },
      mass: {
        tryIt: 'Click the flue gas stream and halve it to 18,000 t/d, then run the mass ' +
          'balance again. Every stream halves and the closure error stays at zero — the ' +
          'balance is linear in throughput. Now click the CO₂ Capture block and drop the ' +
          'recovery to 0.60: the surfactant output does not move, because yield is defined ' +
          'on the raw flue gas, but the CO₂ sent to the FT unit falls sharply.'
      },
      lci: {
        tryIt: 'Raise the electrolysis demand from 39.4 to 55 kWh/kg H₂ — a realistic ' +
          'commercial figure rather than a near-thermodynamic one — and re-run. Watch how ' +
          'much of the whole inventory is just hydrogen.'
      },
      lcia: {
        tryIt: 'Set the grid GWP to 0.02 kg CO₂e/kWh, as if the plant ran on a renewable ' +
          'contract, and re-run. The net GWP swings hard: this process is only as clean as ' +
          'the electricity behind it.'
      },
      capex: {
        tryIt: 'Change the Lang factor from 5.03 to 3.0 and re-run. Total capital drops by ' +
          '40% without a single piece of equipment changing — which is why the Lang factor ' +
          'is the assumption a reviewer will challenge first.'
      },
      opex: {
        tryIt: 'Set the co-product price to zero and re-run. If a process only works when ' +
          'you can sell everything it makes, that is worth knowing before it is built.'
      },
      dcf: {
        tryIt: 'Push the discount rate from 10% to 20% and re-run. Compare the minimum ' +
          'selling price against the 7,500 $/t that the fossil-derived surfactant sells for.'
      },
      interpret: {
        tryIt: 'Go back and change one input at a time by 10%, re-running to the end each ' +
          'time. Electricity cost, Lang factor and surfactant yield will move the answer far ' +
          'more than the rest. Those are the three numbers worth arguing about.'
      }
    },
    closure: {
      mass: {
        label: 'Mass balance closure',
        unit: 't/d',
        in: ['flue_in', 'h2_total'],
        out: ['surfactant', 'ft_coprod', 'eth_coprod', 'eo_byprod', 'exhaust'],
        tolerance: 0.01
      }
    },
    kpis: ['surfactant', 'gwp_per_kg', 'tci', 'mssp', 'margin', 'npv']
  };
})(typeof window !== 'undefined' ? window : globalThis);
