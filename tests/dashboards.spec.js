// @ts-check
/**
 * Calculation regression tests for the 3 embedded LCA/TEA dashboards.
 * Purpose: confirm that visual/style changes do not break any calculation logic.
 *
 * Each suite:
 *  1. Loads the standalone HTML via file:// URL
 *  2. Records baseline output values with default inputs
 *  3. Changes one or more inputs
 *  4. Asserts outputs changed in the expected direction / to the expected value
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const file = (name) =>
  'file:///' + path.resolve(__dirname, '..', 'standalone', name).replace(/\\/g, '/');

// ─────────────────────────────────────────────────────────────
// LATERITE LCA + TEA
// Calculation is triggered by calling calc() directly via JS
// (the button sits in a sticky overflow sidebar that is not
//  reachable via a plain headless click)
// ─────────────────────────────────────────────────────────────
test.describe('Laterite LCA + TEA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(file('laterite-lca-tea.html'));
    // calc() runs at end of script on page load
    await expect(page.locator('#v_ncldry')).not.toHaveText('');
  });

  test('default inputs produce non-zero mass balance outputs', async ({ page }) => {
    const ncldry = await page.locator('#v_ncldry').textContent();
    expect(parseFloat(ncldry)).toBeGreaterThan(0);

    const tci = await page.locator('#v_tci').textContent();
    expect(parseFloat(tci)).toBeGreaterThan(0);
  });

  test('increasing NCL feed raises TCI', async ({ page }) => {
    const tci_before = parseFloat(await page.locator('#v_tci').textContent());

    await page.locator('#i_ncl').fill('720'); // double default 360
    await page.evaluate(() => calc());       // trigger via JS, bypass click
    await page.waitForTimeout(200);

    const tci_after = parseFloat(await page.locator('#v_tci').textContent());
    expect(tci_after).toBeGreaterThan(tci_before);
  });

  test('increasing electricity price raises opex', async ({ page }) => {
    const opex_before = parseFloat(await page.locator('#v_opex').textContent());

    await page.locator('#i_pelec').fill('0.15'); // raise from 0.0644
    await page.evaluate(() => calc());
    await page.waitForTimeout(200);

    const opex_after = parseFloat(await page.locator('#v_opex').textContent());
    expect(opex_after).toBeGreaterThan(opex_before);
  });

  test('resetting to defaults restores original TCI', async ({ page }) => {
    const tci_original = parseFloat(await page.locator('#v_tci').textContent());

    await page.locator('#i_ncl').fill('720');
    await page.evaluate(() => calc());
    await page.waitForTimeout(200);

    // Reset to defaults then recalc
    await page.evaluate(() => { resetDef(); calc(); });
    await page.waitForTimeout(200);

    const tci_reset = parseFloat(await page.locator('#v_tci').textContent());
    expect(tci_reset).toBeCloseTo(tci_original, 2);
  });

  test('GWP electricity output is present and non-zero', async ({ page }) => {
    const gwpEl = await page.locator('#v_gwpel').textContent();
    expect(parseFloat(gwpEl)).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// PHA FROM LIGNOCELLULOSE LCA + TEA
// Tabs clear and rebuild panel HTML on switch — navigate to the
// relevant tab before asserting its KPI elements.
// ─────────────────────────────────────────────────────────────
test.describe('PHA from Lignocellulose LCA + TEA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(file('PHA-from-lignocellulose-lca-tea.html'));
    // updateAll() runs on load; wait for mass balance KPI
    await expect(page.locator('#o-k-biocomp')).not.toHaveText('');
  });

  test('default inputs produce non-zero biocomposite output', async ({ page }) => {
    const biocomp = await page.locator('#o-k-biocomp').textContent();
    expect(parseFloat(biocomp.replace(/[^0-9.]/g, ''))).toBeGreaterThan(0);
  });

  test('TCI and total cost KPIs are non-zero on TEA tab', async ({ page }) => {
    // Navigate to TEA tab (data-t="1") to ensure p1 is rendered
    await page.locator('.tbtn[data-t="1"]').click();
    await expect(page.locator('#o-k-tci')).not.toHaveText('');

    const tci = await page.locator('#o-k-tci').textContent();
    expect(parseFloat(tci.replace(/[^0-9.]/g, ''))).toBeGreaterThan(0);

    const tcost = await page.locator('#o-k-tcost').textContent();
    expect(tcost.trim()).not.toBe('');
  });

  test('revenue KPI is positive on TEA tab', async ({ page }) => {
    await page.locator('.tbtn[data-t="1"]').click();
    await expect(page.locator('#o-k-rev')).not.toHaveText('');

    const rev = await page.locator('#o-k-rev').textContent();
    // Format: "$12.3M/y"
    const val = parseFloat(rev.replace(/[^0-9.]/g, ''));
    expect(val).toBeGreaterThan(0);
  });

  test('increasing feedstock input raises biocomposite output', async ({ page }) => {
    const before = parseFloat(
      (await page.locator('#o-k-biocomp').textContent()).replace(/[^0-9.]/g, '')
    );

    // First number input is the feedstock rate
    const firstInput = page.locator('input[type="number"]').first();
    const currentVal = await firstInput.inputValue();
    await firstInput.fill(String(parseFloat(currentVal) * 2));
    await page.waitForTimeout(300);

    const after = parseFloat(
      (await page.locator('#o-k-biocomp').textContent()).replace(/[^0-9.]/g, '')
    );
    expect(after).toBeGreaterThan(before);
  });

  test('3 tabs are present', async ({ page }) => {
    const tabs = page.locator('.tbtn');
    await expect(tabs).toHaveCount(3);
  });
});

// ─────────────────────────────────────────────────────────────
// FLUE2CHEM LCA + TEA
// ─────────────────────────────────────────────────────────────
test.describe('Flue2Chem LCA + TEA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(file('flue2chem-lca-tea.html'));
    // calc() is called at end of script; wait for KPI to be populated
    await expect(page.locator('#k_totalcap')).not.toHaveText('—');
  });

  test('visible reset controls are present in the standalone UI', async ({ page }) => {
    await expect(page.locator('#resetDefaultsBtn')).toBeVisible();
    await expect(page.locator('#resetDefaultsBtnSecondary')).toBeVisible();
  });

  test('default inputs produce non-zero Total Capital', async ({ page }) => {
    const cap = await page.locator('#k_totalcap').textContent();
    expect(parseFloat(cap)).toBeGreaterThan(0);
  });

  test('Total Cost KPI is non-zero', async ({ page }) => {
    const cost = await page.locator('#k_cost').textContent();
    expect(parseFloat(cost)).toBeGreaterThan(0);
  });

  test('MSSP (Min Surfactant Selling Price) is positive', async ({ page }) => {
    const mssp = await page.locator('#k_mssp').textContent();
    expect(parseFloat(mssp.replace(/[^0-9.]/g, ''))).toBeGreaterThan(0);
  });

  test('increasing flue gas throughput raises Total Capital', async ({ page }) => {
    const cap_before = parseFloat(await page.locator('#k_totalcap').textContent());

    await page.locator('#i_flue').fill('72000'); // double default 36000
    await page.waitForTimeout(300);

    const cap_after = parseFloat(await page.locator('#k_totalcap').textContent());
    expect(cap_after).toBeGreaterThan(cap_before);
  });

  test('increasing surfactant price raises Surfactant Value', async ({ page }) => {
    const sval_before = parseFloat(await page.locator('#k_sval').textContent());

    await page.locator('#i_sprice').fill('15000'); // double default 7500
    await page.locator('#i_sprice').dispatchEvent('input');
    await page.waitForTimeout(300);

    const sval_after = parseFloat(await page.locator('#k_sval').textContent());
    expect(sval_after).toBeGreaterThan(sval_before);
  });

  test('increasing electricity cost raises Total Cost', async ({ page }) => {
    const cost_before = parseFloat(await page.locator('#k_cost').textContent());

    await page.locator('#i_elcost').fill('0.50'); // double default 0.25
    await page.waitForTimeout(300);

    const cost_after = parseFloat(await page.locator('#k_cost').textContent());
    expect(cost_after).toBeGreaterThan(cost_before);
  });

  test('all 6 tabs are present', async ({ page }) => {
    const tabs = page.locator('.tab');
    await expect(tabs).toHaveCount(6);
  });

  test('switching to TEA Results tab shows MSSP card', async ({ page }) => {
    await page.locator('.tab').nth(1).click();
    await expect(page.locator('#k_mssp')).toBeVisible();
  });

  test('LCA comparison updates when electricity inputs change', async ({ page }) => {
    await page.locator('.tab').nth(5).click();
    const before = await page.locator('#lca-cmp-tbody tr').first().locator('td').nth(1).textContent();

    await page.locator('.tab').nth(0).click();
    await page.locator('#i_elec_h2').fill('60');
    await page.waitForTimeout(300);
    await page.locator('.tab').nth(5).click();

    const after = await page.locator('#lca-cmp-tbody tr').first().locator('td').nth(1).textContent();
    expect(after).not.toBe(before);
  });

  test('reset via visible button restores the default LCA comparison value', async ({ page }) => {
    await page.locator('.tab').nth(5).click();
    const original = await page.locator('#lca-cmp-tbody tr').first().locator('td').nth(1).textContent();

    await page.locator('.tab').nth(0).click();
    await page.locator('#i_elec_h2').fill('60');
    await page.waitForTimeout(300);
    await page.locator('#resetDefaultsBtn').click();
    await page.waitForTimeout(300);
    await page.locator('.tab').nth(5).click();

    const reset = await page.locator('#lca-cmp-tbody tr').first().locator('td').nth(1).textContent();
    expect(reset).toBe(original);
  });

  test('embedded mode removes the viewport minimum height', async ({ page }) => {
    const before = await page.evaluate(() => getComputedStyle(document.body).minHeight);
    expect(before).not.toBe('0px');

    await page.evaluate(() => {
      document.body.classList.add('in-frame');
    });

    const after = await page.evaluate(() => getComputedStyle(document.body).minHeight);
    expect(after).toBe('0px');
  });
});
