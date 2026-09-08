// @ts-check
/* Smoke test for the LCA Model app (lcagraph/app). Runs against every model in
   lcagraph/models over the http server the config starts, because the app fetches its
   model JSON. Engine correctness is covered by `node --test` in lcagraph/tests. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const MODELS = fs.readdirSync(path.join(__dirname, '..', 'lcagraph', 'models'))
  .filter((f) => f.endsWith('.pml.json')).map((f) => f.replace('.pml.json', ''));

for (const id of MODELS) {
  test.describe('LCA Model — ' + id, () => {
    test('loads, draws the flowsheet, runs all steps, inspects, runs a tornado', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto('/lcagraph/app/index.html?model=' + id);

      await expect(page.locator('[data-lg-rail] .lg-step')).toHaveCount(8);
      await expect(page.locator('[data-lg-diagram] svg .lg-unit').first()).toBeVisible();
      await expect(page.locator('[data-lg-status]')).toContainText('nodes in the calc graph');

      await page.locator('[data-lg-solve-all]').click();
      await expect(page.locator('.lg-step.is-solved')).toHaveCount(6);
      await expect(page.locator('.lg-step.is-error')).toHaveCount(0);
      await expect(page.locator('.lg-kpi').first()).not.toContainText('—');

      // click a stream, inspector opens
      await page.locator('[data-lg-diagram] .lg-stream').first().click();
      await expect(page.locator('[data-lg-inspector] .lg-insp-head')).toBeVisible();

      // quick tornado in the interpretation step
      await page.locator('[data-step="interpret"]').click();
      await page.locator('.lg-spec').last().locator('button').click();
      await expect(page.locator('.lg-result .lg-table tbody tr').first()).toBeVisible();

      // notes banner shows every declared note
      const notes = await page.evaluate(() => (window.lgApp.doc.meta.notes || []).length);
      await expect(page.locator('.lg-note')).toHaveCount(notes);

      expect(errors).toEqual([]);
    });

    test('editing an input marks downstream stale and re-solving clears it', async ({ page }) => {
      await page.goto('/lcagraph/app/index.html?model=' + id);
      await page.locator('[data-lg-solve-all]').click();
      await expect(page.locator('.lg-step.is-solved')).toHaveCount(6);
      const firstStage = await page.evaluate(() => window.lgApp.stageIds[0]);
      await page.locator('[data-step="' + firstStage + '"]').click();
      const field = page.locator('[data-lg-fields] input.lg-field-value').first();
      await expect(field).toBeVisible();
      const before = await field.inputValue();
      await field.fill(String(Number(before.replace(/,/g, '')) * 1.1));
      await field.press('Enter');
      await expect(page.locator('.lg-kpi.is-stale').first()).toBeVisible();
      await page.locator('[data-lg-solve-all]').click();
      await expect(page.locator('.lg-kpi.is-stale')).toHaveCount(0);
    });
  });
}

test('resources page shows the LCA Model section for #lca-graph and embeds the app', async ({ page }) => {
  await page.goto('/resources.html#lca-graph');
  await expect(page.locator('#lca-graph')).toHaveClass(/active/);
  await expect(page.locator('#case-studies')).not.toHaveClass(/active/);
  const frame = page.locator('#lca-graph iframe');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute('src', /lcagraph\/app\/index\.html/);
  const inner = page.frameLocator('#lca-graph iframe');
  await expect(inner.locator('[data-lg-rail] .lg-step')).toHaveCount(8);
});
