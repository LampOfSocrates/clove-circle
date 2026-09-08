// @ts-check
/* The flowsheet-to-model drafting loop on the beta page, with the Worker mocked so the
   test is deterministic and free: the first "draft" fails to compile, the repair request
   must carry the compiler errors, the second draft compiles and opens in the app. */
const { test, expect } = require('@playwright/test');
const { MINI } = require('../lcagraph/tests/fixtures/mini.js');

const WORKER = 'https://lcagraph-beta.lampofsocrates.workers.dev';
// 1x1 white PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

test('draft loop: bad draft is sent back for repair, good draft opens in LCA Model', async ({ page, context }) => {
  const calls = [];
  await page.route(WORKER + '/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataJSON ? req.postDataJSON() : {};
    calls.push({ path: url.pathname, body });
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Beta-Code', 'Content-Type': 'application/json' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/verify') return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, name: 'tester', remainingToday: 9 }) });
    if (url.pathname === '/draft') {
      const bad = JSON.parse(JSON.stringify(MINI));
      bad.derived.pec.expr = 'nothere + 1';           // unknown identifier -> compile error
      const doc = body.fix ? MINI : bad;
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, doc, model: 'mock', usage: { completion_tokens: 42 }, remainingToday: 8 }) });
    }
    return route.fulfill({ status: 404, headers, body: '{}' });
  });

  await page.addInitScript(() => { window.LCAG_WORKER_URL = 'https://lcagraph-beta.lampofsocrates.workers.dev'; });
  await page.goto('/lcagraph/app/beta.html');
  await page.fill('[data-code]', 'tester-code-123456');
  await page.click('[data-submit]');
  await expect(page.locator('[data-app]')).toBeVisible();

  // no image yet -> refused locally
  await page.click('[data-draft]');
  await expect(page.locator('[data-draft-status]')).toContainText('Upload a flowsheet');

  await page.setInputFiles('[data-file]', { name: 'flowsheet.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('[data-preview]')).toBeVisible();
  await page.fill('[data-desc]', 'A toy process with a reactor and a separator.');
  await page.click('[data-draft]');

  await expect(page.locator('[data-result]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-result-title]')).toContainText('ready to open');
  await expect(page.locator('[data-log]')).toContainText('unknown identifier');
  await expect(page.locator('[data-log]')).toContainText('Compiles, lints and solves');

  const drafts = calls.filter((c) => c.path === '/draft');
  expect(drafts.length).toBe(2);
  expect(drafts[0].body.image).toMatch(/^data:image\/jpeg;base64,/);
  expect(drafts[1].body.fix.errors.join(' ')).toMatch(/nothere/);

  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('[data-open]')]);
  await popup.waitForLoadState();
  await expect(popup.locator('[data-lg-title]')).toHaveText('Mini');
  await expect(popup.locator('.lg-note-warning')).toContainText('AI-drafted, unverified');
  await popup.locator('[data-lg-solve-all]').click();
  await expect(popup.locator('.lg-step.is-solved')).toHaveCount(3);
});
