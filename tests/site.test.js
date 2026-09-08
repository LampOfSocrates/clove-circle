const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getPreferredUrl,
  getCanonicalUrl,
} = require('../js/site.js');

const current = 'https://clovecircle.com/resources.html?topic=lca#tools';
assert.equal(getPreferredUrl(current), null);
assert.equal(getCanonicalUrl(current), current);

assert.equal(
  getPreferredUrl('https://www.clovecircle.com/about.html'),
  'https://clovecircle.com/about.html'
);

assert.equal(
  getPreferredUrl('https://lampofsocrates.github.io/clove-circle/contact.html?via=gh#form'),
  null
);

assert.equal(
  getCanonicalUrl('https://lampofsocrates.github.io/clove-circle/'),
  'https://lampofsocrates.github.io/clove-circle/'
);

const resourcesHtml = fs.readFileSync(
  path.join(__dirname, '..', 'resources.html'),
  'utf8'
);
assert.doesNotMatch(
  resourcesHtml,
  /case_studies\/case-study-laterite-lca-tea\.html/,
  'resources page should not link to the removed laterite case study'
);
assert.doesNotMatch(
  resourcesHtml,
  /Laterite NHM Processing/i,
  'resources page should not mention the removed laterite case study title'
);
assert.match(
  resourcesHtml,
  /Laterite to Metal Extraction/i,
  'resources page should mention the original Jhuma case study title'
);

const lateriteCaseStudyPath = path.join(
  __dirname,
  '..',
  'case_studies',
  'case-study-laterite-lca-tea.html'
);
assert.ok(
  !fs.existsSync(lateriteCaseStudyPath),
  'laterite case study page should be removed'
);

const lateriteScriptPath = path.join(
  __dirname,
  '..',
  'case_studies',
  'laterite-case-study.js'
);
assert.ok(
  !fs.existsSync(lateriteScriptPath),
  'interactive laterite script should be removed'
);

/* The four case-study wrapper pages were deleted: resources.html frames the
   same dashboards itself, so the wrappers were a second route to one thing and
   nothing linked them. Assert they are gone rather than that they are correct. */
for (const gone of [
  'wrapper-laterite-lca-tea.html',
  'wrapper-pha-lca-tea.html',
  'wrapper-flue2chem-lca-tea.html',
  'wrapper-palladium-lca-tea.html',
]) {
  assert.ok(
    !fs.existsSync(path.join(__dirname, '..', 'case_studies', gone)),
    `${gone} should be gone; resources.html frames the dashboard instead`
  );
}

assert.match(
  resourcesHtml,
  /standalone\/laterite-lca-tea\.html/,
  'resources page should frame the laterite dashboard directly'
);
assert.match(
  resourcesHtml,
  /standalone\/PHA-from-lignocellulose-lca-tea\.html/,
  'resources page should frame the PHA dashboard directly'
);

console.log('site domain tests passed');
