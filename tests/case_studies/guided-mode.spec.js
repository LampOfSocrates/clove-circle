// @ts-check
/**
 * Guided Mode on the Laterite step-by-step page.
 *
 * The point of the mode is that a learner cannot get lost: exactly one task is
 * available, "Next" will not light up until the engine agrees the task was
 * done, and nothing outside the task is reachable. These tests assert those
 * three properties rather than the styling, so the copy can be reworded freely.
 */

const { test, expect } = require('@playwright/test');

const PAGE = '/case_studies/stepbystep/laterite.html';
const OTHERS = ['flue2chem', 'palladium'];

/** Walk from the scope step to the end, doing each task. */
async function completeGuidedRun(page) {
  await page.click('.cc-task-ack');
  await page.click('.cc-task-next');
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('.cc-task-next')).toBeDisabled();
    await page.click('.cc-solve-btn');
    await expect(page.locator('.cc-task-next')).toBeEnabled();
    await page.click('.cc-task-next');
  }
}

test.describe('Guided Mode — laterite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('.cc-task-text')).toBeVisible();
  });

  test('guided is the default, and the mode toggle offers both', async ({ page }) => {
    await expect(page.locator('#sbs')).toHaveAttribute('data-mode', 'guided');
    const btns = page.locator('.cc-mode-btn');
    await expect(btns).toHaveCount(2);
    await expect(btns.nth(0)).toHaveText('Guided Mode');
    await expect(btns.nth(1)).toHaveText('Expert Mode');
    await expect(btns.nth(0)).toHaveAttribute('aria-pressed', 'true');
  });

  test('only the current step is reachable', async ({ page }) => {
    // Steps 2..8 are locked at the start; the rail is progress, not navigation.
    await expect(page.locator('.cc-step.is-locked')).toHaveCount(7);
    for (const btn of await page.locator('.cc-step.is-locked').all()) {
      await expect(btn).toBeDisabled();
    }
  });

  test('the sandbox affordances are gone', async ({ page }) => {
    await expect(page.locator('[data-cc-solve-all]')).toBeHidden();
    await expect(page.locator('.cc-diagram-hint')).toBeHidden();
    await expect(page.locator('.cc-card-try')).toHaveCount(0);
    await expect(page.locator('.cc-questions')).toHaveCount(0);
  });

  test('Next stays disabled until the engine says the task was done', async ({ page }) => {
    await page.click('.cc-task-ack');
    await page.click('.cc-task-next');

    await expect(page.locator('.cc-task-tick')).toHaveText('To do');
    await expect(page.locator('.cc-task-next')).toBeDisabled();

    await page.click('.cc-solve-btn');
    await expect(page.locator('.cc-task-tick')).toHaveText(/Done/);
    await expect(page.locator('.cc-task-next')).toBeEnabled();
  });

  test('each step exposes only the inputs its task names', async ({ page }) => {
    await page.click('.cc-task-ack');
    await page.click('.cc-task-next');

    // Mass balance focuses on feed and moisture — not the other stage inputs.
    await expect(page.locator('.cc-mini-field')).toHaveCount(2);
    await expect(page.locator('[data-cc-field="ncl"]')).toBeVisible();
    await expect(page.locator('[data-cc-field="moist"]')).toBeVisible();

    // And the rest of the flowsheet is dimmed out of reach.
    const dimmed = page.locator('.cc-hit.is-out-of-scope');
    expect(await dimmed.count()).toBeGreaterThan(0);
    await expect(dimmed.first()).toHaveCSS('pointer-events', 'none');
  });

  test('the whole method can be completed, and the KPIs fill in', async ({ page }) => {
    await completeGuidedRun(page);

    await expect(page.locator('.cc-step.is-locked')).toHaveCount(0);
    for (const kpi of await page.locator('.cc-kpi-val').all()) {
      await expect(kpi).not.toHaveText('—');
    }
  });

  test('the closing task requires a real input change, wherever it lives', async ({ page }) => {
    await completeGuidedRun(page);

    // 'interpret' owns no stage, but its task names moisture, so the field
    // must still be reachable — otherwise the task is impossible.
    const box = page.locator('[data-cc-field="moist"]');
    await expect(box).toBeVisible();
    await expect(page.locator('.cc-task-tick')).toHaveText('To do');

    await box.fill('40');
    await box.press('Enter');
    await expect(page.locator('.cc-task-tick')).toHaveText(/Done/);
    await expect(page.locator('.cc-task-expect')).toBeVisible();
  });
});

test.describe('Expert Mode — laterite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.click('.cc-mode-btn:not(.is-on)');
    await expect(page.locator('#sbs')).toHaveAttribute('data-mode', 'expert');
  });

  test('the practice questions sit under Goal & scope', async ({ page }) => {
    const block = page.locator('.cc-questions');
    await expect(block).toHaveCount(1);

    // The block is collapsed as a whole: the opening step must fit one screen,
    // and six open prompts is exactly the clutter Guided Mode set out to remove.
    await expect(block).not.toHaveAttribute('open', /.*/);
    const qs = page.locator('.cc-question');
    expect(await qs.count()).toBeGreaterThanOrEqual(5);
    await expect(qs.first()).toBeHidden();

    await block.locator('.cc-questions-summary').click();
    await expect(qs.first()).toBeVisible();

    // Each question is then collapsed in turn, so the list reads as a menu.
    await expect(qs.first().locator('.cc-question-how')).toBeHidden();
    await qs.first().locator('summary').click();
    await expect(qs.first().locator('.cc-question-how')).toBeVisible();
  });

  test('the questions are scoped to Goal & scope, not every step', async ({ page }) => {
    await page.click('.cc-step[data-step="mass"]');
    await expect(page.locator('.cc-questions')).toHaveCount(0);
  });

  test('the sandbox comes back and the task block goes away', async ({ page }) => {
    await expect(page.locator('.cc-task')).toHaveCount(0);
    await expect(page.locator('[data-cc-solve-all]')).toBeVisible();
    await expect(page.locator('.cc-hit.is-out-of-scope')).toHaveCount(0);
    await expect(page.locator('.cc-step.is-locked')).not.toHaveCount(0);
  });

  test('every step is reachable directly', async ({ page }) => {
    await page.click('.cc-step[data-step="dcf"]');
    await expect(page.locator('.cc-card-head h3')).toHaveText('Profitability');
  });
});

test.describe('the other case studies are untouched', () => {
  for (const model of OTHERS) {
    test(`${model} has no mode toggle and no guided gating`, async ({ page }) => {
      await page.goto(`/case_studies/stepbystep/${model}.html`);
      await expect(page.locator('.cc-card-head h3')).toBeVisible();
      await expect(page.locator('.cc-mode-btn')).toHaveCount(0);
      await expect(page.locator('.cc-task')).toHaveCount(0);
      await expect(page.locator('#sbs')).toHaveAttribute('data-mode', 'expert');
    });
  }
});
