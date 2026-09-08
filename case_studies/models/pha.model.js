/* PHA biocomposite from lignocellulose - simplified teaching model.
   Formulae mirror the published PHA-from-lignocellulose LCA/TEA dashboard, so the
   numbers here track the full standalone tool. The flowsheet is not published with
   that dashboard; it is deduced from the balance equations and from the sizing
   basis of each item in its equipment list, then simplified for teaching.

   The published balance does not close - see `unaccounted` and the notice at the
   top of the page. The formulae are reproduced unchanged rather than repaired, so
   that the step-by-step tool and the dashboard stay in agreement. */
(function (global) {
  'use strict';
  global.CC_MODELS = global.CC_MODELS || {};

  /* Equipment list, as published: base cost $M, scaling exponent, base size,
     base CEPCI (null = quoted at today's index), and which sizing basis the row
     is scaled on. */
  var EQ = [
    ['Inoculation',          0.26,       0.6,  3.53,   402,   'train'],
    ['Fermenters',           0.67,       0.8,  1.04,   402,   'train'],
    ['Centrifugation',       2.92,       0.7,  18.466, 402,   'train'],
    ['Solvent extraction',   2.96,       0.7,  18.466, 402,   'train'],
    ['Washing',              0.41,       1.0,  33.5,   394.3, 'train'],
    ['Drying',               7.6,        0.8,  33.5,   394.3, 'train'],
    ['Anaerobic digestion',  1.54,       0.6,  43.0,   402,   'ad'],
    ['CHP',                  1.0,        1.0,  5.0,    null,  'chp'],
    ['Biomass handling',     14.1,       0.78, 83.3,   402,   'wet'],
    ['Biomass pretreatment', 5.62,       0.78, 83.3,   402,   'dry'],
    ['Twin-screw extrusion', 0.07792208, 1.0,  1.0,    null,  'compound'],
    ['Injection moulding',   0.10389610, 1.0,  1.0,    null,  'compound'],
    ['3D printing',          0.07792208, 1.0,  1.0,    null,  'compound']
  ];

  var V = {};
  function input(id, o) { o.id = id; o.kind = 'input'; V[id] = o; }
  function computed(id, o) { o.id = id; o.kind = 'computed'; V[id] = o; }

  /* Every equipment size in tonnes per hour, except the CHP which is rated in
     GWh/y. Reading these back out of the published equipment list is what fixes
     the topology of the flowsheet. */
  function sizes(v) {
    var h = v.opdays * 24;
    return {
      train:    (v.ferm_feed + v.ash) / h,
      ad:       (v.wet_in * v.moisture + v.chp_feed) / h,
      chp:      v.elec_gen / 3600,
      wet:      v.wet_in / h,
      dry:      v.basis / h,
      compound: (v.biofiller + v.pha) / h
    };
  }

  /* -- Stage 1: mass balance -------------------------------------------- */
  input('basis', {
    label: 'Dry biomass feed', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    default: 3500, range: [500, 20000], svgId: 'fs_dry', hit: 'stream-dry',
    source: 'Dry lignocellulosic residue delivered to the gate. 3,500 t/y sizes a plant ' +
      'making about 1 kt/y of biocomposite.'
  });
  input('moisture', {
    label: 'Moisture content', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.76, range: [0.1, 0.9], hit: 'block-handling',
    source: 'Mass fraction water in the biomass as received. Field-fresh agricultural residue ' +
      'is wet: at 76% four tonnes arrive for every tonne of dry matter.'
  });
  input('hemi_pct', {
    label: 'Hemicellulose', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.30, range: [0.1, 0.45], hit: 'stream-dry',
    source: 'Mass fraction of the dry biomass. Hemicellulose and cellulose are the sugar ' +
      'sources the fermentation actually eats.'
  });
  input('cell_pct', {
    label: 'Cellulose', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.46, range: [0.2, 0.6], hit: 'stream-dry',
    source: 'Mass fraction of the dry biomass.'
  });
  input('lign_pct', {
    label: 'Lignin', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.20, range: [0.05, 0.35], hit: 'stream-dry',
    source: 'Mass fraction of the dry biomass. Lignin is not fermentable here, so it is burnt ' +
      'for heat and power.'
  });
  input('ash_pct', {
    label: 'Ash', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.04, range: [0.005, 0.15], hit: 'stream-dry',
    source: 'Mineral matter. Inert: it passes through and leaves with the solids.'
  });
  input('rec_hemi', {
    label: 'Hemicellulose recovery', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.95, range: [0.5, 1.0], hit: 'block-pretreat',
    source: 'Fraction of the hemicellulose released by pretreatment and sent to fermentation.'
  });
  input('rec_cell', {
    label: 'Cellulose recovery', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.87, range: [0.5, 1.0], hit: 'block-pretreat',
    source: 'Fraction of the cellulose released to fermentation. What is not released becomes ' +
      'the biofiller stream that goes on to compounding.'
  });
  input('rec_lign', {
    label: 'Lignin recovery', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.79, range: [0.3, 1.0], hit: 'block-pretreat',
    source: 'Fraction of the lignin carried through with the pretreated stream. It is not ' +
      'fermented; it ends up in the boiler either way.'
  });
  input('yield_pha', {
    label: 'PHA yield on sugars', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.35, range: [0.1, 0.6], hit: 'block-ferm',
    source: 'kg PHA copolymer per kg of hemicellulose + cellulose fed to the fermenters. ' +
      '0.3-0.4 is the range reported for mixed-culture and Cupriavidus systems.'
  });
  input('biocomp_rec', {
    label: 'Compounding recovery', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.95358, range: [0.7, 1.0], hit: 'block-compound',
    source: 'Fraction of the PHA + biofiller blend that leaves as saleable biocomposite after ' +
      'extrusion, moulding and printing.'
  });
  input('calorific', {
    label: 'Calorific value of residue', stage: 'mass', dim: 'energy_intensity', unit: 'GJ/t',
    default: 20, range: [12, 25], hit: 'block-chp',
    source: 'Lower heating value of the lignin-rich solid burnt in the CHP.'
  });
  input('elec_eff', {
    label: 'CHP electrical efficiency', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.35, range: [0.15, 0.45], hit: 'block-chp',
    source: 'Fraction of the fuel energy that leaves as electricity. The rest is recovered as heat.'
  });

  computed('wet_in', {
    label: 'Wet biomass received', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    svgId: 'fs_wet', hit: 'stream-wet',
    deps: ['basis', 'moisture'], expr: 'basis ÷ (1 − moisture)',
    fn: function (v) { return v.basis / (1 - v.moisture); }
  });
  computed('water_out', {
    label: 'Water removed', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    svgId: 'fs_water', hit: 'stream-water',
    deps: ['wet_in', 'basis'], expr: 'wet_in − basis',
    fn: function (v) { return v.wet_in - v.basis; }
  });
  computed('hemi', {
    label: 'Hemicellulose in feed', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    deps: ['basis', 'hemi_pct'], expr: 'basis × hemi_pct',
    fn: function (v) { return v.basis * v.hemi_pct; }
  });
  computed('cell', {
    label: 'Cellulose in feed', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    deps: ['basis', 'cell_pct'], expr: 'basis × cell_pct',
    fn: function (v) { return v.basis * v.cell_pct; }
  });
  computed('lign', {
    label: 'Lignin in feed', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    deps: ['basis', 'lign_pct'], expr: 'basis × lign_pct',
    fn: function (v) { return v.basis * v.lign_pct; }
  });
  computed('ash', {
    label: 'Ash in feed', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    deps: ['basis', 'ash_pct'], expr: 'basis × ash_pct',
    fn: function (v) { return v.basis * v.ash_pct; }
  });
  computed('sugars', {
    label: 'Sugars to fermentation', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    deps: ['hemi', 'cell', 'rec_hemi', 'rec_cell'],
    expr: 'hemi × rec_hemi + cell × rec_cell',
    fn: function (v) { return v.hemi * v.rec_hemi + v.cell * v.rec_cell; }
  });
  computed('ferm_feed', {
    label: 'Pretreated stream to fermentation', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    svgId: 'fs_ferm', hit: 'stream-ferm',
    deps: ['sugars', 'lign', 'rec_lign'], expr: 'sugars + lign × rec_lign',
    fn: function (v) { return v.sugars + v.lign * v.rec_lign; }
  });
  computed('biofiller', {
    label: 'Biofiller (unreleased cellulose)', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    svgId: 'fs_biof', hit: 'stream-biof',
    deps: ['cell', 'rec_cell'], expr: 'cell × (1 − rec_cell)',
    fn: function (v) { return v.cell * (1 - v.rec_cell); }
  });
  computed('pha', {
    label: 'PHA copolymer', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    svgId: 'fs_pha', hit: 'stream-pha',
    deps: ['sugars', 'yield_pha'], expr: 'sugars × yield_pha',
    fn: function (v) { return v.sugars * v.yield_pha; }
  });
  computed('chp_feed', {
    label: 'Residue to CHP', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    svgId: 'fs_chp', hit: 'stream-chp',
    deps: ['lign', 'sugars', 'biofiller', 'pha'],
    expr: 'lign + sugars − biofiller − pha        (as published)',
    fn: function (v) { return v.lign + v.sugars - v.biofiller - v.pha; }
  });
  computed('biocomposite', {
    label: 'PHA biocomposite product', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    svgId: 'fs_prod', hit: 'stream-prod',
    deps: ['pha', 'biofiller', 'biocomp_rec'], expr: '(pha + biofiller) × biocomp_rec',
    fn: function (v) { return (v.pha + v.biofiller) * v.biocomp_rec; }
  });
  computed('comp_loss', {
    label: 'Compounding losses', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    deps: ['pha', 'biofiller', 'biocomposite'], expr: 'pha + biofiller − biocomposite',
    fn: function (v) { return v.pha + v.biofiller - v.biocomposite; }
  });
  computed('unaccounted', {
    label: 'Unaccounted solids', stage: 'mass', dim: 'mass_tpa', unit: 't/y',
    svgId: 'fs_loss', hit: 'stream-loss',
    deps: ['basis', 'biofiller', 'pha', 'chp_feed', 'ash'],
    expr: 'basis − biofiller − pha − chp_feed − ash        (should be zero — see the notice)',
    fn: function (v) { return v.basis - v.biofiller - v.pha - v.chp_feed - v.ash; }
  });
  computed('elec_gen', {
    label: 'Electricity generated', stage: 'mass', dim: 'energy', unit: 'GJ',
    svgId: 'fs_elec', hit: 'stream-elec',
    deps: ['chp_feed', 'calorific', 'elec_eff'],
    expr: 'chp_feed × calorific × elec_eff      (GJ/y)',
    fn: function (v) { return v.chp_feed * v.calorific * v.elec_eff; }
  });

  /* -- Stage 2: inventory, per kg of biocomposite ------------------------ */
  input('f_naoh', {
    label: 'Sodium hydroxide', stage: 'lci', dim: 'mass_intensity', unit: 'kg/kg',
    default: 0.4, range: [0, 1.5],
    source: 'kg per kg of biocomposite. Pretreatment alkali — the largest single reagent flow.'
  });
  input('f_solvent', {
    label: 'Extraction solvent', stage: 'lci', dim: 'mass_intensity', unit: 'kg/kg',
    default: 0.1, range: [0, 0.5],
    source: 'kg per kg of biocomposite. Net make-up after recovery, for pulling PHA out of the cells.'
  });
  input('f_h2so4', {
    label: 'Sulfuric acid', stage: 'lci', dim: 'mass_intensity', unit: 'kg/kg',
    default: 0.2, range: [0, 0.8],
    source: 'kg per kg of biocomposite. Hydrolysis and neutralisation.'
  });
  input('f_other', {
    label: 'Other reagents, nutrients and water', stage: 'lci', dim: 'mass_intensity', unit: 'kg/kg',
    default: 0.458776, range: [0, 1.5],
    source: 'kg per kg of biocomposite. The ten remaining lines of the published inventory ' +
      'lumped together: phosphates, ammonium salts, lime, citric acid, trace metals and water.'
  });
  input('f_steam', {
    label: 'Process steam', stage: 'lci', dim: 'energy_intensity', unit: 'MJ/kg',
    default: 2.2, range: [0, 8],
    source: 'MJ per kg of biocomposite, for pretreatment and drying.'
  });
  input('f_transport', {
    label: 'Transport (kt·km)', stage: 'lci', dim: 'count', unit: '',
    default: 100, range: [0, 500], source: 'kt·km of road freight attributed to the inventory.'
  });
  input('elec_consump', {
    label: 'Process electricity use', stage: 'lci', dim: 'energy_per_mass', unit: 'MWh/t',
    default: 2.6, range: [0.5, 8], hit: 'block-recovery',
    source: 'MWh per tonne of PHA + biofiller handled, across fermentation, separation and compounding.'
  });

  computed('reag_per_kg', {
    label: 'Total reagents per kg product', stage: 'lci', dim: 'mass_intensity', unit: 'kg/kg',
    deps: ['f_naoh', 'f_solvent', 'f_h2so4', 'f_other'],
    expr: 'f_naoh + f_solvent + f_h2so4 + f_other',
    fn: function (v) { return v.f_naoh + v.f_solvent + v.f_h2so4 + v.f_other; }
  });
  computed('reag_annual', {
    label: 'Reagents consumed', stage: 'lci', dim: 'mass_tpa', unit: 't/y',
    deps: ['reag_per_kg', 'pha', 'biofiller'],
    expr: 'reag_per_kg × (pha + biofiller)      (as published: charged on the blend)',
    fn: function (v) { return v.reag_per_kg * (v.pha + v.biofiller); }
  });
  computed('steam_annual', {
    label: 'Process steam', stage: 'lci', dim: 'energy', unit: 'GJ',
    deps: ['f_steam', 'biocomposite'], expr: 'f_steam × biocomposite      (GJ/y)',
    fn: function (v) { return v.f_steam * v.biocomposite; }
  });
  computed('elec_net', {
    label: 'Net electricity (demand − CHP)', stage: 'lci', dim: 'energy', unit: 'GJ',
    deps: ['elec_consump', 'pha', 'biofiller', 'elec_gen'],
    expr: 'elec_consump × (pha + biofiller) × 3.6 − elec_gen      (GJ/y)',
    fn: function (v) {
      return v.elec_consump * (v.pha + v.biofiller) * 3.6 - v.elec_gen;
    }
  });
  computed('elec_per_t', {
    label: 'Net electricity per tonne of product', stage: 'lci', dim: 'energy_intensity', unit: 'GJ/t',
    deps: ['elec_net', 'biocomposite'], expr: 'elec_net ÷ biocomposite',
    fn: function (v) { return v.elec_net / v.biocomposite; }
  });

  /* -- Stage 3: impact assessment ---------------------------------------- */
  input('k_naoh', {
    label: 'GWP factor — sodium hydroxide', stage: 'lcia', dim: 'count', unit: '',
    default: 1.3132269, range: [0.5, 3], source: 'kg CO₂e per kg, chlor-alkali route.'
  });
  input('k_solvent', {
    label: 'GWP factor — solvent', stage: 'lcia', dim: 'count', unit: '',
    default: 0.85517497, range: [0.2, 5], source: 'kg CO₂e per kg.'
  });
  input('k_h2so4', {
    label: 'GWP factor — sulfuric acid', stage: 'lcia', dim: 'count', unit: '',
    default: 0.167097855, range: [0.05, 1], source: 'kg CO₂e per kg.'
  });
  input('k_other', {
    label: 'GWP factor — other reagents', stage: 'lcia', dim: 'count', unit: '',
    default: 1.4300891450232052, range: [0.2, 4],
    source: 'kg CO₂e per kg, flow-weighted across the ten lumped inventory lines.'
  });
  input('k_steam', {
    label: 'GWP factor — process steam', stage: 'lcia', dim: 'count', unit: '',
    default: 0.07121196, range: [0.01, 0.2], source: 'kg CO₂e per MJ of steam.'
  });
  input('k_transport', {
    label: 'GWP factor — transport', stage: 'lcia', dim: 'count', unit: '',
    default: 0.00054090589, range: [0.0001, 0.002], source: 'kg CO₂e per kt·km.'
  });

  computed('gwp_naoh', {
    label: 'GWP — sodium hydroxide', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['f_naoh', 'k_naoh'], expr: 'f_naoh × k_naoh',
    fn: function (v) { return v.f_naoh * v.k_naoh; }
  });
  computed('gwp_other', {
    label: 'GWP — other reagents', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['f_other', 'k_other'], expr: 'f_other × k_other',
    fn: function (v) { return v.f_other * v.k_other; }
  });
  computed('gwp_steam', {
    label: 'GWP — process steam', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['f_steam', 'k_steam'], expr: 'f_steam × k_steam',
    fn: function (v) { return v.f_steam * v.k_steam; }
  });
  computed('gwp_solvent', {
    label: 'GWP — solvent', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['f_solvent', 'k_solvent'], expr: 'f_solvent × k_solvent',
    fn: function (v) { return v.f_solvent * v.k_solvent; }
  });
  computed('gwp_h2so4', {
    label: 'GWP — sulfuric acid', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['f_h2so4', 'k_h2so4'], expr: 'f_h2so4 × k_h2so4',
    fn: function (v) { return v.f_h2so4 * v.k_h2so4; }
  });
  computed('gwp_transport', {
    label: 'GWP — transport', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['f_transport', 'k_transport'], expr: 'f_transport × k_transport',
    fn: function (v) { return v.f_transport * v.k_transport; }
  });
  computed('gwp_per_kg', {
    label: 'Total GWP', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['gwp_naoh', 'gwp_other', 'gwp_steam', 'gwp_solvent', 'gwp_h2so4', 'gwp_transport'],
    expr: 'Σ ( inventory flow × characterisation factor )',
    fn: function (v) {
      return v.gwp_naoh + v.gwp_other + v.gwp_steam + v.gwp_solvent +
        v.gwp_h2so4 + v.gwp_transport;
    }
  });
  computed('gwp_annual', {
    label: 'Annual plant GWP', stage: 'lcia', dim: 'gwp', unit: 'kt CO2e/y',
    deps: ['gwp_per_kg', 'biocomposite'], expr: 'gwp_per_kg × biocomposite',
    fn: function (v) { return v.gwp_per_kg * v.biocomposite / 1000; }
  });

  /* -- Stage 4: capital cost --------------------------------------------- */
  input('opdays', {
    label: 'Operating days per year', stage: 'capex', dim: 'days', unit: 'd/y',
    default: 290, range: [200, 365],
    source: 'On-stream time. Fewer days means the same annual output must pass through bigger, ' +
      'dearer equipment.'
  });
  input('cepci', {
    label: 'Current CEPCI', stage: 'capex', dim: 'count', unit: '',
    default: 820, range: [400, 1000],
    source: 'Chemical Engineering Plant Cost Index today. Brings historic quotes up to date.'
  });
  input('tci_ratio', {
    label: 'TCI ÷ DCE ratio', stage: 'capex', dim: 'count', unit: '',
    default: 3, range: [1.5, 6],
    source: 'Lang-type factor: installation, piping, instrumentation, civils, engineering and ' +
      'contingency on top of delivered equipment.'
  });

  computed('size_handling', {
    label: 'Biomass handling size', stage: 'capex', dim: 'mass_hour', unit: 't/h',
    deps: ['wet_in', 'opdays'], expr: 'wet_in ÷ (opdays × 24)',
    fn: function (v) { return sizes(v).wet * 1000; }
  });
  computed('size_train', {
    label: 'Fermentation train size', stage: 'capex', dim: 'mass_hour', unit: 't/h',
    deps: ['ferm_feed', 'ash', 'opdays'], expr: '(ferm_feed + ash) ÷ (opdays × 24)',
    fn: function (v) { return sizes(v).train * 1000; }
  });
  computed('dce', {
    label: 'Delivered cost of equipment', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['size_handling', 'size_train', 'cepci', 'chp_feed', 'elec_gen',
           'biofiller', 'pha', 'basis', 'wet_in', 'moisture'],
    expr: 'Σ  Cᵦ × (S ÷ Sᵦ)ⁿ × (CEPCI ÷ CEPCIᵦ)   over the 13 published units',
    fn: function (v) {
      var s = sizes(v), total = 0;
      for (var i = 0; i < EQ.length; i++) {
        var r = EQ[i];
        var base = r[4] === null ? v.cepci : r[4];
        var c = r[1] * Math.pow(Math.abs(s[r[5]]) / r[3], r[2]) * v.cepci / base;
        if (isFinite(c)) total += c;
      }
      return total;
    }
  });
  computed('tci', {
    label: 'Total capital investment', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['dce', 'tci_ratio'], expr: 'tci_ratio × dce',
    fn: function (v) { return v.tci_ratio * v.dce; }
  });

  /* -- Stage 5: operating cost and revenue -------------------------------- */
  input('biomass_price', {
    label: 'Dry biomass price', stage: 'opex', dim: 'price_mass', unit: '$/t',
    default: 100, range: [0, 400],
    source: 'Delivered cost of the residue. Zero would mean a gate fee rather than a purchase.'
  });
  input('biocomp_price', {
    label: 'Biocomposite selling price', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 7000, range: [1000, 20000],
    source: '$/kg. Commodity polypropylene sells near $1.5/kg; PHA compounds command a bio-premium.'
  });
  input('reagent_price', {
    label: 'Reagents, average price', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 260, range: [50, 2000], source: '$/kg, averaged across the reagent basket.'
  });
  input('elec_price', {
    label: 'Electricity price', stage: 'opex', dim: 'price_energy', unit: '$/GJ',
    default: 60, range: [10, 200],
    source: '$/GJ (60 $/GJ ≈ 0.22 $/kWh). Also the value of the CHP export, which is why the ' +
      'electricity line comes out negative.'
  });
  input('heat_price', {
    label: 'Heat / steam price', stage: 'opex', dim: 'price_energy', unit: '$/GJ',
    default: 10, range: [2, 60], source: '$/GJ of process steam bought in.'
  });
  input('ann_cc', {
    label: 'Annual capital charge', stage: 'opex', dim: 'fraction', unit: '%',
    default: 0.1, range: [0.03, 0.25],
    source: 'Fraction of total capital charged to each operating year.'
  });
  input('ind_factor', {
    label: 'Indirect cost factor', stage: 'opex', dim: 'fraction', unit: '%',
    default: 0.06, range: [0.01, 0.2],
    source: 'Insurance, rates and general overheads, as a fraction of the annual capital charge.'
  });
  input('labor_cost', {
    label: 'Cost per job', stage: 'opex', dim: 'currency', unit: '$',
    default: 0.05, range: [0.02, 0.15], source: 'Fully loaded annual cost of one operator.'
  });
  input('jobs_per_kt', {
    label: 'Jobs per kt of product', stage: 'opex', dim: 'count', unit: '',
    default: 3, range: [0.5, 12],
    source: 'Staffing intensity. Small biorefineries are labour-heavy per tonne.'
  });
  input('labor_oh', {
    label: 'Labour overhead multiplier', stage: 'opex', dim: 'count', unit: '',
    default: 1.9, range: [1, 3],
    source: 'Supervision, benefits and support staff on top of direct wages.'
  });

  computed('cost_capital', {
    label: 'Capital charge', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['tci', 'ann_cc'], expr: 'tci × ann_cc',
    fn: function (v) { return v.tci * v.ann_cc; }
  });
  computed('cost_indirect', {
    label: 'Indirect fixed opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['cost_capital', 'ind_factor'], expr: 'cost_capital × ind_factor',
    fn: function (v) { return v.cost_capital * v.ind_factor; }
  });
  computed('cost_labour', {
    label: 'Labour', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['jobs_per_kt', 'biocomposite', 'labor_cost', 'labor_oh'],
    expr: 'jobs_per_kt × biocomposite (kt) × labor_cost × labor_oh',
    fn: function (v) {
      return v.jobs_per_kt * (v.biocomposite / 1000) * v.labor_cost * v.labor_oh;
    }
  });
  computed('cost_reagents', {
    label: 'Reagents', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['reag_annual', 'reagent_price'], expr: 'reag_annual × reagent_price',
    fn: function (v) { return v.reag_annual * v.reagent_price / 1e6; }
  });
  computed('cost_elec', {
    label: 'Electricity, net of CHP export', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['elec_net', 'elec_price'], expr: 'elec_net × elec_price',
    fn: function (v) { return v.elec_net * v.elec_price / 1e6; }
  });
  computed('cost_heat', {
    label: 'Heat / steam', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['steam_annual', 'heat_price'], expr: 'steam_annual × heat_price',
    fn: function (v) { return v.steam_annual * v.heat_price / 1e6; }
  });
  computed('cost_feed', {
    label: 'Feedstock', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['basis', 'biomass_price'], expr: 'basis × biomass_price',
    fn: function (v) { return v.basis * v.biomass_price / 1e6; }
  });
  computed('cost_misc', {
    label: 'Miscellaneous opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['cost_indirect', 'cost_labour', 'cost_reagents', 'cost_heat'],
    expr: '0.30 × (indirect + labour + reagents + heat)',
    fn: function (v) {
      return 0.3 * (v.cost_indirect + v.cost_labour + v.cost_reagents + v.cost_heat);
    }
  });
  computed('cost_total', {
    label: 'Total annual cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['cost_capital', 'cost_indirect', 'cost_labour', 'cost_reagents',
           'cost_elec', 'cost_heat', 'cost_feed', 'cost_misc'],
    expr: 'sum of every line above',
    fn: function (v) {
      return v.cost_capital + v.cost_indirect + v.cost_labour + v.cost_reagents +
        v.cost_elec + v.cost_heat + v.cost_feed + v.cost_misc;
    }
  });
  computed('revenue', {
    label: 'Product revenue', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['biocomposite', 'biocomp_price'], expr: 'biocomposite × biocomp_price',
    fn: function (v) { return v.biocomposite * v.biocomp_price / 1e6; }
  });
  computed('net_margin', {
    label: 'Net annual profit', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['revenue', 'cost_total'], expr: 'revenue − cost_total',
    fn: function (v) { return v.revenue - v.cost_total; }
  });

  /* -- Stage 6: profitability --------------------------------------------- */
  input('irr', {
    label: 'Discount rate', stage: 'dcf', dim: 'fraction', unit: '%',
    default: 0.1, range: [0.02, 0.3],
    source: 'Rate used to discount future cash flows over the 10-year appraisal.'
  });

  computed('npv', {
    label: 'NPV over 10 years', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['net_margin', 'irr', 'tci'],
    expr: '−tci + Σ net_margin ÷ (1 + irr)ᵗ   for t = 1…10',
    fn: function (v) {
      var cum = -v.tci;
      for (var t = 1; t <= 10; t++) cum += v.net_margin / Math.pow(1 + v.irr, t);
      return cum;
    }
  });
  computed('msp', {
    label: 'Minimum selling price', stage: 'dcf', dim: 'price_mass', unit: '$/t',
    deps: ['cost_total', 'biocomposite'],
    expr: 'cost_total × 10⁶ ÷ biocomposite      (the price at which profit = 0)',
    fn: function (v) { return v.cost_total * 1e6 / v.biocomposite; }
  });
  computed('payback', {
    label: 'Simple payback', stage: 'dcf', dim: 'years', unit: 'y',
    deps: ['tci', 'net_margin'], expr: 'tci ÷ net_margin',
    fn: function (v) { return v.net_margin > 0 ? v.tci / v.net_margin : NaN; }
  });

  global.CC_MODELS.pha = {
    id: 'pha',
    title: 'PHA biocomposite from lignocellulose',
    subtitle: 'Fermenting agricultural residue into a bioplastic, and filling it with what the ' +
      'pretreatment could not release.',
    functionalUnit: '1 kg of PHA biocomposite at the factory gate',
    boundary: 'Cradle-to-gate. Starts at wet lignocellulosic residue delivered to the plant, ends ' +
      'at compounded biocomposite ready to ship. Electricity from the on-site CHP is credited ' +
      'against the plant’s own demand. Excludes use phase and end of life.',
    fullTool: '../../standalone/PHA-from-lignocellulose-lca-tea.html',
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
        tryIt: 'The functional unit is 1 kg of biocomposite, not 1 kg of PHA. About a fifth of ' +
          'the product is biofiller the fermentation never touched, so every burden below is ' +
          'spread over material that cost almost nothing to make. Change that definition and ' +
          'the answer moves without a single process change.'
      },
      mass: {
        tryIt: 'Run the balance and read the closure line: it does not close. 262 t/y — 7.5% of ' +
          'the dry feed — reaches neither a product nor the boiler. Click “Unaccounted solids” ' +
          'on the flowsheet to see where it comes from. Then raise cellulose recovery from 87% ' +
          'to 95% and re-run: more sugar reaches the fermenters, but the biofiller stream ' +
          'collapses and the biocomposite output barely moves. That trade-off is the whole ' +
          'design idea of this plant.'
      },
      lci: {
        tryIt: 'Note the two denominators: the reagent inventory is charged against PHA + ' +
          'biofiller, the steam against the finished biocomposite. Then look at the net ' +
          'electricity line — it is negative, because the CHP more than covers the plant.'
      },
      lcia: {
        tryIt: 'Sodium hydroxide alone is about a third of the footprint, and the lumped “other ' +
          'reagents” another 43%. Drop the caustic loading from 0.4 to 0.2 kg/kg and re-run: ' +
          'pretreatment chemistry, not energy, is what this process has to fix.'
      },
      capex: {
        tryIt: 'Biomass handling is the most expensive item on the list, because it is sized on ' +
          'the wet feed — at 76% moisture the plant moves four tonnes for every tonne of dry ' +
          'matter. Drop the moisture to 40% in the mass balance step, re-run everything, and ' +
          'watch capital fall without changing the product at all.'
      },
      opex: {
        tryIt: 'The electricity line is negative: the CHP export is worth more than the plant ' +
          'consumes. Now set the biocomposite price to $2/kg, near commodity polypropylene, and ' +
          're-run — the whole case rests on being paid a bio-premium.'
      },
      dcf: {
        tryIt: 'Compare the minimum selling price against the $7/kg assumed. The headroom looks ' +
          'comfortable — then push the discount rate to 25% and the biomass price to $250/t and ' +
          'see how fast it closes.'
      },
      interpret: {
        tryIt: 'Three inputs dominate: the biocomposite price, the PHA yield on sugars, and the ' +
          'caustic loading. One is a market, one is biology, and only the third is really an ' +
          'engineering choice. And before quoting any of it, deal with the 7.5% of the feed that ' +
          'the mass balance cannot account for.'
      }
    },
    /* Reported, not repaired: the published formulae lose 7.5% of the feed. */
    closure: {
      mass: {
        label: 'Solids balance closure',
        unit: 't/y',
        in: ['basis'],
        out: ['biocomposite', 'comp_loss', 'chp_feed', 'ash'],
        tolerance: 0.01
      }
    },
    kpis: ['biocomposite', 'gwp_per_kg', 'tci', 'msp', 'net_margin', 'npv']
  };
})(typeof window !== 'undefined' ? window : globalThis);
