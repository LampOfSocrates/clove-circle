// @ts-check
/**
 * Declarative description of every case-study calculator.
 *
 * These configs drive the baseline (golden-file) calculation tests. They
 * deliberately describe INPUTS and NUMERIC OUTPUTS only — nothing about the
 * page's markup, layout or styling. Restyling a dashboard must not move a
 * baseline; changing a formula must.
 */

const path = require('path');

/** file:// URL for a standalone dashboard (Playwright cannot load bare Windows paths). */
const fileUrl = (name) =>
  'file:///' + path.resolve(__dirname, '..', '..', 'standalone', name).replace(/\\/g, '/');

/** @type {import('./baseline').DashboardConfig[]} */
const DASHBOARDS = [
  {
    key: 'laterite',
    title: 'Laterite NHM Processing LCA + TEA',
    url: fileUrl('laterite-lca-tea.html'),
    // calc() runs once at the end of the page script
    readySelector: '#v_ncldry',
    // The recalc button lives in a sticky overflow sidebar that headless
    // Chromium cannot reach with a plain click, so drive the model directly.
    recalc: 'calc()',
    outputSelector: '[id^="v_"]',
    tableSelector: '#capex_tbl, #opex_tbl, #npv_tbl, #bfl_tbl, #mnox_tbl',
    scenarios: {
      defaults: {},
      'double-ncl-feed': { i_ncl: 720 },
      'high-electricity-price': { i_pelec: 0.15 },
      'wetter-ore-and-costlier-labour': { i_moist: 40, i_plab: 120000 },
      'high-metal-price-and-irr': { i_pmet: 25, i_irr: 0.2 },
    },
  },
  {
    key: 'flue2chem',
    title: 'Flue2Chem LCA + TEA',
    url: fileUrl('flue2chem-lca-tea.html'),
    readySelector: '#k_totalcap',
    // Inputs are wired to `input` events; no explicit recalc entry point needed.
    recalc: null,
    outputSelector: '[id^="k_"], [id^="kc_"], [id^="t_"], [id^="fs_"]',
    tableSelector: '#mb-tbody, #eq-tbody, #dcf-tbody, #lca-cmp-tbody, #lca-full-tbody',
    scenarios: {
      defaults: {},
      'ten-percent-more-flue-gas': { i_flue: 39600 },
      'double-surfactant-price': { i_sprice: 15000 },
      'expensive-electricity': { i_elcost: 0.5 },
      'greener-hydrogen-electricity': { i_elec_h2: 20, i_elec_cc: 0.2 },
      'lower-co2-recovery': { i_co2rec: 0.6, i_syield: 0.4 },
    },
  },
  {
    key: 'pha-lignocellulose',
    title: 'PHA from Lignocellulose LCA + TEA',
    url: fileUrl('PHA-from-lignocellulose-lca-tea.html'),
    readySelector: '#o-wet',
    recalc: 'updateAll()',
    // Tab panels are torn down and rebuilt on switch, so every tab must be
    // visited before its outputs exist in the DOM.
    visitTabs: ['.tbtn[data-t="0"]', '.tbtn[data-t="1"]', '.tbtn[data-t="2"]'],
    outputSelector: '[id^="o-"], [id^="b"][id$="14"], #bE5, #bE6, #bE7, #bE8, #bF5, #bF6, #bF7, #bG6',
    tableSelector: '#eq-tbody, #dcf-tbody',
    scenarios: {
      defaults: {},
      'double-dry-biomass': { 'i-basisTpa': 200000 },
      'lignin-rich-feed': { 'i-hemiPct': 20, 'i-cellPct': 35, 'i-lignPct': 40, 'i-ashPct': 5 },
      'higher-pha-yield': { 'i-recPHA': 0.45, 'i-biocompRec': 95 },
      'wetter-feedstock': { 'i-moisture': 45 },
    },
  },
  {
    key: 'palladium-biorecovery',
    title: 'Palladium Bio-recovery LCA + TEA',
    url: fileUrl('palladium-biorecovery-lca-tea.html'),
    readySelector: '#tea_msp',
    recalc: 'render()',
    outputSelector: '[id^="tea_"], [id^="m_"], [id^="lca_"]',
    tableSelector: '#capex_table_body, #opex_table_body, #mb_table_body, #lca_table_body',
    scenarios: {
      defaults: {},
      'double-throughput': { i_throughput: 20000 },
      'lower-recovery': { i_recovery: 80 },
      'palladium-price-spike': { i_pd_price: 90000 },
      'expensive-reagents': { i_tris_price: 30, i_nacl_price: 0.5, i_biocat_price: 8000 },
      'aggressive-discounting': { i_discount: 15, i_life: 20, i_tax: 30 },
    },
  },
];

module.exports = { DASHBOARDS, fileUrl };
