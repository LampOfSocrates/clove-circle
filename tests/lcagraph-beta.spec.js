// @ts-check
/* Gate page for the LCA Graph beta. The access check happens in the Cloudflare Worker, so
   these tests need `wrangler dev` running on 127.0.0.1:8787 with a .dev.vars master code
   of local-master-code-123456; without it the Worker-backed tests are skipped. */
const { test, expect } = require('@playwright/test');

const WORKER = 'http://127.0.0.1:8787';
const MASTER = 'local-master-code-123456';

async function workerUp() {
  try { const r = await fetch(WORKER + '/'); return r.ok; } catch (e) { return false; }
}

test('every page links to the beta from the Process Calculators menu', async ({ page }) => {
  await page.goto('/index.html');
  const link = page.locator('#calcMenu + .dropdown-menu a.dropdown-item[href="lcagraph/app/beta.html"]');
  await expect(link).toHaveCount(1);
  await expect(link).toContainText('LCA Graph (Beta)');
  await expect(page.locator('#calcMenu + .dropdown-menu a.dropdown-item[href="resources.html#lca-graph"]')).toHaveCount(1);
});

test('gate page explains the beta and hides the tool', async ({ page }) => {
  await page.goto('/lcagraph/app/beta.html');
  await expect(page.locator('.lg-gate h1')).toContainText('LCA Graph Beta');
  await expect(page.locator('nav.cc-navbar #calcMenu')).toBeVisible();
  await expect(page.locator('[data-gate]')).toContainText('third-party model provider');
  await expect(page.locator('[data-app]')).toBeHidden();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('wrong code is refused, right code opens the tool, leaving closes it', async ({ page }) => {
  test.skip(!(await workerUp()), 'wrangler dev is not running on 8787');
  await page.goto('/lcagraph/app/beta.html');
  await page.fill('[data-code]', 'not-a-real-code');
  await page.click('[data-submit]');
  await expect(page.locator('[data-status]')).toContainText('Invalid');
  await expect(page.locator('[data-app]')).toBeHidden();

  await page.fill('[data-code]', MASTER);
  await page.click('[data-submit]');
  await expect(page.locator('[data-app]')).toBeVisible();
  await expect(page.locator('[data-who]')).toContainText('master');
  await expect(page.locator('[data-hub] a[href="index.html"]')).toBeVisible();
  await expect(page.locator('[data-hub] a[href="#draft"]')).toBeVisible();

  // survives a reload through sessionStorage
  await page.reload();
  await expect(page.locator('[data-app]')).toBeVisible();

  // chat round-trips to the Worker (the reply may be an upstream error without a real key)
  await page.fill('[data-prompt]', 'Say hello');
  await page.click('[data-send]');
  await expect(page.locator('[data-reply]')).not.toContainText('Thinking', { timeout: 20000 });
  await expect(page.locator('[data-reply]')).not.toContainText('Could not reach');

  await page.click('[data-signout]');
  await expect(page.locator('[data-app]')).toBeHidden();
  await expect(page.locator('[data-gate]')).toBeVisible();
});
