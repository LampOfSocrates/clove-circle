(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    root.LateriteCaseStudy = api;

    const boot = () => {
      if (document.getElementById('laterite-feed')) {
        api.initLateriteCaseStudy();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DEFAULTS = {
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
  };

  const K = {
    T_cold: 25,
    T_oven: 100,
    T_dry40: 40,
    T_bio: 46,
    Cp_w: 4.18,
    Cp_s: 0.9,
    H_evap: 2257,
    eff_oven: 0.65,
    BWI_crush: 12,
    crush_in: 100,
    crush_out: 20,
    BWI_attr: 14,
    mozl_kWht: 1.3,
    ef_feso4: 0.17035817,
    ef_elec: 0.0575,
    ef_heat: 0.075791799,
    ef_nutrient: 0.0010499693,
    f_bfl: 20 / 360,
    f_bcl_stor: 268 / 360,
    f_bcl_attr: 72 / 360,
    f_bcl_fine: 69 / 360,
    f_bcl_mozl: 1.7 / 360,
    f_heav: 0.6 / 360,
    CEPCI: 820,
    op_days: 290,
    lang: 3,
    indir_frac: 0.06,
    lab_overhead: 1.9,
    jobs_kt: 23,
    misc_frac: 0.3,
    mnox_meta: {
      Fe: { wt: 20.3, N: null, rec_pct: null },
      Al: { wt: 9.2, N: (9.2 / 100) * (38.5 / 100), rec_pct: 38.5 },
      Mn: { wt: 11.8, N: (11.8 / 100) * (94.6 / 100), rec_pct: 94.6 },
      Cr: { wt: 8.8, N: null, rec_pct: null },
      Mg: { wt: 1.2, N: null, rec_pct: null },
      Ni: { wt: 1.7, N: (1.7 / 100) * (79.9 / 100), rec_pct: 79.9 },
      Co: { wt: 2.3, N: (0.4 / 100) * (87.2 / 100), rec_pct: 87.2 },
      Si: { wt: 0.4, N: null, rec_pct: null },
    },
    bfl_meta: {
      Fe: { wt: () => (69 * 2 * 56) / (2 * 56 + 16 * 3), N: null, rec_pct: null },
      Al: {
        wt: () => (5.5 * 27 * 2) / (27 * 2 + 3 * 16),
        N: () => ((5.5 * 27 * 2) / (27 * 2 + 3 * 16) / 100) * (13.8 / 100),
        rec_pct: 13.8,
      },
      Mn: {
        wt: () => (1.19 * 57) / (57 + 16),
        N: () => ((1.19 * 57) / (57 + 16) / 100) * (83.9 / 100),
        rec_pct: 83.9,
      },
      Cr: {
        wt: () => (2.95 * 2 * 52) / (2 * 52 + 3 * 16),
        N: () => ((2.95 * 2 * 52) / (2 * 52 + 3 * 16) / 100) * (3 / 100),
        rec_pct: 3,
      },
      Mg: { wt: () => (0.47 * 24) / (24 + 16), N: null, rec_pct: null },
      Ni: {
        wt: () => (13450 / 1e6) * 100,
        N: () => (((13450 / 1e6) * 100) / 100) * (8.8 / 100),
        rec_pct: 8.8,
      },
      Co: {
        wt: () => (1640 / 1e6) * 100,
        N: () => ((2.15 * 28) / (28 + 32) / 100) * (79.1 / 100),
        rec_pct: 79.1,
      },
      Si: { wt: () => (2.15 * 28) / (28 + 2 * 16), N: null, rec_pct: null },
    },
    capex: [
      { name: 'Oven drying', B: 7.6, n: 0.8, D: 33.5, Ce: 394.3, sk: 'nclwet' },
      { name: 'Drying at 40 C', B: 7.6, n: 0.8, D: 33.5, Ce: 394.3, sk: 'ncldry' },
      { name: 'Crushing to 20 mm', B: 0.41, n: 0.6, D: 33.5, Ce: 394.3, sk: 'ncldry' },
      { name: 'Disk milling', B: 0.41, n: 0.6, D: 33.5, Ce: 394.3, sk: 'bfl' },
      { name: 'Attrition and wet sieving', B: 0.41, n: 0.6, D: 33.5, Ce: 394.3, sk: 'attr' },
      { name: 'Mozley gravity separation', B: 0.41, n: 0.6, D: 33.5, Ce: 394.3, sk: 'mozl' },
      { name: 'Storage', B: 1.0, n: 0.65, D: 33.5, Ce: 394.3, sk: 'ncldry' },
      { name: 'Bioleaching', B: 2.96, n: 0.7, D: 18.5, Ce: 402, sk: 'bioleach' },
    ],
  };

  function pickNumber(raw, keys, fallback) {
    for (const key of keys) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return fallback;
  }

  function normaliseInputs(raw = {}) {
    return {
      feed: pickNumber(raw, ['feed', 'NCL'], DEFAULTS.feed),
      moisture: pickNumber(raw, ['moisture', 'moist'], DEFAULTS.moisture),
      solids: pickNumber(raw, ['solids', 'solidC'], DEFAULTS.solids),
      na2so4: pickNumber(raw, ['na2so4'], DEFAULTS.na2so4),
      feso4b: pickNumber(raw, ['feso4b'], DEFAULTS.feso4b),
      feso4m: pickNumber(raw, ['feso4m', 'feso4'], DEFAULTS.feso4m),
      acc: pickNumber(raw, ['acc'], DEFAULTS.acc),
      irr: pickNumber(raw, ['irr'], DEFAULTS.irr),
      reagentPrice: pickNumber(raw, ['reagentPrice', 'pReag'], DEFAULTS.reagentPrice),
      electricityPrice: pickNumber(raw, ['electricityPrice', 'pElec'], DEFAULTS.electricityPrice),
      heatPrice: pickNumber(raw, ['heatPrice', 'pHeat'], DEFAULTS.heatPrice),
      metalPrice: pickNumber(raw, ['metalPrice', 'pMet'], DEFAULTS.metalPrice),
      lateritePrice: pickNumber(raw, ['lateritePrice', 'pLat'], DEFAULTS.lateritePrice),
      labourCost: pickNumber(raw, ['labourCost', 'laborCost', 'pLab'], DEFAULTS.labourCost),
    };
  }

  function calculateLateriteModel(raw = {}) {
    const input = normaliseInputs(raw);
    const NCL = input.feed;
    const moist = input.moisture;
    const solidC = input.solids;
    const na2so4 = input.na2so4;
    const feso4b = input.feso4b;
    const feso4m = input.feso4m;
    const acc = input.acc;
    const irr = input.irr;
    const pReag = input.reagentPrice;
    const pElec = input.electricityPrice;
    const pHeat = input.heatPrice;
    const pMet = input.metalPrice;
    const pLat = input.lateritePrice;
    const pLab = input.labourCost;

    const errors = [];
    if (!(NCL > 0)) errors.push('Dry feed must be greater than zero.');
    if (!(moist >= 0 && moist < 100)) errors.push('Moisture must be between 0 and 100.');
    if (!(solidC > 0)) errors.push('Solids concentration must be greater than zero.');

    const mf = moist / 100;
    const df = 1 - mf;
    const opHours = K.op_days * 24;

    const nclWet = NCL / df;
    const bfl = K.f_bfl * NCL;
    const bcl = NCL - bfl;
    const bclStor = K.f_bcl_stor * NCL;
    const bclAttr = K.f_bcl_attr * NCL;
    const bclFine = K.f_bcl_fine * NCL;
    const bclMozl = K.f_bcl_mozl * NCL;
    const heav = K.f_heav * NCL;
    const mnox = bclAttr - bclFine - heav;
    const mnoxFrac = NCL > 0 ? mnox / NCL : 0;
    const bflFrac = NCL > 0 ? bfl / NCL : 0;

    const qMsens = mf * K.Cp_w * (K.T_oven - K.T_cold) * NCL;
    const qMevap = mf * K.H_evap * NCL;
    const qSsens = df * K.Cp_s * (K.T_oven - K.T_cold) * NCL;
    const qOven = (qMsens + qMevap + qSsens) / K.eff_oven / 1000;
    const qDry40 = NCL * df * (K.T_dry40 - K.T_cold) * K.Cp_s / 1000;
    const eCrushSpec = 10 * K.BWI_crush * (-1 / Math.sqrt(K.crush_in * 1000) + 1 / Math.sqrt(K.crush_out * 1000)) * 3.6 / 1000;
    const eCrush = eCrushSpec * df * NCL;
    const ff = bclFine / NCL;
    const fm = bclMozl / NCL;
    const fc = (bclAttr - bclFine - bclMozl) / NCL;
    const eAttr = 10 * K.BWI_attr * (
      (-1 / Math.sqrt(20 * 1000) + 1 / Math.sqrt(0.25 * 1000)) * fm +
      (-1 / Math.sqrt(20 * 1000) + 1 / Math.sqrt(0.6 * 1000)) * fc +
      (-1 / Math.sqrt(20 * 1000) + 1 / Math.sqrt(0.05 * 1000)) * ff
    ) * df * NCL * 3.6 / 1000;
    const eMozl = fm * K.mozl_kWht * 3.6 / 1000 * df * NCL;

    const electricityAllocated =
      (nclWet > 0 ? qOven * mnox / nclWet : 0) +
      (NCL > 0 ? (qDry40 + eCrush) * mnox / NCL : 0) +
      (bclAttr > 0 ? (eAttr + eMozl) * mnox / bclAttr : 0);

    const bioleachVolumeMn = solidC > 0 ? mnoxFrac * df * NCL / (solidC / 1000) : 0;
    const feso4MnKg = bioleachVolumeMn * feso4m / 1000;
    const qBioMn = bioleachVolumeMn / 1000 * ((1000 - solidC) / 1000 * K.Cp_w + (solidC / 1000) * K.Cp_s) * (K.T_bio - K.T_cold);

    const gwpFe = feso4MnKg * K.ef_feso4;
    const gwpElectricity = electricityAllocated * K.ef_elec;
    const gwpHeat = qBioMn * K.ef_heat;
    const gwpNutrient = bioleachVolumeMn * K.ef_nutrient;
    const totalGwpPerHour = gwpFe + gwpElectricity + gwpHeat + gwpNutrient;
    const totalPerKgNcl = NCL > 0 ? totalGwpPerHour / NCL : 0;

    const mnoxRows = Object.entries(K.mnox_meta).map(([metal, data]) => {
      const recoveredKgPerKg = data.N;
      const recoveredKgPerHour = recoveredKgPerKg !== null ? recoveredKgPerKg * mnoxFrac * df * NCL : null;
      return {
        metal,
        wt: data.wt,
        recoveryPct: data.rec_pct,
        recoveredKgPerKg,
        recoveredKgPerHour,
      };
    });

    const bflRows = Object.entries(K.bfl_meta).map(([metal, data]) => {
      const wt = data.wt();
      const recoveredKgPerKg = data.N ? data.N() : null;
      const recoveredKgPerHour = recoveredKgPerKg !== null ? recoveredKgPerKg * bflFrac * df * NCL : null;
      return {
        metal,
        wt,
        recoveryPct: data.rec_pct,
        recoveredKgPerKg,
        recoveredKgPerHour,
      };
    });

    const alRec = K.mnox_meta.Al.N * mnoxFrac * df * NCL;
    const mnRec = K.mnox_meta.Mn.N * mnoxFrac * df * NCL;
    const niRec = K.mnox_meta.Ni.N * mnoxFrac * df * NCL;
    const coRec = K.mnox_meta.Co.N * mnoxFrac * df * NCL;
    const totalRecovered = alRec + mnRec + niRec + coRec;
    const gwpPerRecoveredMetal = totalRecovered > 0 ? totalPerKgNcl * NCL / totalRecovered : 0;
    const allocatedMn = mnRec > 0 ? gwpPerRecoveredMetal * totalRecovered / mnRec / 3 : 0;
    const allocatedNi = niRec > 0 ? gwpPerRecoveredMetal * totalRecovered / niRec / 3 : 0;
    const allocatedCo = coRec > 0 ? gwpPerRecoveredMetal * totalRecovered / coRec / 3 : 0;

    const noallocB27 = NCL > 0 ? (qOven + qDry40 + eCrush) * (bcl / NCL) + eAttr + eMozl : 0;
    const eDiskSpec = 10 * K.BWI_attr * (-1 / Math.sqrt(20 * 1000) + 1 / Math.sqrt(5 * 1000)) * 3.6 / 1000;
    const bflB19 = bflFrac * df * NCL * eDiskSpec;
    const bflB31 = (qOven + qDry40 + eCrush) * bflFrac + bflB19;
    const electricityTJy = (noallocB27 + bflB31) / 1e6 * opHours;
    const bioleachVolumeBfl = solidC > 0 ? bflFrac * df * NCL / (solidC / 1000) : 0;
    const qBioBfl = bioleachVolumeBfl / 1000 * ((1000 - solidC) / 1000 * K.Cp_w + (solidC / 1000) * K.Cp_s) * (K.T_bio - K.T_cold);
    const heatTJy = (qBioMn + qBioBfl) / 1e6 * opHours;
    const bflB34 = bioleachVolumeBfl * na2so4 / 1000;
    const bflB35 = bioleachVolumeBfl * feso4b / 1000;
    const reagentsTpa = (feso4MnKg + bflB34 + bflB35) * opHours / 1000;

    const reagentOpex = reagentsTpa * pReag / 1000;
    const electricityOpex = electricityTJy * pElec;
    const heatOpex = heatTJy * pHeat;
    const variableOpex = reagentOpex + electricityOpex + heatOpex;

    const sizeMap = {
      nclwet: nclWet,
      ncldry: NCL,
      bfl,
      attr: bclAttr,
      mozl: bclMozl,
      bioleach: (mnox + bfl) / 1000,
    };

    const capexRows = K.capex.map((unit) => {
      const size = Math.max(0, sizeMap[unit.sk] || 0);
      const cost = unit.B * Math.pow(size / (unit.D * 1000), unit.n) * K.CEPCI / unit.Ce;
      return {
        name: unit.name,
        baseCost: unit.B,
        scaleExponent: unit.n,
        currentSize: size,
        cost: Number.isFinite(cost) ? cost : 0,
      };
    });

    const deliveredCost = capexRows.reduce((sum, row) => sum + row.cost, 0);
    const totalCapitalInvestment = deliveredCost * K.lang;
    const annualCapitalCharge = totalCapitalInvestment * acc;
    const indirectOpex = annualCapitalCharge * K.indir_frac;
    const criticalMetalsTpa = (mnox / NCL + bfl / NCL) * NCL * opHours / 1000;
    const labourOpex = criticalMetalsTpa / 1000 * K.jobs_kt * pLab * K.lab_overhead / 1e6;
    const lateriteTpa = NCL * opHours / 1000;
    const feedstockOpex = lateriteTpa * pLat / 1e6;
    const miscOpex = K.misc_frac * (indirectOpex + labourOpex + variableOpex);
    const totalOpex = indirectOpex + labourOpex + variableOpex + feedstockOpex + miscOpex;
    const totalCost = annualCapitalCharge + totalOpex;
    const productValue = criticalMetalsTpa * pMet / 1000;
    const netMargin = productValue - totalCost;

    const npvRows = [];
    let npv = -totalCapitalInvestment;
    npvRows.push({ year: 0, cashFlow: -totalCapitalInvestment, npv });
    for (let year = 1; year <= 10; year += 1) {
      const cashFlow = netMargin / Math.pow(1 + irr, year);
      npv += cashFlow;
      npvRows.push({ year, cashFlow, npv });
    }

    return {
      errors,
      input,
      mass: {
        nclWet,
        bcl,
        bfl,
        bclStor,
        bclAttr,
        bclFine,
        bclMozl,
        heav,
        mnox,
        mnoxFrac,
        bflFrac,
      },
      metals: {
        mnoxRows,
        bflRows,
        alRec,
        mnRec,
        niRec,
        coRec,
        totalRecovered,
      },
      gwp: {
        qOven,
        electricityAllocated,
        bioleachVolumeMn,
        feso4MnKg,
        qBioMn,
        gwpFe,
        gwpElectricity,
        gwpHeat,
        gwpNutrient,
        totalPerHour: totalGwpPerHour,
        totalPerKgNcl,
        totalPerRecoveredMetal: gwpPerRecoveredMetal,
        allocatedMn,
        allocatedNi,
        allocatedCo,
        contributorRows: [
          { label: 'Ferrous sulfate', value: gwpFe },
          { label: 'Electricity', value: gwpElectricity },
          { label: 'Heating', value: gwpHeat },
          { label: 'Nutrient medium', value: gwpNutrient },
        ],
      },
      tea: {
        capexRows,
        deliveredCost,
        totalCapitalInvestment,
        annualCapitalCharge,
        indirectOpex,
        labourOpex,
        feedstockOpex,
        reagentOpex,
        electricityOpex,
        heatOpex,
        variableOpex,
        miscOpex,
        totalOpex,
        totalCost,
        productValue,
        netMargin,
        reagentsTpa,
        electricityTJy,
        heatTJy,
        lateriteTpa,
        criticalMetalsTpa,
        npv10: npvRows[npvRows.length - 1].npv,
        npvRows,
      },
    };
  }

  function fmtNumber(value, digits) {
    if (!Number.isFinite(value)) return '--';
    return Number(value).toLocaleString('en-GB', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function fmtMoneyM(value) {
    const sign = value < 0 ? '-' : '';
    return `${sign}$${fmtNumber(Math.abs(value), 2)}M`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderTableRows(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function renderMass(model) {
    const { mass, metals } = model;
    setText('flow-ncl-wet', fmtNumber(mass.nclWet, 1));
    setText('flow-bcl', fmtNumber(mass.bcl, 1));
    setText('flow-bfl', fmtNumber(mass.bfl, 1));
    setText('flow-attr', fmtNumber(mass.bclAttr, 1));
    setText('flow-mnox', fmtNumber(mass.mnox, 2));

    setText('mass-ncl-wet', `${fmtNumber(mass.nclWet, 2)} kg/h`);
    setText('mass-bcl', `${fmtNumber(mass.bcl, 2)} kg/h`);
    setText('mass-bfl', `${fmtNumber(mass.bfl, 2)} kg/h`);
    setText('mass-bcl-stor', `${fmtNumber(mass.bclStor, 2)} kg/h`);
    setText('mass-attr', `${fmtNumber(mass.bclAttr, 2)} kg/h`);
    setText('mass-bcl-fine', `${fmtNumber(mass.bclFine, 2)} kg/h`);
    setText('mass-bcl-mozl', `${fmtNumber(mass.bclMozl, 3)} kg/h`);
    setText('mass-heav', `${fmtNumber(mass.heav, 3)} kg/h`);
    setText('mass-mnox', `${fmtNumber(mass.mnox, 3)} kg/h`);
    setText('badge-mass', `${fmtNumber(mass.mnox, 2)} kg/h Mn-ox concentrate`);
    setText('intro-mnox', fmtNumber(mass.mnox, 2));

    renderTableRows(
      'mnox-tbody',
      metals.mnoxRows.map((row) => `
        <tr>
          <td>${row.metal}</td>
          <td class="cc-result-val">${fmtNumber(row.wt, 2)}</td>
          <td class="cc-result-val">${row.recoveryPct === null ? '--' : fmtNumber(row.recoveryPct, 1)}</td>
          <td class="cc-result-val">${row.recoveredKgPerKg === null ? '--' : fmtNumber(row.recoveredKgPerKg, 5)}</td>
          <td class="cc-result-val">${row.recoveredKgPerHour === null ? '--' : fmtNumber(row.recoveredKgPerHour, 5)}</td>
        </tr>`).join('')
    );

    renderTableRows(
      'bfl-tbody',
      metals.bflRows.map((row) => `
        <tr>
          <td>${row.metal}</td>
          <td class="cc-result-val">${fmtNumber(row.wt, 4)}</td>
          <td class="cc-result-val">${row.recoveryPct === null ? '--' : fmtNumber(row.recoveryPct, 1)}</td>
          <td class="cc-result-val">${row.recoveredKgPerKg === null ? '--' : fmtNumber(row.recoveredKgPerKg, 5)}</td>
          <td class="cc-result-val">${row.recoveredKgPerHour === null ? '--' : fmtNumber(row.recoveredKgPerHour, 5)}</td>
        </tr>`).join('')
    );
  }

  function renderTea(model) {
    const { tea } = model;
    setText('tea-revenue', `${fmtMoneyM(tea.productValue)}/y`);
    setText('tea-feed-cost', `${fmtMoneyM(tea.feedstockOpex)}/y`);
    setText('tea-reagent-opex', `${fmtMoneyM(tea.reagentOpex)}/y`);
    setText('tea-electricity-opex', `${fmtMoneyM(tea.electricityOpex)}/y`);
    setText('tea-heat-opex', `${fmtMoneyM(tea.heatOpex)}/y`);
    setText('tea-indirect-opex', `${fmtMoneyM(tea.indirectOpex)}/y`);
    setText('tea-labour-opex', `${fmtMoneyM(tea.labourOpex)}/y`);
    setText('tea-total-opex', `${fmtMoneyM(tea.totalOpex)}/y`);
    setText('tea-total-cost', `${fmtMoneyM(tea.totalCost)}/y`);
    setText('laterite-net-margin', `${fmtMoneyM(tea.netMargin)}/y`);
    setText('tea-tci', fmtMoneyM(tea.totalCapitalInvestment));
    setText('badge-tea', `TCI ${fmtMoneyM(tea.totalCapitalInvestment)}`);

    renderTableRows(
      'capex-tbody',
      tea.capexRows.map((row) => `
        <tr>
          <td>${row.name}</td>
          <td class="cc-result-val">${fmtNumber(row.baseCost, 3)}</td>
          <td class="cc-result-val">${fmtNumber(row.scaleExponent, 2)}</td>
          <td class="cc-result-val">${fmtNumber(row.currentSize, 3)}</td>
          <td class="cc-result-val">${fmtNumber(row.cost, 5)}</td>
        </tr>`).join('')
    );

    renderTableRows(
      'dcf-tbody',
      tea.npvRows.map((row) => `
        <tr class="${row.npv >= 0 ? 'cc-result-highlight' : ''}">
          <td>${row.year}</td>
          <td class="cc-result-val">${fmtMoneyM(row.cashFlow)}</td>
          <td class="cc-result-val">${fmtMoneyM(row.npv)}</td>
        </tr>`).join('')
    );
  }

  function renderGwp(model) {
    const { gwp, metals } = model;
    renderTableRows(
      'gwp-tbody',
      gwp.contributorRows.map((row) => `
        <tr>
          <td>${row.label}</td>
          <td class="cc-result-val">${fmtNumber(row.value, 5)}</td>
        </tr>`).join('')
    );

    setText('gwp-total', fmtNumber(gwp.totalPerKgNcl, 7));
    setText('gwp-total-big', fmtNumber(gwp.totalPerKgNcl, 7));
    setText('alloc-mn', `${fmtNumber(gwp.allocatedMn, 4)} kg CO2e/kg Mn`);
    setText('alloc-ni', `${fmtNumber(gwp.allocatedNi, 4)} kg CO2e/kg Ni`);
    setText('alloc-co', `${fmtNumber(gwp.allocatedCo, 4)} kg CO2e/kg Co`);
    setText('rec-mn', fmtNumber(metals.mnRec, 5));
    setText('rec-ni', fmtNumber(metals.niRec, 5));
    setText('rec-co', fmtNumber(metals.coRec, 5));
    setText('rec-al', fmtNumber(metals.alRec, 5));
    setText('rec-total', fmtNumber(metals.totalRecovered, 5));
    setText('badge-gwp', `${fmtNumber(gwp.totalPerKgNcl, 4)} kg CO2e/kg NCL`);
  }

  function renderKpis(model) {
    const { tea, gwp } = model;
    setText('kpi-capex', fmtMoneyM(tea.totalCapitalInvestment));
    setText('kpi-cf', `${fmtMoneyM(tea.netMargin)}/y`);
    setText('kpi-npv', fmtMoneyM(tea.npv10));
    setText('kpi-gwp', `${fmtNumber(gwp.totalPerKgNcl, 4)} kg CO2e/kg`);
  }

  let npvChart = null;
  let gwpChart = null;

  function initCharts() {
    if (typeof Chart === 'undefined') return;

    const npvCanvas = document.getElementById('npvChart');
    if (npvCanvas && !npvChart) {
      npvChart = new Chart(npvCanvas, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Cumulative NPV (M$)',
            data: [],
            borderColor: '#40916c',
            backgroundColor: 'rgba(64,145,108,0.08)',
            fill: true,
            tension: 0.28,
            pointRadius: 4,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#f0faf4' } },
            y: { grid: { color: '#d8f3dc' } },
          },
        },
      });
    }

    const gwpCanvas = document.getElementById('gwpChart');
    if (gwpCanvas && !gwpChart) {
      gwpChart = new Chart(gwpCanvas, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{
            label: 'kg CO2e/h',
            data: [],
            backgroundColor: 'rgba(64,145,108,0.75)',
            borderColor: '#40916c',
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#f0faf4' } },
            y: { grid: { display: false } },
          },
        },
      });
    }
  }

  function updateCharts(model) {
    if (npvChart) {
      npvChart.data.labels = model.tea.npvRows.map((row) => `Yr ${row.year}`);
      npvChart.data.datasets[0].data = model.tea.npvRows.map((row) => row.npv);
      npvChart.update('none');
    }

    if (gwpChart) {
      gwpChart.data.labels = model.gwp.contributorRows.map((row) => row.label);
      gwpChart.data.datasets[0].data = model.gwp.contributorRows.map((row) => row.value);
      gwpChart.update('none');
    }
  }

  function readDomInputs() {
    return {
      feed: document.getElementById('laterite-feed').value,
      moisture: document.getElementById('laterite-moisture').value,
      solids: document.getElementById('laterite-solids').value,
      na2so4: document.getElementById('laterite-na2so4').value,
      feso4b: document.getElementById('laterite-feso4b').value,
      feso4m: document.getElementById('laterite-feso4m').value,
      acc: document.getElementById('laterite-acc').value,
      irr: document.getElementById('laterite-irr').value,
      reagentPrice: document.getElementById('laterite-reagent-price').value,
      electricityPrice: document.getElementById('laterite-electricity-price').value,
      heatPrice: document.getElementById('laterite-heat-price').value,
      metalPrice: document.getElementById('laterite-metal-price').value,
      lateritePrice: document.getElementById('laterite-laterite-price').value,
      labourCost: document.getElementById('laterite-labour-cost').value,
    };
  }

  function applyDefaultsToDom() {
    const mapping = {
      'laterite-feed': DEFAULTS.feed,
      'laterite-moisture': DEFAULTS.moisture,
      'laterite-solids': DEFAULTS.solids,
      'laterite-na2so4': DEFAULTS.na2so4,
      'laterite-feso4b': DEFAULTS.feso4b,
      'laterite-feso4m': DEFAULTS.feso4m,
      'laterite-acc': DEFAULTS.acc,
      'laterite-irr': DEFAULTS.irr,
      'laterite-reagent-price': DEFAULTS.reagentPrice,
      'laterite-electricity-price': DEFAULTS.electricityPrice,
      'laterite-heat-price': DEFAULTS.heatPrice,
      'laterite-metal-price': DEFAULTS.metalPrice,
      'laterite-laterite-price': DEFAULTS.lateritePrice,
      'laterite-labour-cost': DEFAULTS.labourCost,
    };

    Object.entries(mapping).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
  }

  function recalculateAndRender() {
    const model = calculateLateriteModel(readDomInputs());
    renderMass(model);
    renderTea(model);
    renderGwp(model);
    renderKpis(model);
    updateCharts(model);
  }

  function initLateriteCaseStudy() {
    initCharts();
    applyDefaultsToDom();
    recalculateAndRender();

    const inputIds = [
      'laterite-feed',
      'laterite-moisture',
      'laterite-solids',
      'laterite-na2so4',
      'laterite-feso4b',
      'laterite-feso4m',
      'laterite-acc',
      'laterite-irr',
      'laterite-reagent-price',
      'laterite-electricity-price',
      'laterite-heat-price',
      'laterite-metal-price',
      'laterite-laterite-price',
      'laterite-labour-cost',
    ];

    inputIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', recalculateAndRender);
      }
    });

    const resetBtn = document.getElementById('laterite-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        applyDefaultsToDom();
        recalculateAndRender();
      });
    }
  }

  return {
    DEFAULTS,
    calculateLateriteModel,
    initLateriteCaseStudy,
  };
});
