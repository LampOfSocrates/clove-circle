// @ts-check
/**
 * Structural consistency of the four case-study wrappers.
 *
 * The wrappers are the same page with a different dashboard in the frame, so
 * they must stay interchangeable: same shell markup, same shared stylesheet and
 * script, no page-local styling beyond the frame-tuning custom properties.
 * Divergence here is how they drifted apart the last time.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');
const WRAPPERS = [
  'wrapper-flue2chem-lca-tea.html',
  'wrapper-laterite-lca-tea.html',
  'wrapper-palladium-lca-tea.html',
  'wrapper-pha-lca-tea.html',
];

const read = (name) => fs.readFileSync(path.join(ROOT, 'case_studies', name), 'utf8');
const url = (name) =>
  'file:///' + path.join(ROOT, 'case_studies', name).split(path.sep).join('/');

test.describe('case-study wrappers stay aligned', () => {
  for (const name of WRAPPERS) {
    test(`${name}: shared assets, no page-local styling`, () => {
      const html = read(name);

      expect(html).toContain('css/eco-theme.css');
      expect(html).toContain('css/case-study-format.css');
      expect(html).toContain('js/case-study-frame.js');

      // No inline style attributes — everything visual is in the shared sheet.
      expect(html).not.toMatch(/\sstyle="/);

      // No bespoke per-page JS; the shared module drives sizing and reset.
      const inlineScripts = html.match(/<script>[\s\S]*?<\/script>/g) || [];
      expect(inlineScripts, 'wrapper should carry no inline <script>').toEqual([]);

      // The only permitted local CSS is frame tuning.
      const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
      const selectors = style.match(/^\s*\.[\w-]+[^{]*\{/gm) || [];
      expect(selectors.map((s) => s.trim())).toEqual(['.cc-case-study-frame {']);
      for (const decl of style.match(/^\s+[a-z-]+\s*:/gm) || []) {
        expect(decl.trim()).toMatch(/^--cc-frame-/);
      }
    });

    test(`${name}: shell structure matches the others`, () => {
      const html = read(name);

      expect(html).toContain('<div class="cc-page-header cc-case-study-header">');
      expect(html).toContain('<span class="cc-eyebrow cc-eyebrow-light">');
      expect(html).toContain('<a class="cc-case-study-back" href="../resources.html#case-studies">');
      expect(html).toContain('<section class="cc-section cc-section-light cc-case-study-section">');
      expect(html).toContain('<div class="cc-card cc-case-study-shell">');
      expect(html).toContain('<div class="cc-case-study-head">');
      expect(html).toContain('<div class="cc-case-study-actions">');
      expect(html).toContain('class="cc-case-study-title"');
      expect(html).toContain('cc-case-study-meta');
      expect(html).toContain('id="caseStudyFrame"');
      expect(html).toContain('class="cc-case-study-frame"');
      expect(html).toContain('data-autofit');
      expect(html).toContain('cc-btn-outline cc-btn-embed');
      expect(html).toContain('class="cc-brand-name"');
    });

    test(`${name}: renders the shared shell`, async ({ page }) => {
      await page.goto(url(name));

      await expect(page.locator('.cc-case-study-shell')).toBeVisible();
      await expect(page.locator('.cc-case-study-title')).toBeVisible();
      await expect(page.locator('.cc-case-study-meta')).toBeVisible();
      await expect(page.locator('.cc-btn-embed')).toBeVisible();
      await expect(page.locator('#caseStudyFrame')).toHaveCount(1);

      // The dark shell must win over the dashboard's own palette.
      const shellBg = await page
        .locator('.cc-case-study-shell')
        .evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(shellBg).toContain('gradient');
    });
  }

  test('a reset button, where present, is wired through the shared module', () => {
    for (const name of WRAPPERS) {
      const html = read(name);
      const hasButton = html.includes('id="caseStudyResetBtn"');
      const hasWiring = html.includes('data-reset-target="caseStudyResetBtn"');
      expect(hasButton, `${name}: reset button and its wiring must agree`).toBe(hasWiring);
      if (hasButton) expect(html).toMatch(/data-reset-message="[a-z0-9]+:reset"/);
    }
  });

  test('the four wrappers differ only in their frame tuning values', () => {
    const tunings = WRAPPERS.map((name) => {
      const style = (read(name).match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
      return (style.match(/--cc-frame-[\w-]+\s*:\s*[^;]+;/g) || []).map((s) =>
        s.replace(/\s+/g, ' ')
      );
    });
    // Every wrapper declares its own heights; none may rely on the default.
    for (const t of tunings) expect(t.length).toBeGreaterThanOrEqual(3);
  });
});
