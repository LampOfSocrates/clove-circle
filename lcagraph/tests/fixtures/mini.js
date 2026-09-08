/* A tiny PML document exercising every construct: recycle tear, table-derived column,
   closure, hard constraint, solve node. */
const MINI = {
  pml: '0.1',
  meta: { id: 'mini', title: 'Mini', notes: [{ id: 'q1', level: 'quirk', title: 'Q', text: 'A quirk', nodes: ['prod'] }] },
  stages: [{ id: 'mass', title: 'Mass' }, { id: 'capex', title: 'Capex' }, { id: 'dcf', title: 'DCF' }],
  components: { a: { label: 'A', mw: 10 } },
  params: {
    feed: { label: 'Feed', stage: 'mass', dim: 'mass_flow', unit: 't/h', default: 10, range: [1, 100] },
    yld: { label: 'Yield', stage: 'mass', dim: 'fraction', unit: '%', default: 50 },
    rec: { label: 'Recycle fraction', stage: 'mass', dim: 'fraction', default: 0.5 },
    lang: { label: 'Lang', stage: 'capex', dim: 'count', default: 3 },
    price: { label: 'Price', stage: 'dcf', dim: 'price_mass', unit: '$/t', default: 100 },
    r: { label: 'Rate', stage: 'dcf', dim: 'fraction', default: 0.1 }
  },
  tables: {
    eq: {
      stage: 'capex',
      columns: { label: { type: 'text' }, base: { dim: 'currency', unit: '$M', editable: true }, n: { dim: 'count' }, cb: { dim: 'count', nullable: true } },
      rows: { u1: { label: 'U1', base: 1, n: 0.6, cb: 400 }, u2: { label: 'U2', base: 2, n: 1, cb: null } }
    }
  },
  units: { rx: { label: 'Reactor', kind: 'reactor', params: ['yld'] }, sep: { label: 'Sep', kind: 'separator' } },
  streams: {
    feed_s: { label: 'Feed', from: 'env', to: 'rx', dim: 'mass_flow', unit: 't/d', expr: 'feed' },
    mix: { label: 'Mixed', from: 'rx', to: 'sep', dim: 'mass_flow', unit: 't/d', expr: 'feed_s + recyc' },
    recyc: { label: 'Recycle', from: 'sep', to: 'rx', dim: 'mass_flow', unit: 't/d', expr: 'mix * rec * (1 - yld)', recycle: true, guess: 0 },
    prod: { label: 'Product', from: 'sep', to: 'env', dim: 'mass_flow', unit: 't/d', expr: 'mix * yld', product: 'main' },
    waste: { label: 'Waste', from: 'sep', to: 'env', dim: 'mass_flow', unit: 't/d', expr: 'mix - prod - recyc', closes: true }
  },
  derived: {
    cost: { label: 'Unit cost', stage: 'capex', dim: 'currency', unit: '$M', table: 'eq', column: 'cost',
      expr: 'six_tenths(row.base, prod, 100, row.n, row.cb, 800)' },
    pec: { label: 'PEC', stage: 'capex', dim: 'currency', unit: '$M', expr: 'sum(col(eq, cost))' },
    tci: { label: 'TCI', stage: 'capex', dim: 'currency', unit: '$M', expr: 'pec * lang', kpi: true },
    rev: { label: 'Revenue', stage: 'dcf', dim: 'currency', unit: '$M', expr: 'prod * 365 * price / 1e6' },
    npv: { label: 'NPV', stage: 'dcf', dim: 'currency', unit: '$M', expr: '-tci + npv(repeat(rev, 10), r)' },
    bep: { label: 'Break-even price', stage: 'dcf', dim: 'price_mass', unit: '$/t', solve: { target: 'npv', vary: 'price', lo: 0, hi: 1e6 } }
  },
  checks: {
    close: { kind: 'closure', stage: 'mass', label: 'Mass', unit: 't/d', in: ['feed_s'], out: ['prod', 'waste'], tolerance: 0.001 },
    pos: { kind: 'constraint', stage: 'mass', severity: 'hard', expr: 'feed > 0', message: 'Feed must be positive.' }
  }
};

module.exports = { MINI };
