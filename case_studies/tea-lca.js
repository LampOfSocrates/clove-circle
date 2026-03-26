/* =============================================================
   tea-lca.js  —  Interactive TEA + LCA Calculator
   Clove Circle | Biorefinery PHA Biocomposite Case Study
   ============================================================= */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     STATE — all default values mirror the spreadsheet
  ---------------------------------------------------------- */
  const STATE = {
    // Sheet 1: Balance inputs
    biomass:       3500,
    hemiPct:       30,
    cellPct:       46,
    lignPct:       20,
    ashPct:        4,
    hemiRec:       0.95,
    cellRec:       0.87,
    lignRec:       0.79,
    chpEff:        0.35,
    biocompRate:   95.358,
    years:         20,
    finalConv:     0.35,

    // Sheet 2: TEA — capital cost parameters
    cepci:         820,
    opDays:        290,
    tciMult:       3,

    // Sheet 2: TEA — operating economics
    prodPrice:     7000,    // $/t
    feedPrice:     100,     // $/t
    reagentCost:   0.26,    // $/kg
    elecFactor:    1.232,   // $/MJ
    heatFactor:    0.294,   // $/MJ
    indirectRate:  0.06,    // fraction of TCI/year
    laborCost:     85000,   // $/FTE/year
    jobs:          23,
    discount:      0.10,
    period:        10,

    // Equipment rows: { name, baseCost ($M), scaleFactor, baseSize, baseCepci, sizeKey, sizeUnit }
    // sizeKey maps to a function in sizeCalc
    equipment: [
      { name: 'Inoculation',          baseCost: 0.26,   scaleFactor: 0.6,  baseSize: 3.53,   baseCepci: 402,   sizeKey: 'fermLine', sizeUnit: 'tph' },
      { name: 'Fermenters',           baseCost: 0.67,   scaleFactor: 0.8,  baseSize: 1.04,   baseCepci: 402,   sizeKey: 'fermLine', sizeUnit: 'tph' },
      { name: 'Centrifugation',       baseCost: 2.92,   scaleFactor: 0.7,  baseSize: 18.466, baseCepci: 402,   sizeKey: 'fermLine', sizeUnit: 'tph' },
      { name: 'Solvent extraction',   baseCost: 2.96,   scaleFactor: 0.7,  baseSize: 18.466, baseCepci: 402,   sizeKey: 'fermLine', sizeUnit: 'tph' },
      { name: 'Washing',             baseCost: 0.41,   scaleFactor: 1.0,  baseSize: 33.5,   baseCepci: 394.3, sizeKey: 'fermLine', sizeUnit: 'tph' },
      { name: 'Drying',              baseCost: 7.60,   scaleFactor: 0.8,  baseSize: 33.5,   baseCepci: 394.3, sizeKey: 'fermLine', sizeUnit: 'tph' },
      { name: 'Anaerobic digestion', baseCost: 1.54,   scaleFactor: 0.6,  baseSize: 43.0,   baseCepci: 402,   sizeKey: 'anDigest', sizeUnit: 'tph ww' },
      { name: 'CHP system',          baseCost: 1.00,   scaleFactor: 1.0,  baseSize: 5.0,    baseCepci: 820,   sizeKey: 'chp',      sizeUnit: 'GWh' },
      { name: 'Twin-screw extrusion',baseCost: 14.10,  scaleFactor: 0.78, baseSize: 83.3,   baseCepci: 402,   sizeKey: 'extrude',  sizeUnit: 'tph' },
      { name: 'Injection moulding',  baseCost: 5.62,   scaleFactor: 0.78, baseSize: 83.3,   baseCepci: 402,   sizeKey: 'extrude',  sizeUnit: 'tph' },
      { name: '3D printing',         baseCost: 0.0779, scaleFactor: 1.0,  baseSize: 1.0,    baseCepci: 820,   sizeKey: 'product',  sizeUnit: 'tph' },
      { name: 'Biomass handling',    baseCost: 0.1039, scaleFactor: 1.0,  baseSize: 1.0,    baseCepci: 820,   sizeKey: 'product',  sizeUnit: 'tph' },
      { name: 'Biomass pretreatment',baseCost: 0.0779, scaleFactor: 1.0,  baseSize: 1.0,    baseCepci: 820,   sizeKey: 'product',  sizeUnit: 'tph' },
    ],

    // Sheet 3: GWP rows
    // { name, qty, qtyUnit, gwpFactor, gwpUnit, isReagent }
    // isReagent=true rows contribute to reagent OpEx mass sum
    gwpRows: [
      { name: 'Monoammonium phosphate', qty: 0.400,    qtyUnit: 'kg/kg',    gwpFactor: 1.3132,   gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Sodium phosphate',       qty: 0.145,    qtyUnit: 'kg/kg',    gwpFactor: 2.8195,   gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Transport',              qty: 2.200,    qtyUnit: 'ktkm/kg',  gwpFactor: 0.07121,  gwpUnit: 'kg CO\u2082e/ktkm',  isReagent: false },
      { name: 'Ammonium chloride',      qty: 0.115,    qtyUnit: 'kg/kg',    gwpFactor: 0.91980,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Magnesium sulphate',     qty: 0.100,    qtyUnit: 'kg/kg',    gwpFactor: 0.85517,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Citric acid',            qty: 0.050,    qtyUnit: 'kg/kg',    gwpFactor: 1.60148,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Sodium hydroxide',       qty: 0.025,    qtyUnit: 'kg/kg',    gwpFactor: 1.35400,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Sulfuric acid',          qty: 0.200,    qtyUnit: 'kg/kg',    gwpFactor: 0.16710,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Manganese',              qty: 0.0025,   qtyUnit: 'kg/kg',    gwpFactor: 6.15451,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Lime',                   qty: 0.010,    qtyUnit: 'kg/kg',    gwpFactor: 0.92369,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Calcium chloride',       qty: 0.00025,  qtyUnit: 'kg/kg',    gwpFactor: 5.57767,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Solvent',                qty: 0.000526, qtyUnit: 'kg/kg',    gwpFactor: 2.05910,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: true  },
      { name: 'Water',                  qty: 0.000500, qtyUnit: 'kg/kg',    gwpFactor: 0.82055,  gwpUnit: 'kg CO\u2082e/kg',    isReagent: false },
      { name: 'Process steam',          qty: 100.0,    qtyUnit: 'MJ/kg',    gwpFactor: 0.000541, gwpUnit: 'kg CO\u2082e/MJ',    isReagent: false },
      { name: 'Misc Opex materials',    qty: 0.110,    qtyUnit: 'kg/kg',    gwpFactor: 0.000488, gwpUnit: 'kg CO\u2082e/kg',    isReagent: false },
    ],
  };

  /* ----------------------------------------------------------
     CALCULATION FUNCTIONS (pure — no DOM reads/writes)
  ---------------------------------------------------------- */

  function calcBalance(s) {
    const hemiMass = s.hemiPct / 100 * s.biomass;
    const cellMass = s.cellPct / 100 * s.biomass;
    const lignMass = s.lignPct / 100 * s.biomass;
    const ashMass  = s.ashPct  / 100 * s.biomass;

    const hemiRec   = hemiMass * s.hemiRec;
    const cellRec   = cellMass * s.cellRec;
    const lignRec   = lignMass * s.lignRec;
    const cellLoss  = cellMass - cellRec;

    const chpFeedstock = (hemiRec + cellRec) * s.chpEff;
    const fermenterOut = lignMass + hemiRec + cellRec - cellLoss - chpFeedstock;
    const biocomposite = (chpFeedstock + cellLoss) * s.biocompRate / 100;
    const energy       = fermenterOut * s.years * s.finalConv;

    return {
      hemiMass, cellMass, lignMass, ashMass,
      hemiRec, cellRec, lignRec,
      cellLoss, chpFeedstock, fermenterOut, biocomposite, energy,
    };
  }

  function calcGWP(s) {
    const rows = s.gwpRows.map(r => ({
      ...r,
      gwp: r.qty * r.gwpFactor,
    }));
    const total = rows.reduce((sum, r) => sum + r.gwp, 0);
    // reagent quantity sum (kg per kg biocomposite) for reagent units (kg/kg only)
    const reagentQtySum = rows
      .filter(r => r.isReagent)
      .reduce((sum, r) => sum + r.qty, 0);
    // process steam qty (MJ/kg) — row index 13
    const steamQty = rows[13].qty;
    return { rows, total, reagentQtySum, steamQty };
  }

  // Equipment current-size derivation from balance outputs
  const sizeCalc = {
    fermLine:  (bal, s) => (bal.hemiRec + bal.cellRec + bal.ashMass) / s.opDays / 24,
    anDigest:  (bal, s) => (bal.biomass + bal.fermenterOut) / s.opDays / 24,
    chp:       (bal)    => bal.energy / 1000 / 3.6,
    extrude:   (bal, s) => (bal.chpFeedstock + bal.cellLoss) / s.opDays / 24,
    product:   (bal, s) => bal.biocomposite / s.opDays / 24,
  };

  function calcTEA(s, bal, gwp) {
    // --- Capital costs ---
    const equip = s.equipment.map(e => {
      const currentSize = sizeCalc[e.sizeKey](bal, s);
      const cost = e.baseCost
        * Math.pow(currentSize / e.baseSize, e.scaleFactor)
        * s.cepci / e.baseCepci;
      return { ...e, currentSize, cost };
    });
    const dce = equip.reduce((sum, e) => sum + e.cost, 0);
    const tci = dce * s.tciMult;

    // --- Revenue ---
    const revenue = bal.biocomposite * s.prodPrice / 1e6;    // M$/y

    // --- Variable OpEx ---
    const feedCost = bal.biomass * s.feedPrice / 1e6;        // M$/y

    // Reagent OpEx: reagent quantity sum (kg/kg biocomposite) × stream throughput × $/kg
    // Stream: (cellLoss + chpFeedstock) in tonnes/year → ×1000 for kg
    const reagentOpex = gwp.reagentQtySum
      * (bal.cellLoss + bal.chpFeedstock) * 1000
      * s.reagentCost / 1e6;  // M$/y

    // Electricity OpEx (net — CHP electricity offsets external purchase)
    // netElecTJ = -energy/1000 + finalConv*(cellLoss+chpFeedstock)*3.6/1000
    const netElecTJ = -bal.energy / 1000
      + s.finalConv * (bal.cellLoss + bal.chpFeedstock) * 3.6 / 1000;
    const elecOpex = netElecTJ * s.elecFactor;  // M$/y (negative = net income)

    // Heat OpEx: steam qty (MJ/kg biocomposite) × biocomposite (t/y × 1000) / 1e6 × factor
    const heatTJ   = gwp.steamQty * bal.biocomposite * 1000 / 1e6;  // TJ/y
    const heatOpex = heatTJ * s.heatFactor;  // M$/y

    // --- Fixed OpEx ---
    const indirectOpex = tci * s.indirectRate;  // M$/y
    const laborOpex    = s.jobs * s.laborCost / 1e6;  // M$/y

    const totalOpex = feedCost + reagentOpex + elecOpex + heatOpex + indirectOpex + laborOpex;
    const annualCF  = revenue - totalOpex;

    // --- Discounted Cash Flow ---
    const dcf = [];
    let npv = -tci;
    for (let yr = 1; yr <= s.period; yr++) {
      const discCF = annualCF / Math.pow(1 + s.discount, yr);
      npv += discCF;
      dcf.push({ yr, discCF, npv });
    }

    return {
      equip, dce, tci,
      revenue, feedCost, reagentOpex, elecOpex, heatOpex,
      indirectOpex, laborOpex, totalOpex, annualCF,
      dcf, npvFinal: npv,
    };
  }

  /* ----------------------------------------------------------
     CHART INSTANCES
  ---------------------------------------------------------- */
  let npvChart = null;
  let gwpChart = null;

  function initCharts() {
    const npvCtx = document.getElementById('npvChart');
    if (npvCtx) {
      npvChart = new Chart(npvCtx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Cumulative NPV ($M)',
            data: [],
            borderColor: '#40916c',
            backgroundColor: 'rgba(64,145,108,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: '#40916c',
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => `$${ctx.parsed.y.toFixed(2)}M`,
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Year', font: { size: 12 } },
              grid: { color: '#f0faf4' },
            },
            y: {
              title: { display: true, text: 'Cumulative NPV ($M)', font: { size: 12 } },
              grid: { color: '#d8f3dc' },
            },
          },
        },
      });
    }

    const gwpCtx = document.getElementById('gwpChart');
    if (gwpCtx) {
      gwpChart = new Chart(gwpCtx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{
            label: 'GWP (kg CO\u2082e/kg)',
            data: [],
            backgroundColor: 'rgba(64,145,108,0.75)',
            borderColor: '#40916c',
            borderWidth: 1,
            borderRadius: 3,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.parsed.x.toFixed(4)} kg CO\u2082e/kg`,
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'kg CO\u2082e / kg biocomposite', font: { size: 11 } },
              grid: { color: '#f0faf4' },
            },
            y: {
              ticks: { font: { size: 10 } },
            },
          },
        },
      });
    }
  }

  function updateNPVChart(dcf, tci) {
    if (!npvChart) return;
    // Prepend year-0 point (= -TCI)
    const labels = ['0', ...dcf.map(d => String(d.yr))];
    const data   = [-tci, ...dcf.map(d => d.npv)];
    npvChart.data.labels = labels;
    npvChart.data.datasets[0].data = data;
    npvChart.update('none');
  }

  function updateGWPChart(rows) {
    if (!gwpChart) return;
    gwpChart.data.labels = rows.map(r => r.name);
    gwpChart.data.datasets[0].data = rows.map(r => r.gwp);
    gwpChart.update('none');
  }

  /* ----------------------------------------------------------
     RENDER FUNCTIONS (DOM writes only)
  ---------------------------------------------------------- */

  function fmt(n, dec = 1) {
    if (!isFinite(n)) return '—';
    return Number(n).toLocaleString('en-GB', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }

  function fmtM(n) {
    // Format as $X.XXM
    const sign = n < 0 ? '−' : '';
    return `${sign}$${fmt(Math.abs(n), 2)}M`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderBalance(bal) {
    // Flow diagram
    setText('f-biomass',     fmt(bal.hemiMass + bal.cellMass + bal.lignMass + bal.ashMass, 0));
    setText('f-hemi-mass',   fmt(bal.hemiMass, 0));
    setText('f-cell-mass',   fmt(bal.cellMass, 0));
    setText('f-lign-mass',   fmt(bal.lignMass, 0));
    setText('f-hemi-rec',    fmt(bal.hemiRec, 1));
    setText('f-cell-rec',    fmt(bal.cellRec, 1));
    setText('f-lign-rec',    fmt(bal.lignRec, 1));
    setText('f-chp',         fmt(bal.chpFeedstock, 0));
    setText('f-fermenter',   fmt(bal.fermenterOut, 0));
    setText('f-biocomposite',fmt(bal.biocomposite, 0));

    // Results table
    setText('r-hemi-mass',   fmt(bal.hemiMass, 1));
    setText('r-cell-mass',   fmt(bal.cellMass, 1));
    setText('r-lign-mass',   fmt(bal.lignMass, 1));
    setText('r-ash-mass',    fmt(bal.ashMass, 1));
    setText('r-cell-loss',   fmt(bal.cellLoss, 1));
    setText('r-chp',         fmt(bal.chpFeedstock, 1));
    setText('r-fermenter',   fmt(bal.fermenterOut, 1));
    setText('r-biocomposite',fmt(bal.biocomposite, 1));
    setText('r-energy',      fmt(bal.energy, 0) + ' GJ');

    // Badge + intro box
    setText('badge-biocomposite', fmt(bal.biocomposite, 0) + ' t/y biocomposite');
    setText('intro-biocomposite', fmt(bal.biocomposite, 0));
  }

  function renderEquipTable(equip) {
    const tbody = document.getElementById('equip-tbody');
    if (!tbody) return;
    tbody.innerHTML = equip.map((e, i) => `
      <tr>
        <td>${e.name}</td>
        <td><input type="number" class="cc-input" data-row="${i}" data-field="baseCost"
                   value="${e.baseCost}" min="0" step="0.01"></td>
        <td><input type="number" class="cc-input" data-row="${i}" data-field="scaleFactor"
                   value="${e.scaleFactor}" min="0" max="2" step="0.01"></td>
        <td><input type="number" class="cc-input" data-row="${i}" data-field="baseSize"
                   value="${e.baseSize}" min="0.001" step="0.001"></td>
        <td><input type="number" class="cc-input" data-row="${i}" data-field="baseCepci"
                   value="${e.baseCepci}" min="1" step="1"></td>
        <td class="cc-unit">${e.sizeUnit}</td>
        <td style="background:var(--cc-green-xlight);font-variant-numeric:tabular-nums;font-size:12px">
          ${e.currentSize.toFixed(3)}
        </td>
        <td style="background:var(--cc-green-xlight);font-weight:600;font-variant-numeric:tabular-nums">
          $${e.cost.toFixed(3)}M
        </td>
      </tr>`).join('');
  }

  function renderTEA(tea, s) {
    // Equipment table (re-render cost + current size columns)
    const rows = document.querySelectorAll('#equip-tbody tr');
    tea.equip.forEach((e, i) => {
      if (rows[i]) {
        const cells = rows[i].querySelectorAll('td');
        if (cells[6]) cells[6].textContent = e.currentSize.toFixed(3);
        if (cells[7]) cells[7].textContent = '$' + e.cost.toFixed(3) + 'M';
      }
    });

    // Totals
    setText('t-dce',        '$' + tea.dce.toFixed(3) + 'M');
    setText('t-tci',        '$' + tea.tci.toFixed(2) + 'M');
    setText('t-tci-mult-disp', s.tciMult);

    // Summary
    setText('t-revenue',      fmtM(tea.revenue) + '/y');
    setText('t-feed-cost',    fmtM(tea.feedCost) + '/y');
    setText('t-reagent-opex', fmtM(tea.reagentOpex) + '/y');
    setText('t-elec-opex',    fmtM(tea.elecOpex) + '/y');
    setText('t-heat-opex',    fmtM(tea.heatOpex) + '/y');
    setText('t-fix-opex',     fmtM(tea.indirectOpex) + '/y');
    setText('t-labor-opex',   fmtM(tea.laborOpex) + '/y');
    setText('t-total-opex',   fmtM(tea.totalOpex) + '/y');
    setText('t-annual-cf',    fmtM(tea.annualCF) + '/y');
    setText('t-npv',          fmtM(tea.npvFinal));
    setText('t-period-disp',  s.period);

    // Badge
    setText('badge-tci', 'CapEx: $' + tea.tci.toFixed(2) + 'M');

    // DCF table
    const dcfTbody = document.getElementById('dcf-tbody');
    if (dcfTbody) {
      dcfTbody.innerHTML = tea.dcf.map(d => `
        <tr class="${d.npv >= 0 ? 'cc-result-highlight' : ''}">
          <td>${d.yr}</td>
          <td class="cc-result-val">${fmtM(d.discCF)}</td>
          <td class="cc-result-val">${fmtM(d.npv)}</td>
        </tr>`).join('');
    }
  }

  function renderGWPTable(rows) {
    const tbody = document.getElementById('gwp-tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map((r, i) => `
      <tr>
        <td>${r.name}</td>
        <td><input type="number" class="cc-input" data-row="${i}" data-field="qty"
                   value="${r.qty}" min="0" step="any"></td>
        <td class="cc-unit">${r.qtyUnit}</td>
        <td><input type="number" class="cc-input" data-row="${i}" data-field="gwpFactor"
                   value="${r.gwpFactor}" min="0" step="any"></td>
        <td class="cc-unit">${r.gwpUnit}</td>
        <td style="background:var(--cc-green-xlight);font-weight:600;font-variant-numeric:tabular-nums">
          ${r.gwp.toFixed(4)}
        </td>
      </tr>`).join('');
  }

  function renderGWP(gwp) {
    // Update GWP per-row result cells (6th cell of each row)
    const rows = document.querySelectorAll('#gwp-tbody tr');
    gwp.rows.forEach((r, i) => {
      if (rows[i]) {
        const cells = rows[i].querySelectorAll('td');
        if (cells[5]) cells[5].textContent = r.gwp.toFixed(4);
      }
    });

    // Totals
    const total = gwp.total.toFixed(3);
    setText('gwp-total',     total);
    setText('gwp-total-big', total);
    setText('badge-gwp',     total + ' kg CO\u2082e/kg');
  }

  function renderKPIs(tea, gwp) {
    setText('kpi-capex', '$' + tea.tci.toFixed(2) + 'M');
    const cfSign = tea.annualCF < 0 ? '−' : '';
    setText('kpi-cf',   cfSign + '$' + Math.abs(tea.annualCF).toFixed(2) + 'M/y');
    const npvSign = tea.npvFinal < 0 ? '−' : '';
    setText('kpi-npv',  npvSign + '$' + Math.abs(tea.npvFinal).toFixed(2) + 'M');
    setText('kpi-gwp',  gwp.total.toFixed(3) + ' kg CO\u2082e/kg');
  }

  /* ----------------------------------------------------------
     MAIN RECALCULATE
  ---------------------------------------------------------- */
  function recalculate() {
    const bal = calcBalance(STATE);
    const gwp = calcGWP(STATE);
    const tea = calcTEA(STATE, bal, gwp);

    renderBalance(bal);
    renderTEA(tea, STATE);
    renderGWP(gwp);
    renderKPIs(tea, gwp);
    updateNPVChart(tea.dcf, tea.tci);
    updateGWPChart(gwp.rows);
  }

  /* ----------------------------------------------------------
     EVENT WIRING
  ---------------------------------------------------------- */
  function wireInputs() {
    // Map input id → STATE key
    const inputMap = {
      'b-biomass':      'biomass',
      'b-hemi-pct':     'hemiPct',
      'b-cell-pct':     'cellPct',
      'b-lign-pct':     'lignPct',
      'b-ash-pct':      'ashPct',
      'b-hemi-rec':     'hemiRec',
      'b-cell-rec':     'cellRec',
      'b-lign-rec':     'lignRec',
      'b-chp-eff':      'chpEff',
      'b-biocomp-rate': 'biocompRate',
      'b-years':        'years',
      'b-final-conv':   'finalConv',
      't-cepci':        'cepci',
      't-opdays':       'opDays',
      't-tci-mult':     'tciMult',
      't-prod-price':   'prodPrice',
      't-feed-price':   'feedPrice',
      't-reagent':      'reagentCost',
      't-elec':         'elecFactor',
      't-heat':         'heatFactor',
      't-indirect-rate':'indirectRate',
      't-labor':        'laborCost',
      't-jobs':         'jobs',
      't-discount':     'discount',
      't-period':       'period',
    };

    Object.entries(inputMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          const v = parseFloat(el.value);
          if (!isNaN(v)) {
            STATE[key] = v;
            recalculate();
          }
        });
      }
    });

    // Equipment table — event delegation
    const equipTbody = document.getElementById('equip-tbody');
    if (equipTbody) {
      equipTbody.addEventListener('input', e => {
        const inp = e.target;
        const row = parseInt(inp.dataset.row);
        const field = inp.dataset.field;
        if (!isNaN(row) && field && STATE.equipment[row]) {
          const v = parseFloat(inp.value);
          if (!isNaN(v)) {
            STATE.equipment[row][field] = v;
            recalculate();
          }
        }
      });
    }

    // GWP table — event delegation
    const gwpTbody = document.getElementById('gwp-tbody');
    if (gwpTbody) {
      gwpTbody.addEventListener('input', e => {
        const inp = e.target;
        const row = parseInt(inp.dataset.row);
        const field = inp.dataset.field;
        if (!isNaN(row) && field && STATE.gwpRows[row]) {
          const v = parseFloat(inp.value);
          if (!isNaN(v)) {
            STATE.gwpRows[row][field] = v;
            recalculate();
          }
        }
      });
    }
  }

  /* ----------------------------------------------------------
     INIT
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    // Build dynamic table rows first (so event delegation can find them)
    const initialBal = calcBalance(STATE);
    const initialGWP = calcGWP(STATE);
    const initialTEA = calcTEA(STATE, initialBal, initialGWP);

    renderEquipTable(initialTEA.equip);
    renderGWPTable(initialGWP.rows);

    initCharts();
    wireInputs();
    recalculate();
  });

})();
