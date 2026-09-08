// @ts-check
/**
 * Navigation reachability and dead-end checks.
 *
 * These are filesystem checks, not browser ones — they read the HTML and walk
 * the link graph, so they need no server and catch the failure that actually
 * happened here: the navbar pointed at index.html#about while about.html,
 * services.html and contact.html existed as real pages, so five pages had no
 * inbound links at all and could only be reached by typing the URL.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');

/** Every page on the site, as repo-relative posix paths. */
function allPages(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // lcagraph/app is now embedded and linked from resources.html, so it is a
    // site page and the dead-end rule applies to it. Its src/, schema/, models/
    // and tests/ are library code, not pages.
    const SKIP = ['node_modules', '.git', 'test-results', 'playwright-report', 'docs',
                  'src', 'schema', 'models'];
    if (SKIP.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) allPages(full, out);
    else if (entry.name.endsWith('.html')) out.push(path.relative(ROOT, full).split(path.sep).join('/'));
  }
  return out;
}

const PAGES = allPages().sort();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Internal page links out of a page, resolved to repo-relative paths. */
function linksFrom(page) {
  const dir = path.posix.dirname(page);
  const hrefs = [...read(page).matchAll(/(?:href|src)="([^"#][^"]*?\.html)(?:[#?][^"]*)?"/g)]
    .map((m) => m[1])
    .filter((h) => !/^(?:[a-z]+:|\/\/)/i.test(h));
  return [...new Set(hrefs.map((h) => path.posix.normalize(path.posix.join(dir, h))))]
    .filter((t) => PAGES.includes(t));
}

// The wrappers are reachable only by URL: resources.html embeds the standalone
// dashboards directly rather than linking these. Listed so the reachability
// assertion below stays honest about what is actually orphaned.
const KNOWN_ORPHANS = PAGES.filter((p) => /wrapper-.*\.html$/.test(p));

test.describe('site navigation', () => {
  test('every internal link points at a file that exists', () => {
    /** @type {string[]} */
    const broken = [];
    for (const page of PAGES) {
      const dir = path.posix.dirname(page);
      for (const m of read(page).matchAll(/(?:href|src)="([^"#][^"]*?\.html)(?:[#?][^"]*)?"/g)) {
        if (/^(?:[a-z]+:|\/\/)/i.test(m[1])) continue; // external URL that happens to end in .html
        const target = path.posix.normalize(path.posix.join(dir, m[1]));
        if (!fs.existsSync(path.join(ROOT, target))) broken.push(`${page} -> ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test('every page except the known orphans is reachable from the homepage', () => {
    const seen = new Set(['index.html']);
    const queue = ['index.html'];
    while (queue.length) {
      for (const target of linksFrom(queue.shift())) {
        if (!seen.has(target)) { seen.add(target); queue.push(target); }
      }
    }
    const unreachable = PAGES.filter((p) => !seen.has(p));
    expect(unreachable.sort()).toEqual(KNOWN_ORPHANS.sort());
  });

  test('the nav links at the real pages, not homepage anchors', () => {
    // about.html / services.html / contact.html carry ~3x the content of the
    // homepage teaser sections; pointing the nav at the anchors orphaned them.
    for (const page of PAGES.filter((p) => read(p).includes('navbar-brand'))) {
      const html = read(page);
      const nav = html.slice(html.indexOf('<nav class="navbar'), html.indexOf('</nav>'));
      for (const anchor of ['#about', '#services', '#contact']) {
        expect(nav, `${page} nav still points at ${anchor}`).not.toContain(`href="${anchor}"`);
        expect(nav, `${page} nav still points at index.html${anchor}`).not.toContain(`index.html${anchor}"`);
      }
    }
  });

  test('every chrome-bearing page has a navbar, the Resources menu and a footer', () => {
    for (const page of PAGES.filter((p) => read(p).includes('navbar-brand'))) {
      const html = read(page);
      expect(html, `${page}: Resources menu`).toContain('cc-nav-resources');
      expect(html, `${page}: footer`).toContain('<footer class="cc-footer"');
    }
  });

  test('no page is a dead end', () => {
    // A page with no navbar must offer its own way back, or a visitor who
    // opens it directly (every link to these uses target="_blank", so the tab
    // has no history) is stranded.
    for (const page of PAGES) {
      const html = read(page);
      if (html.includes('navbar-brand')) continue;
      expect(html, `${page} has neither site chrome nor a back link`).toContain('cc-back-home');
    }
  });

  test('back links resolve and are hidden when embedded', () => {
    for (const page of PAGES.filter((p) => read(p).includes('cc-back-home'))) {
      const html = read(page);
      const href = html.match(/class="cc-back-home" href="([^"#]+)/);
      expect(href, `${page}: back link href`).toBeTruthy();
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(page), href[1]));
      expect(fs.existsSync(path.join(ROOT, target)), `${page} -> ${href[1]}`).toBe(true);
      expect(html, `${page}: back link must hide in-frame`).toContain('body.in-frame .cc-back-home');
      expect(html, `${page}: needs the in-frame hook`).toContain("classList.add('in-frame')");
    }
  });
});
