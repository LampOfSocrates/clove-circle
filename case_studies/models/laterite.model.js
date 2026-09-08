/* Laterite to metal extraction - simplified teaching model.
   Formulae mirror the published laterite NHM processing LCA/TEA worksheet, so the
   numbers here track the full standalone dashboard. The diagram is a simplified
   flowsheet. */
(function (global) {
  'use strict';
  global.CC_MODELS = global.CC_MODELS || {};

  var K = {
    T_cold: 25, T_oven: 100, T_dry40: 40, T_bio: 46,
    Cp_w: 4.18, Cp_s: 0.9, H_evap: 2257, eff_oven: 0.65,
    BWI_crush: 12, crush_in: 100, crush_out: 20,
    BWI_attr: 14, mozl_kWht: 1.3,
    ef_feso4: 0.17035817, ef_elec: 0.0575, ef_heat: 0.075791799, ef_nutrient: 0.0010499693,
    f_bfl: 20 / 360, f_bcl_stor: 268 / 360, f_bcl_attr: 72 / 360,
    f_bcl_fine: 69 / 360, f_bcl_mozl: 1.7 / 360, f_heav: 0.6 / 360,
    N_Al: (9.2 / 100) * (38.5 / 100),
    N_Mn: (11.8 / 100) * (94.6 / 100),
    N_Ni: (1.7 / 100) * (79.9 / 100),
    N_Co: (0.4 / 100) * (87.2 / 100),
    CEPCI: 820, op_days: 290, lang: 3,
    indir_frac: 0.06, lab_overhead: 1.9, jobs_kt: 23, misc_frac: 0.3,
    capex: [
      { B: 7.6, n: 0.8, D: 33.5, Ce: 394.3, sk: 'nclwet' },
      { B: 7.6, n: 0.8, D: 33.5, Ce: 394.3, sk: 'ncldry' },
      { B: 0.41, n: 0.6, D: 33.5, Ce: 394.3, sk: 'ncldry' },
      { B: 0.41, n: 0.6, D: 33.5, Ce: 394.3, sk: 'bfl' },
      { B: 0.41, n: 0.6, D: 33.5, Ce: 394.3, sk: 'attr' },
      { B: 0.41, n: 0.6, D: 33.5, Ce: 394.3, sk: 'mozl' },
      { B: 1.0, n: 0.65, D: 33.5, Ce: 394.3, sk: 'ncldry' },
      { B: 2.96, n: 0.7, D: 18.5, Ce: 402, sk: 'bioleach' }
    ]
  };
  var OP_HRS = K.op_days * 24;

  var V = {};
  function input(id, o) { o.id = id; o.kind = 'input'; V[id] = o; }
  function computed(id, o) { o.id = id; o.kind = 'computed'; V[id] = o; }

  /* -- Stage 1: mass balance ------------------------------------------- */
  input('ncl', {
    label: 'Raw laterite feed (dry)', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    default: 360, range: [50, 5000], svgId: 'fs_ncl', hit: 'stream-ncl',
    source: 'Dry mass of nickel-cobalt laterite ore fed to the plant.'
  });
  input('moist', {
    label: 'Moisture content', stage: 'mass', dim: 'fraction', unit: '%',
    default: 0.25, range: [0, 0.6], hit: 'block-dry',
    source: 'Free water in the as-mined ore. It all has to be evaporated, and that is the single largest heat demand.'
  });

  computed('ncl_wet', {
    label: 'Wet ore received', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    svgId: 'fs_nclwet',
    deps: ['ncl', 'moist'], expr: 'ncl ÷ (1 − moisture)',
    fn: function (v) { return v.ncl / (1 - v.moist); }
  });
  computed('bfl', {
    label: 'Bulk fine laterite', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    svgId: 'fs_bfl', hit: 'stream-bfl',
    deps: ['ncl'], expr: '20/360 × ncl',
    fn: function (v) { return K.f_bfl * v.ncl; }
  });
  computed('bcl', {
    label: 'Bulk coarse laterite', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    svgId: 'fs_bcl', hit: 'stream-bcl',
    deps: ['ncl', 'bfl'], expr: 'ncl − bfl',
    fn: function (v) { return v.ncl - v.bfl; }
  });
  computed('bcl_stor', {
    label: 'Coarse to storage', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    svgId: 'fs_stor', hit: 'stream-stor',
    deps: ['ncl'], expr: '268/360 × ncl',
    fn: function (v) { return K.f_bcl_stor * v.ncl; }
  });
  computed('bcl_attr', {
    label: 'To attrition & wet sieving', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    svgId: 'fs_attr', hit: 'stream-attr',
    deps: ['ncl'], expr: '72/360 × ncl',
    fn: function (v) { return K.f_bcl_attr * v.ncl; }
  });
  computed('bcl_fine', {
    label: 'Fines fraction', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    deps: ['ncl'], expr: '69/360 × ncl',
    fn: function (v) { return K.f_bcl_fine * v.ncl; }
  });
  computed('bcl_mozl', {
    label: 'To Mozley separation', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    deps: ['ncl'], expr: '1.7/360 × ncl',
    fn: function (v) { return K.f_bcl_mozl * v.ncl; }
  });
  computed('heav', {
    label: 'Heavies', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    deps: ['ncl'], expr: '0.6/360 × ncl',
    fn: function (v) { return K.f_heav * v.ncl; }
  });
  computed('mnox', {
    label: 'Mn oxides concentrate', stage: 'mass', dim: 'mass_hour', unit: 'kg/h',
    svgId: 'fs_mnox', hit: 'stream-mnox',
    deps: ['bcl_attr', 'bcl_fine', 'heav'], expr: 'bcl_attr − bcl_fine − heavies',
    fn: function (v) { return v.bcl_attr - v.bcl_fine - v.heav; }
  });

  /* -- Stage 2: inventory ------------------------------------------------ */
  input('solidc', {
    label: 'Bioleach solid concentration', stage: 'lci', dim: 'concentration', unit: 'g/L',
    default: 50, range: [5, 200], hit: 'block-bioleach',
    source: 'Pulp density in the bioleach reactor. Lower density means more water to heat per kg of ore.'
  });
  input('na2so4', {
    label: 'Na₂SO₄ dose (BFL)', stage: 'lci', dim: 'concentration', unit: 'g/L',
    default: 0, range: [0, 200], hit: 'block-bioleach', source: 'Reagent added to the bulk fine laterite bioleach.'
  });
  input('feso4b', {
    label: 'FeSO₄ dose (BFL)', stage: 'lci', dim: 'concentration', unit: 'g/L',
    default: 3, range: [0, 60], hit: 'block-bioleach', source: 'Iron source for the bulk fine laterite bioleach.'
  });
  input('feso4m', {
    label: 'FeSO₄ dose (Mn oxides)', stage: 'lci', dim: 'concentration', unit: 'g/L',
    default: 25, range: [0, 100], hit: 'block-bioleach',
    source: 'Iron source for the Mn oxide concentrate bioleach. The dominant reagent burden.'
  });

  computed('q_oven', {
    label: 'Oven drying heat', stage: 'lci', dim: 'count', unit: '',
    deps: ['ncl', 'moist'],
    expr: '(sensible water + latent evaporation + sensible solid) ÷ oven efficiency   (MJ/h)',
    fn: function (v) {
      var mf = v.moist, df = 1 - mf;
      var qs = mf * K.Cp_w * (K.T_oven - K.T_cold) * v.ncl;
      var qe = mf * K.H_evap * v.ncl;
      var qd = df * K.Cp_s * (K.T_oven - K.T_cold) * v.ncl;
      return (qs + qe + qd) / K.eff_oven / 1000;
    }
  });
  computed('q_dry40', {
    label: 'Drying at 40 °C', stage: 'lci', dim: 'count', unit: '',
    deps: ['ncl', 'moist'], expr: 'ncl × (1 − moisture) × ΔT × Cp_solid ÷ 1000   (MJ/h)',
    fn: function (v) { return v.ncl * (1 - v.moist) * (K.T_dry40 - K.T_cold) * K.Cp_s / 1000; }
  });
  computed('e_crush', {
    label: 'Crushing energy', stage: 'lci', dim: 'count', unit: '',
    deps: ['ncl', 'moist'],
    expr: 'Bond: 10 × BWI × (1/√P₈₀ − 1/√F₈₀) × dry feed   (MJ/h)',
    fn: function (v) {
      var spec = 10 * K.BWI_crush *
        (-1 / Math.sqrt(K.crush_in * 1000) + 1 / Math.sqrt(K.crush_out * 1000)) * 3.6 / 1000;
      return spec * (1 - v.moist) * v.ncl;
    }
  });
  computed('e_attr', {
    label: 'Attrition & wet sieving', stage: 'lci', dim: 'count', unit: '',
    deps: ['ncl', 'moist', 'bcl_fine', 'bcl_mozl', 'bcl_attr'],
    expr: 'Bond work applied to each size fraction   (MJ/h)',
    fn: function (v) {
      var ff = v.bcl_fine / v.ncl, fm = v.bcl_mozl / v.ncl;
      var fc = (v.bcl_attr - v.bcl_fine - v.bcl_mozl) / v.ncl;
      var s = function (mm) { return -1 / Math.sqrt(20 * 1000) + 1 / Math.sqrt(mm * 1000); };
      return 10 * K.BWI_attr * (s(0.25) * fm + s(0.6) * fc + s(0.05) * ff) *
        (1 - v.moist) * v.ncl * 3.6 / 1000;
    }
  });
  computed('e_mozl', {
    label: 'Mozley separation energy', stage: 'lci', dim: 'count', unit: '',
    deps: ['bcl_mozl', 'ncl', 'moist'], expr: 'Mozley duty × dry Mozley feed   (MJ/h)',
    fn: function (v) {
      return (v.bcl_mozl / v.ncl) * K.mozl_kWht * 3.6 / 1000 * (1 - v.moist) * v.ncl;
    }
  });
  computed('bio_vol_mn', {
    label: 'Bioleach volume, Mn oxides', stage: 'lci', dim: 'count', unit: '',
    deps: ['mnox', 'ncl', 'moist', 'solidc'],
    expr: 'dry Mn oxide concentrate ÷ solid concentration   (L/h)',
    fn: function (v) {
      return (v.mnox / v.ncl) * (1 - v.moist) * v.ncl / (v.solidc / 1000);
    }
  });
  computed('bio_vol_bfl', {
    label: 'Bioleach volume, BFL', stage: 'lci', dim: 'count', unit: '',
    deps: ['bfl', 'ncl', 'moist', 'solidc'],
    expr: 'dry bulk fine laterite ÷ solid concentration   (L/h)',
    fn: function (v) {
      return (v.bfl / v.ncl) * (1 - v.moist) * v.ncl / (v.solidc / 1000);
    }
  });
  computed('feso4m_kg', {
    label: 'FeSO₄ to Mn oxide bioleach', stage: 'lci', dim: 'mass_hour', unit: 'kg/h',
    svgId: 'fs_reag', hit: 'stream-reag',
    deps: ['bio_vol_mn', 'feso4m'], expr: 'bioleach volume × dose ÷ 1000',
    fn: function (v) { return v.bio_vol_mn * v.feso4m / 1000; }
  });
  computed('ealloc', {
    label: 'Electricity allocated to Mn oxides', stage: 'lci', dim: 'count', unit: '',
    deps: ['q_oven', 'mnox', 'ncl_wet', 'q_dry40', 'e_crush', 'ncl', 'e_attr', 'e_mozl', 'bcl_attr'],
    expr: 'each energy term shared out in proportion to the Mn oxide stream it serves   (MJ/h)',
    fn: function (v) {
      return v.q_oven * v.mnox / v.ncl_wet +
        (v.q_dry40 + v.e_crush) * v.mnox / v.ncl +
        (v.e_attr + v.e_mozl) * v.mnox / v.bcl_attr;
    }
  });
  computed('q_bio_mn', {
    label: 'Bioleach heating, Mn oxides', stage: 'lci', dim: 'count', unit: '',
    deps: ['bio_vol_mn', 'solidc'], expr: 'slurry mass × Cp × ΔT   (MJ/h)',
    fn: function (v) {
      return v.bio_vol_mn / 1000 *
        ((1000 - v.solidc) / 1000 * K.Cp_w + (v.solidc / 1000) * K.Cp_s) * (K.T_bio - K.T_cold);
    }
  });
  computed('q_bio_bfl', {
    label: 'Bioleach heating, BFL', stage: 'lci', dim: 'count', unit: '',
    deps: ['bio_vol_bfl', 'solidc'], expr: 'slurry mass × Cp × ΔT   (MJ/h)',
    fn: function (v) {
      return v.bio_vol_bfl / 1000 *
        ((1000 - v.solidc) / 1000 * K.Cp_w + (v.solidc / 1000) * K.Cp_s) * (K.T_bio - K.T_cold);
    }
  });
  computed('elec_tjy', {
    label: 'Electricity demand', stage: 'lci', dim: 'count', unit: '',
    deps: ['q_oven', 'q_dry40', 'e_crush', 'bcl', 'ncl', 'e_attr', 'e_mozl', 'bfl', 'moist'],
    expr: 'unallocated coarse line + bulk fine line, over 6,960 operating hours   (TJ/y)',
    fn: function (v) {
      var noalloc = (v.q_oven + v.q_dry40 + v.e_crush) * (v.bcl / v.ncl) + v.e_attr + v.e_mozl;
      var diskSpec = 10 * K.BWI_attr *
        (-1 / Math.sqrt(20 * 1000) + 1 / Math.sqrt(5 * 1000)) * 3.6 / 1000;
      var bflFrac = v.bfl / v.ncl;
      var bflDisk = bflFrac * (1 - v.moist) * v.ncl * diskSpec;
      var bflTotal = (v.q_oven + v.q_dry40 + v.e_crush) * bflFrac + bflDisk;
      return (noalloc + bflTotal) / 1e6 * OP_HRS;
    }
  });
  computed('heat_tjy', {
    label: 'Heat demand', stage: 'lci', dim: 'count', unit: '',
    deps: ['q_bio_mn', 'q_bio_bfl'], expr: '(Mn oxide + BFL bioleach heating) × 6,960 h ÷ 10⁶   (TJ/y)',
    fn: function (v) { return (v.q_bio_mn + v.q_bio_bfl) / 1e6 * OP_HRS; }
  });
  computed('reag_tpa', {
    label: 'Reagent consumption', stage: 'lci', dim: 'count', unit: '',
    deps: ['feso4m_kg', 'bio_vol_bfl', 'na2so4', 'feso4b'],
    expr: '(FeSO₄ + Na₂SO₄ across both bioleaches) × 6,960 h ÷ 1000   (t/y)',
    fn: function (v) {
      var bflNa = v.bio_vol_bfl * v.na2so4 / 1000;
      var bflFe = v.bio_vol_bfl * v.feso4b / 1000;
      return (v.feso4m_kg + bflNa + bflFe) * OP_HRS / 1000;
    }
  });
  computed('crit_tpa', {
    label: 'Critical metal streams', stage: 'lci', dim: 'count', unit: '',
    deps: ['mnox', 'bfl'], expr: '(Mn oxides + BFL) × 6,960 h ÷ 1000   (t/y)',
    fn: function (v) { return (v.mnox + v.bfl) * OP_HRS / 1000; }
  });

  /* -- Stage 3: impact assessment --------------------------------------- */
  computed('gwp_fe', {
    label: 'GWP from FeSO₄', stage: 'lcia', dim: 'count', unit: '',
    deps: ['feso4m_kg'], expr: 'FeSO₄ × 0.1704 kg CO₂e/kg   (kg CO₂e/h)',
    fn: function (v) { return v.feso4m_kg * K.ef_feso4; }
  });
  computed('gwp_el', {
    label: 'GWP from electricity', stage: 'lcia', dim: 'count', unit: '',
    deps: ['ealloc'], expr: 'allocated electricity × 0.0575 kg CO₂e/MJ   (kg CO₂e/h)',
    fn: function (v) { return v.ealloc * K.ef_elec; }
  });
  computed('gwp_ht', {
    label: 'GWP from heat', stage: 'lcia', dim: 'count', unit: '',
    deps: ['q_bio_mn'], expr: 'bioleach heat × 0.0758 kg CO₂e/MJ   (kg CO₂e/h)',
    fn: function (v) { return v.q_bio_mn * K.ef_heat; }
  });
  computed('gwp_nu', {
    label: 'GWP from nutrients', stage: 'lcia', dim: 'count', unit: '',
    deps: ['bio_vol_mn'], expr: 'bioleach volume × 0.00105 kg CO₂e/L   (kg CO₂e/h)',
    fn: function (v) { return v.bio_vol_mn * K.ef_nutrient; }
  });
  computed('gwp_sum', {
    label: 'Total GWP', stage: 'lcia', dim: 'count', unit: '',
    deps: ['gwp_fe', 'gwp_el', 'gwp_ht', 'gwp_nu'], expr: 'sum of the four contributors   (kg CO₂e/h)',
    fn: function (v) { return v.gwp_fe + v.gwp_el + v.gwp_ht + v.gwp_nu; }
  });
  computed('metal_rec', {
    label: 'Metal recovered (Al + Mn + Ni + Co)', stage: 'lcia', dim: 'mass_hour', unit: 'kg/h',
    svgId: 'fs_metal', hit: 'stream-metal',
    deps: ['mnox', 'ncl', 'moist'],
    expr: 'Σ (grade × recovery) × dry Mn oxide concentrate',
    fn: function (v) {
      var base = (v.mnox / v.ncl) * (1 - v.moist) * v.ncl;
      return (K.N_Al + K.N_Mn + K.N_Ni + K.N_Co) * base;
    }
  });
  computed('gwp_per_metal', {
    label: 'GWP per kg metal', stage: 'lcia', dim: 'gwp_intensity', unit: 'kg CO2e/kg',
    deps: ['gwp_sum', 'metal_rec'], expr: 'total GWP ÷ metal recovered',
    fn: function (v) { return v.gwp_sum / v.metal_rec; }
  });

  /* -- Stage 4: capital cost -------------------------------------------- */
  computed('equip_cost', {
    label: 'Delivered equipment cost', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['ncl_wet', 'ncl', 'bfl', 'bcl_attr', 'bcl_mozl', 'mnox'],
    expr: 'Σ  base × (size ÷ base size)ⁿ × (CEPCI_now ÷ CEPCI_base)',
    fn: function (v) {
      var sz = {
        nclwet: v.ncl_wet, ncldry: v.ncl, bfl: v.bfl, attr: v.bcl_attr,
        mozl: v.bcl_mozl, bioleach: (v.mnox + v.bfl) / 1000
      };
      return K.capex.reduce(function (t, u) {
        var s = Math.max(0, sz[u.sk] || 0);
        var c = u.B * Math.pow(s / (u.D * 1000), u.n) * K.CEPCI / u.Ce;
        return t + (isFinite(c) ? c : 0);
      }, 0);
    }
  });
  computed('tci', {
    label: 'Total capital investment', stage: 'capex', dim: 'currency', unit: '$M',
    deps: ['equip_cost'], expr: 'Lang factor (3) × delivered equipment cost',
    fn: function (v) { return v.equip_cost * K.lang; }
  });

  /* -- Stage 5: operating cost and revenue ------------------------------ */
  input('acc', {
    label: 'Annual capital charge', stage: 'opex', dim: 'fraction', unit: 'fraction',
    default: 0.1, range: [0.05, 0.25], source: 'Fraction of total capital charged each operating year.'
  });
  input('preag', {
    label: 'Reagent price', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 260, range: [50, 2000], source: '$/kg blended across FeSO₄ and Na₂SO₄.'
  });
  input('pelec', {
    label: 'Electricity price', stage: 'opex', dim: 'count', unit: '',
    default: 0.0644, range: [0.01, 0.4], source: '$M per TJ.'
  });
  input('pheat', {
    label: 'Heat price', stage: 'opex', dim: 'count', unit: '',
    default: 0.03, range: [0.005, 0.2], source: '$M per TJ.'
  });
  input('pmet', {
    label: 'Critical metal price', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 18500, range: [2000, 60000], source: '$/kg blended across the recovered metal streams.'
  });
  input('plat', {
    label: 'Raw laterite price', stage: 'opex', dim: 'price_mass', unit: '$/kg',
    default: 75000, range: [0, 200000], source: '$/kg of ore delivered to the plant.'
  });
  input('plab', {
    label: 'Labour cost', stage: 'opex', dim: 'count', unit: '',
    default: 85000, range: [20000, 200000], source: '$ per worker per year.'
  });

  computed('vop_reag', {
    label: 'Reagent cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['reag_tpa', 'preag'], expr: 'reagent tonnes × price',
    fn: function (v) { return v.reag_tpa * (v.preag / 1000) / 1000; }
  });
  computed('vop_elec', {
    label: 'Electricity cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['elec_tjy', 'pelec'], expr: 'electricity TJ/y × price',
    fn: function (v) { return v.elec_tjy * v.pelec; }
  });
  computed('vop_heat', {
    label: 'Heat cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['heat_tjy', 'pheat'], expr: 'heat TJ/y × price',
    fn: function (v) { return v.heat_tjy * v.pheat; }
  });
  computed('var_opex', {
    label: 'Variable opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['vop_reag', 'vop_elec', 'vop_heat'], expr: 'reagents + electricity + heat',
    fn: function (v) { return v.vop_reag + v.vop_elec + v.vop_heat; }
  });
  computed('capex_ann', {
    label: 'Annualised capital', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['tci', 'acc'], expr: 'TCI × annual capital charge',
    fn: function (v) { return v.tci * v.acc; }
  });
  computed('indir_opex', {
    label: 'Indirect opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['capex_ann'], expr: '0.06 × annualised capital',
    fn: function (v) { return v.capex_ann * K.indir_frac; }
  });
  computed('lab_opex', {
    label: 'Labour cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['crit_tpa', 'plab'], expr: 'critical metal kt × 23 jobs/kt × salary × 1.9 overhead',
    fn: function (v) { return v.crit_tpa / 1000 * K.jobs_kt * v.plab * K.lab_overhead / 1e6; }
  });
  computed('feed_cost', {
    label: 'Laterite feedstock cost', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['ncl', 'plat'], expr: 'ore tonnes per year × price',
    fn: function (v) { return v.ncl * OP_HRS / 1000 * (v.plat / 1000) / 1e6; }
  });
  computed('misc_opex', {
    label: 'Miscellaneous opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['indir_opex', 'lab_opex', 'var_opex'], expr: '0.3 × (indirect + labour + variable)',
    fn: function (v) { return K.misc_frac * (v.indir_opex + v.lab_opex + v.var_opex); }
  });
  computed('tot_opex', {
    label: 'Total opex', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['indir_opex', 'lab_opex', 'var_opex', 'feed_cost', 'misc_opex'],
    expr: 'indirect + labour + variable + feedstock + miscellaneous',
    fn: function (v) {
      return v.indir_opex + v.lab_opex + v.var_opex + v.feed_cost + v.misc_opex;
    }
  });
  computed('prod_val', {
    label: 'Metal revenue', stage: 'opex', dim: 'currency', unit: '$M',
    deps: ['crit_tpa', 'pmet'], expr: 'critical metal tonnes × price',
    fn: function (v) { return v.crit_tpa * (v.pmet / 1000) / 1000; }
  });

  /* -- Stage 6: profitability ------------------------------------------- */
  input('irr', {
    label: 'Discount rate', stage: 'dcf', dim: 'fraction', unit: 'fraction',
    default: 0.1, range: [0.02, 0.3], source: 'Rate used to discount future cash flows.'
  });
  computed('tot_cost', {
    label: 'Total annual cost', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['capex_ann', 'tot_opex'], expr: 'annualised capital + total opex',
    fn: function (v) { return v.capex_ann + v.tot_opex; }
  });
  computed('net_margin', {
    label: 'Net margin', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['prod_val', 'tot_cost'], expr: 'metal revenue − total cost',
    fn: function (v) { return v.prod_val - v.tot_cost; }
  });
  computed('npv', {
    label: 'NPV over 10 years', stage: 'dcf', dim: 'currency', unit: '$M',
    deps: ['net_margin', 'irr', 'tci'], expr: '−TCI + Σ net margin ÷ (1 + r)ᵗ  for t = 1…10',
    fn: function (v) {
      var npv = -v.tci;
      for (var t = 1; t <= 10; t++) npv += v.net_margin / Math.pow(1 + v.irr, t);
      return npv;
    }
  });
  computed('msp', {
    label: 'Break-even metal price', stage: 'dcf', dim: 'price_mass', unit: '$/kg',
    deps: ['tot_cost', 'crit_tpa'], expr: 'total annual cost ÷ critical metal tonnes',
    fn: function (v) { return v.tot_cost * 1000 / v.crit_tpa * 1000; }
  });

  global.CC_MODELS.laterite = {
    id: 'laterite',
    title: 'Laterite to metal extraction',
    subtitle: 'Winning nickel, cobalt and manganese from low-grade laterite ore by bioleaching.',
    functionalUnit: '1 kg of recovered critical metal (Al + Mn + Ni + Co)',
    boundary: 'Cradle-to-gate. Starts at mined laterite ore arriving at the plant, ends at recovered metal. Excludes mining itself and downstream refining.',
    fullTool: '../../standalone/laterite-lca-tea.html',
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
        tryIt: 'This case has four saleable metals from one ore, so the functional unit lumps ' +
          'them together. Splitting the burden between co-products instead — allocation — would ' +
          'give four different numbers from exactly the same plant.'
      },
      mass: {
        tryIt: 'The size fractions are fixed ratios of the feed, so click the ore stream and ' +
          'change the throughput: everything scales together and the split never moves. Now ' +
          'raise the moisture from 25% to 40% — the dry flows are untouched, but look at what ' +
          'happens to the drying energy in the next step.'
      },
      lci: {
        tryIt: 'Drop the bioleach solid concentration from 50 to 20 g/L and re-run. More water ' +
          'per kilogram of ore means more slurry to heat, and the heat demand climbs sharply for ' +
          'no extra metal.'
      },
      lcia: {
        tryIt: 'Look at which of the four contributors dominates. Then cut the FeSO₄ dose to the ' +
          'Mn oxide bioleach from 25 to 10 g/L and re-run to see how much of the footprint is ' +
          'one reagent.'
      },
      capex: {
        tryIt: 'Every unit is scaled with the six-tenths rule from a 33.5 t/h reference plant. ' +
          'Multiply the ore feed by ten and watch capital rise by roughly six times, not ten — ' +
          'that gap is the economy of scale.'
      },
      opex: {
        tryIt: 'Set the raw laterite price to zero, as if the ore were a mine waste stream rather ' +
          'than a purchased feed. For a low-grade resource that single assumption often decides ' +
          'the whole case.'
      },
      dcf: {
        tryIt: 'Compare the break-even metal price against the $18.50/kg assumed. If break-even ' +
          'sits above the market price, the process needs either a richer ore or a cheaper feed.'
      },
      interpret: {
        tryIt: 'Ore grade, moisture and feed price dominate here. Note that two of the three are ' +
          'properties of the deposit, not choices the designer gets to make.'
      }
    },
    /* Guided Mode script. One prescribed task per step, each checkable from
       engine state so "Next" cannot be reached by clicking around it:
         check: 'solved'  -- the stage must have been run and not be stale
         set:             -- a value the learner must enter first
         focus:           -- the only inputs and flowsheet parts left reachable
       Keep every task to a single action; two actions in one step is the
       confusion this mode exists to remove. */
    guided: {
      scope: {
        task: 'Read the functional unit and the system boundary below. Every number ' +
          'you are about to calculate is "per 1 kg of recovered metal, cradle to gate" — ' +
          'change either line and every result changes with it.',
        ackRequired: true,
        ackLabel: 'I have read the scope',
        expect: 'Good. Those two declarations are what make this study comparable to another.'
      },
      mass: {
        task: 'Press "Do mass balance" to split the ore feed into its size fractions.',
        check: 'solved',
        focus: ['ncl', 'moist'],
        expect: 'The ore balance closure below should read close to 0% error — every ' +
          'kilogram in has been accounted for on the way out.'
      },
      lci: {
        task: 'Press "Build inventory" to divide the plant-scale flows down to one ' +
          'functional unit.',
        check: 'solved',
        focus: ['solidc'],
        expect: 'These are now per-kilogram numbers, which is what makes this plant ' +
          'comparable with a laboratory process.'
      },
      lcia: {
        task: 'Press "Run impact assessment" to turn that inventory into kg CO₂ eq.',
        check: 'solved',
        focus: ['feso4m'],
        expect: 'Note how much of the total sits in one reagent rather than in energy.'
      },
      capex: {
        task: 'Press "Estimate CAPEX" to scale the equipment cost from the reference plant.',
        check: 'solved',
        focus: ['ncl'],
        expect: 'Capital rose less than proportionally with size — that gap is the ' +
          'economy of scale the six-tenths rule describes.'
      },
      opex: {
        task: 'Press "Cost the operation" to add up a year of running cost and revenue.',
        check: 'solved',
        focus: ['pmet', 'plat'],
        expect: 'Feedstock price is doing a lot of the work here. Hold that thought.'
      },
      dcf: {
        task: 'Press "Run cash flow" to discount those cash flows and get NPV and a ' +
          'minimum selling price.',
        check: 'solved',
        focus: ['irr'],
        expect: 'The minimum selling price is the number to quote: it compares directly ' +
          'against the market price of the metal.'
      },
      interpret: {
        task: 'Now test one assumption. Set the moisture content to 40% — go back to the ' +
          'mass balance step and re-run every step from there — then come back and see ' +
          'which results moved.',
        set: { var: 'moist', to: 40, unit: '%' },
        focus: ['moist'],
        expect: 'Drying energy climbed, and the footprint with it, for exactly the same ' +
          'metal out. That is what a sensitivity analysis is: one input at a time.'
      }
    },

    /* Practice questions, listed under Goal & scope in Expert Mode. Each one is
       answerable by changing a single input and re-running. */
    questions: [
      {
        ask: 'What happens to the carbon footprint if the ore arrives wetter — 40% moisture instead of 25%?',
        how: 'Set Moisture content to 40% on the mass balance step, then re-run every step ' +
          'from the mass balance onwards.',
        watch: 'GWP per kg of metal. The dry flows are untouched, so the whole change comes ' +
          'from evaporating water that was never going to become product.'
      },
      {
        ask: 'How much of the footprint is one reagent?',
        how: 'On the inventory step, cut the FeSO₄ dose to the Mn oxide bioleach from 25 to ' +
          '10 g/L, then re-run the inventory and the impact assessment.',
        watch: 'GWP per kg of metal against the reagent contribution — if the total moves ' +
          'sharply, the study is really a study of that reagent.'
      },
      {
        ask: 'Does bioleaching more dilute slurry cost anything?',
        how: 'Drop the bioleach solid concentration from 50 to 20 g/L and re-run from the ' +
          'inventory step.',
        watch: 'Heat demand. More water per kilogram of ore means more slurry to hold at ' +
          '46 °C, for no extra metal.'
      },
      {
        ask: 'Is this process viable at ten times the scale?',
        how: 'Multiply the raw laterite feed by ten on the mass balance step and re-run ' +
          'every step.',
        watch: 'TCI against throughput. Capital should rise roughly six-fold, not ten-fold.'
      },
      {
        ask: 'What if the ore were a mine waste stream rather than a purchased feed?',
        how: 'Set the raw laterite price to 0 $/kg on the operating cost step and re-run ' +
          'the operating cost and cash flow steps.',
        watch: 'Minimum selling price. For a low-grade resource this single assumption ' +
          'often decides the whole case.'
      },
      {
        ask: 'At what metal price does this process break even?',
        how: 'Run every step, then compare the minimum selling price against the $18.50/kg ' +
          'assumed market price.',
        watch: 'If break-even sits above the market price, the process needs a richer ore ' +
          'or a cheaper feed — not a better plant.'
      }
    ],

    closure: {
      mass: {
        label: 'Ore balance closure',
        unit: 'kg/h',
        in: ['ncl'],
        out: ['bfl', 'bcl_stor', 'bcl_attr'],
        tolerance: 0.001
      }
    },
    kpis: ['metal_rec', 'gwp_per_metal', 'tci', 'msp', 'net_margin', 'npv']
  };
})(typeof window !== 'undefined' ? window : globalThis);
