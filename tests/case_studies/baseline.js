// @ts-check
/**
 * Golden-file ("baseline") helpers for the case-study calculators.
 *
 * A baseline records, for each named scenario, the exact numeric outputs the
 * dashboard produces from a known set of inputs. Tests replay the scenario and
 * assert the outputs still match. Only values are captured — never markup — so
 * these tests survive restyling and fail on formula drift.
 *
 * Regenerate after an intentional model change:
 *   npm run test:case-studies:update
 */

const fs = require('fs');
const path = require('path');

const BASELINE_DIR = path.join(__dirname, 'baselines');

/** Set UPDATE_BASELINE=1 to rewrite the golden files instead of asserting. */
const UPDATE = process.env.UPDATE_BASELINE === '1';

/**
 * @typedef {Object} DashboardConfig
 * @property {string} key                 slug used for the baseline filename
 * @property {string} title               human-readable suite name
 * @property {string} url                 file:// URL of the standalone dashboard
 * @property {string} readySelector       element that is populated once the model has run
 * @property {string|null} recalc         JS expression that re-runs the model, or null if inputs auto-recalc
 * @property {string[]} [visitTabs]       selectors to click so lazily-built panels exist
 * @property {string} outputSelector      CSS selector matching every scalar output element
 * @property {string} [tableSelector]     CSS selector for tables captured as ordered number lists
 * @property {Record<string, Record<string, number>>} scenarios  scenario name -> input id -> value
 */

const baselinePath = (key) => path.join(BASELINE_DIR, `${key}.baseline.json`);

function readBaseline(key) {
  const file = baselinePath(key);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeBaseline(key, data) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  fs.writeFileSync(baselinePath(key), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Apply a scenario's inputs and return the resulting output snapshot.
 * @param {import('@playwright/test').Page} page
 * @param {DashboardConfig} config
 * @param {Record<string, number>} inputs
 */
async function runScenario(page, config, inputs) {
  await page.goto(config.url);
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && el.textContent.trim() !== '' && el.textContent.trim() !== '—';
    },
    config.readySelector,
    { timeout: 15000 }
  );

  for (const [id, value] of Object.entries(inputs)) {
    const input = page.locator(`#${CSS_escapeId(id)}`);
    await input.fill(String(value));
    // Some models listen for `input`, others only recalc on demand; fire both.
    await input.dispatchEvent('input');
    await input.dispatchEvent('change');
  }

  if (config.recalc) {
    await page.evaluate((expr) => {
      // eslint-disable-next-line no-eval
      window.eval(expr);
    }, config.recalc);
  }

  for (const tab of config.visitTabs || []) {
    await page.locator(tab).click();
    if (config.recalc) {
      await page.evaluate((expr) => window.eval(expr), config.recalc);
    }
  }

  await page.waitForTimeout(250);
  return snapshotOutputs(page, config);
}

/** CSS.escape is not available in Node, and our ids only ever contain [-_A-Za-z0-9]. */
function CSS_escapeId(id) {
  return id;
}

/**
 * Collect every output value on the page.
 * Scalars keep their rendered text (units and formatting are part of the result);
 * tables are reduced to an ordered list of the numbers they contain, so adding a
 * label column or restyling a row cannot move the baseline.
 * @param {import('@playwright/test').Page} page
 * @param {DashboardConfig} config
 */
async function snapshotOutputs(page, config) {
  return page.evaluate(
    ({ outputSelector, tableSelector }) => {
      const norm = (s) => s.replace(/\s+/g, ' ').trim();
      const numbersIn = (s) =>
        (norm(s).match(/-?\d[\d,]*(?:\.\d+)?(?:[eE][-+]?\d+)?/g) || []).map((n) =>
          n.replace(/,/g, '')
        );

      /** @type {Record<string, unknown>} */
      const scalars = {};
      document.querySelectorAll(outputSelector).forEach((el) => {
        if (!el.id) return;
        // Skip wrappers that merely contain other captured outputs.
        if (el.querySelector(outputSelector)) return;
        scalars[el.id] = norm(el.textContent || '');
      });

      /** @type {Record<string, string[]>} */
      const tables = {};
      if (tableSelector) {
        document.querySelectorAll(tableSelector).forEach((el) => {
          if (!el.id) return;
          tables[el.id] = numbersIn(el.textContent || '');
        });
      }

      return { scalars, tables };
    },
    { outputSelector: config.outputSelector, tableSelector: config.tableSelector || null }
  );
}

module.exports = { UPDATE, readBaseline, writeBaseline, runScenario, snapshotOutputs, baselinePath };
