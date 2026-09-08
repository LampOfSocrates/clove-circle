const { test, expect } = require('@playwright/test');

/* Site-relative, resolved against the config's baseURL. Not file://: Chromium
   gives every local file an opaque origin, so localStorage throws and an
   iframe cannot read its own contentDocument — a file:// run exercises a
   weaker environment than the one users get. */
const page_ = name => '/case_studies/stepbystep/' + name;
const resources = '/resources.html';

// Values published by each standalone dashboard at its default inputs. The
// step-by-step models must keep reproducing them.
const CASES = [
  {
    name: 'Flue2Chem',
    file: 'flue2chem.html',
    stream: 'stream-flue',
    inputField: '#f_flue_in',
    kpis: ['1,108.8 t/d', '2,167.6 $M', '6,469.7 $/t', '417.0 $M']
  },
  {
    name: 'Palladium',
    file: 'palladium.html',
    stream: 'stream-feed',
    inputField: '#f_throughput',
    kpis: ['1,011.0 kg/y', '33.00 $M', '11,731 $/kg']
  },
  {
    name: 'Laterite',
    file: 'laterite.html',
    stream: 'stream-ncl',
    inputField: '#f_ncl',
    kpis: ['0.295 kg/h', '3.45 $M', '1.33 $M']
  }
];

for (const c of CASES) {
  test.describe('Step by step — ' + c.name, () => {
    test('runs all eight steps with no page errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(page_(c.file));

      await expect(page.locator('[data-cc-rail] .cc-step')).toHaveCount(8);

      await page.locator('[data-cc-solve-all]').click();
      await expect(page.locator('.cc-step.is-solved')).toHaveCount(6);
      await expect(page.locator('.cc-step.is-locked')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('mass balance closes', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-rail] .cc-step').nth(1).click();
      await page.locator('[data-cc-solve="mass"]').click();
      await expect(page.locator('.cc-closure')).toHaveClass(/is-ok/);
      await expect(page.locator('.cc-closure-err')).toContainText('0.00%');
    });

    test('reproduces the published dashboard figures', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-solve-all]').click();
      const kpiText = (await page.locator('.cc-kpi').allInnerTexts()).join(' ');
      for (const v of c.kpis) expect(kpiText).toContain(v);
    });

    test('later steps are locked until the mass balance has run', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-rail] .cc-step').nth(3).click();
      await expect(page.locator('[data-cc-solve="lcia"]')).toBeDisabled();
    });

    test('clicking a stream opens the inspector and editing marks downstream stale', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-solve-all]').click();
      await expect(page.locator('.cc-kpi.is-stale')).toHaveCount(0);

      await page.locator('[data-hit="' + c.stream + '"]').click();
      const field = page.locator(c.inputField);
      await expect(field).toBeVisible();

      const before = await field.inputValue();
      await field.fill(String(Number(before.replace(/,/g, '')) * 0.5));
      await field.press('Enter');

      // Every stage from the mass balance down is now stale.
      await expect(page.locator('.cc-kpi.is-stale')).toHaveCount(6);
      await expect(page.locator('.cc-step.is-solved')).toHaveCount(0);
    });

    test('a computed stream shows its formula rather than an input box', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-solve-all]').click();
      await page.locator('.cc-hit-computed').first().click();
      await expect(page.locator('.cc-field-computed').first()).toBeVisible();
      await expect(page.locator('.cc-field-formula code').first()).not.toBeEmpty();
    });

    test('the step rail is a horizontal breadcrumb, not a sidebar', async ({ page }) => {
      await page.goto(page_(c.file));
      const first = await page.locator('[data-cc-rail] .cc-step').nth(0).boundingBox();
      const second = await page.locator('[data-cc-rail] .cc-step').nth(1).boundingBox();
      expect(second.x).toBeGreaterThan(first.x);
      expect(Math.abs(second.y - first.y)).toBeLessThan(3);
      // and it stays short, so it costs almost no vertical space
      const rail = await page.locator('.cc-rail').boundingBox();
      expect(rail.height).toBeLessThan(90);
    });

    test('the flowsheet takes about half the main column', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(page_(c.file));
      const pct = await page.evaluate(() => {
        const wrap = document.querySelector('[data-cc-diagram]');
        const split = document.querySelector('.cc-main-split');
        return wrap.getBoundingClientRect().width / split.getBoundingClientRect().width;
      });
      expect(pct).toBeGreaterThan(0.4);
      expect(pct).toBeLessThanOrEqual(0.52);
    });

    test('the flowsheet sits beside the teaching card, not above it', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(page_(c.file));
      const [diag, card] = await Promise.all([
        page.locator('[data-cc-diagram]').boundingBox(),
        page.locator('[data-cc-card]').boundingBox()
      ]);
      expect(card.x).toBeGreaterThan(diag.x + diag.width - 1);
    });

    test('the opening step fits one screen', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(page_(c.file));
      const h = await page.evaluate(() => document.body.scrollHeight);
      // A little slack for font-loading jitter; later steps are allowed to spill.
      expect(h).toBeLessThanOrEqual(1100);
    });

    test('"Try it" sits under the flowsheet', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(page_(c.file));
      await page.locator('[data-cc-rail] .cc-step').nth(1).click();
      const tryIt = page.locator('[data-cc-tryit] .cc-card-try');
      await expect(tryIt).toBeVisible();
      const [t, diag, card] = await Promise.all([
        tryIt.boundingBox(),
        page.locator('[data-cc-diagram]').boundingBox(),
        page.locator('[data-cc-card]').boundingBox()
      ]);
      expect(t.y).toBeGreaterThan(diag.y);          // below the flowsheet
      expect(t.x).toBeLessThan(card.x);             // in the flowsheet column
      await expect(page.locator('[data-cc-card] .cc-card-try')).toHaveCount(0);
    });

    test('the diamond marker renders as a glyph, not an escape', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-rail] .cc-step').nth(1).click();
      const marker = await page.evaluate(() => {
        const el = document.querySelector('.cc-mini-field.is-on-diagram .cc-mini-label');
        return el ? getComputedStyle(el, '::after').content : '';
      });
      expect(marker).not.toContain('C8');
    });

    test('diagram text stays legible at that size', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(page_(c.file));
      const px = await page.evaluate(() => {
        const svg = document.querySelector('[data-cc-diagram] svg');
        return {
          block: svg.querySelector('.cc-blk-label').getBoundingClientRect().height,
          stream: svg.querySelector('.cc-stream-label').getBoundingClientRect().height
        };
      });
      // Rendered, not viewBox, size: the sheet is drawn at about half scale.
      expect(px.block).toBeGreaterThanOrEqual(11);
      expect(px.stream).toBeGreaterThanOrEqual(9);
    });

    test('no rectangles or labels overlap on the flowsheet', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(page_(c.file));
      // Solve first, so labels carry real values rather than the placeholder dash.
      await page.locator('[data-cc-solve-all]').click();

      const bad = await page.evaluate(() => {
        const svg = document.querySelector('[data-cc-diagram] svg');
        const items = [];
        svg.querySelectorAll('rect, text').forEach(el => {
          const g = el.closest('.cc-hit');
          const bb = el.getBBox();
          if (!bb.width || !bb.height) return;
          items.push({
            kind: el.tagName.toLowerCase(), cls: el.getAttribute('class') || '',
            group: g ? g.getAttribute('data-hit') : null,
            text: el.tagName.toLowerCase() === 'text' ? el.textContent.trim().slice(0, 22) : '',
            x: bb.x, y: bb.y, w: bb.width, h: bb.height
          });
        });
        const ov = (a, c) => {
          const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
          const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
          return ox > 1 && oy > 1;
        };
        const pad = x => x.cls.includes('cc-hit-pad');
        const blk = x => x.cls.includes('cc-blk') && x.kind === 'rect';
        const txt = x => x.kind === 'text';
        const out = [];
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i], c = items[j];
            if (a.group && c.group && a.group === c.group) continue;
            const interesting = (pad(a) && blk(c)) || (blk(a) && pad(c)) || (pad(a) && pad(c)) ||
              (txt(a) && blk(c)) || (blk(a) && txt(c)) || (txt(a) && txt(c));
            if (interesting && ov(a, c)) {
              out.push((a.group || '-') + ':' + (a.text || a.cls) +
                ' >< ' + (c.group || '-') + ':' + (c.text || c.cls));
            }
          }
        }
        return out;
      });
      expect(bad).toEqual([]);
    });

    test('nothing is drawn outside the viewBox', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-solve-all]').click();
      const outside = await page.evaluate(() => {
        const svg = document.querySelector('[data-cc-diagram] svg');
        const vb = svg.viewBox.baseVal;
        const out = [];
        svg.querySelectorAll('rect, text').forEach(el => {
          const b = el.getBBox();
          if (!b.width || !b.height) return;
          if (b.x < -1 || b.y < -1 || b.x + b.w > vb.width + 1 || b.y + b.height > vb.height + 1) {
            out.push(el.textContent.trim().slice(0, 20) || el.getAttribute('class'));
          }
        });
        return out;
      });
      expect(outside).toEqual([]);
    });

    test('the flowsheet is not cut off at desktop width', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(page_(c.file));
      const clipped = await page.evaluate(() => {
        const wrap = document.querySelector('[data-cc-diagram]');
        return wrap.scrollWidth > wrap.clientWidth + 1;
      });
      expect(clipped).toBe(false);
    });

    test('selecting a worked-numbers row highlights the flowsheet', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-solve-all]').click();
      await page.locator('[data-cc-rail] .cc-step').nth(1).click();

      const row = page.locator('.cc-thiscase-table tr.is-linked').first();
      await expect(row).toBeVisible();
      await row.click();

      await expect(page.locator('.cc-hit.is-highlit').first()).toBeVisible();
      await expect(page.locator('.cc-diagram-wrap')).toHaveClass(/is-focusing/);
      await expect(row).toHaveClass(/is-picked/);

      // clicking the same row again clears it
      await row.click();
      await expect(page.locator('.cc-hit.is-highlit')).toHaveCount(0);
    });

    test('clicking an input label highlights that field on the flowsheet', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-rail] .cc-step').nth(1).click();

      const label = page.locator('.cc-mini-field.is-on-diagram .cc-mini-label').first();
      await expect(label).toHaveJSProperty('tagName', 'BUTTON');
      await label.click();

      await expect(page.locator('.cc-hit.is-highlit')).toHaveCount(1);
      await expect(page.locator('.cc-hit.is-selected')).toHaveCount(1);
      await expect(page.locator('.cc-insp-head h4')).toBeVisible();
    });

    test('clicking the flowsheet clears a table-driven highlight', async ({ page }) => {
      await page.goto(page_(c.file));
      await page.locator('[data-cc-solve-all]').click();
      await page.locator('[data-cc-rail] .cc-step').nth(1).click();
      await page.locator('.cc-thiscase-table tr.is-linked').first().click();
      await expect(page.locator('.cc-diagram-wrap')).toHaveClass(/is-focusing/);

      await page.locator('[data-hit="' + c.stream + '"]').click();
      await expect(page.locator('.cc-diagram-wrap')).not.toHaveClass(/is-focusing/);
      await expect(page.locator('.is-picked')).toHaveCount(0);
    });

    test('percent and fraction entry mean the same thing', async ({ page }) => {
      await page.goto(page_(c.file));
      // Find any fraction-dimension input via the step fields.
      const ok = await page.evaluate(() => {
        const U = window.CCUnits;
        const a = U.parseEntry('85%', 'fraction', 'fraction');
        const b = U.parseEntry('0.85', 'fraction', 'fraction');
        const c = U.parseEntry('85', 'fraction', 'fraction');
        return a.value === 0.85 && b.value === 0.85 && c.value === 0.85;
      });
      expect(ok).toBe(true);
    });

    test('the unit picker converts without changing the quantity', async ({ page }) => {
      await page.goto(page_(c.file));
      const same = await page.evaluate(() => {
        const U = window.CCUnits;
        const canonical = U.toCanonical(500, 'mass_flow', 't/h');
        return canonical === 12000 && U.fromCanonical(canonical, 'mass_flow', 't/h') === 500;
      });
      expect(same).toBe(true);
    });
  });
}

test.describe('Resources page', () => {
  test('has an LCA Step by Step tab alongside Case Studies', async ({ page }) => {
    await page.goto(resources);
    await expect(page.locator('#case-studies-tab')).toBeVisible();
    await expect(page.locator('#step-by-step-tab')).toBeVisible();
    await page.click('#step-by-step-tab');
    await expect(page.locator('#sbsTabs button')).toHaveCount(3);
  });

  test('leaves the existing four case studies untouched', async ({ page }) => {
    await page.goto(resources);
    await expect(page.locator('#caseStudyTabs button')).toHaveCount(4);
    for (const id of ['laterite-tab', 'pha-tab', 'flue2chem-tab', 'palladium-tab']) {
      await expect(page.locator('#' + id)).toBeVisible();
    }
  });

  test('sizes each embedded page to its content instead of clipping', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(resources);
    await page.click('#step-by-step-tab');
    const frameEl = page.locator('#sbs-flue2chem-pane iframe');
    const frame = page.frameLocator('#sbs-flue2chem-pane iframe');

    const heightNow = async () => {
      const box = await frameEl.boundingBox();
      return box ? box.height : 0;
    };
    const opening = await heightNow();

    await frame.locator('[data-cc-solve-all]').click();
    await frame.locator('[data-cc-rail] .cc-step').nth(1).click();

    // The mass-balance step is taller than the opening step; the host must grow
    // to match rather than clipping it.
    await expect.poll(heightNow, { timeout: 8000 }).toBeGreaterThan(opening + 100);

    // and the last card on the page is reachable, not cut off
    await expect(frame.locator('.cc-card-try')).toBeVisible();
  });

  test('the step-by-step pane breaks out to full page width', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(resources);
    await page.click('#step-by-step-tab');
    const bleed = await page.locator('#sbs-flue2chem-pane .cc-sbs-fullbleed').boundingBox();
    // full-bleed: as wide as the viewport, not the narrower Bootstrap container
    expect(bleed.width).toBeGreaterThan(1500);
  });

  test('embeds each step-by-step page', async ({ page }) => {
    await page.goto(resources);
    await page.click('#step-by-step-tab');
    const frame = page.frameLocator('#sbs-flue2chem-pane iframe');
    await expect(frame.locator('.cc-sbs-header h2')).toContainText('Flue2Chem');
  });
});
