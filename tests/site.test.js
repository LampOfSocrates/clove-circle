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
assert.match(
  resourcesHtml,
  /case_studies\/original-laterite-lca-tea\.html/,
  'resources page should link to the original Jhuma case study'
);
assert.match(
  resourcesHtml,
  /case_studies\/case-study-jhuma-pha-original\.html/,
  'resources page should link to the original Jhuma PHA case study'
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

const jhumaCaseStudyPath = path.join(
  __dirname,
  '..',
  'case_studies',
  'original-laterite-lca-tea.html'
);
assert.ok(
  fs.existsSync(jhumaCaseStudyPath),
  'original Jhuma case study wrapper page should exist'
);

const jhumaCaseStudyHtml = fs.readFileSync(jhumaCaseStudyPath, 'utf8');
assert.match(
  jhumaCaseStudyHtml,
  /Clove Circle \| Laterite to Metal Extraction/i,
  'original Jhuma wrapper should use a case-study page title'
);
assert.match(
  jhumaCaseStudyHtml,
  /href="\.\.\/resources\.html"/,
  'original Jhuma wrapper should link back to resources'
);
assert.match(
  jhumaCaseStudyHtml,
  /jhuma_data\/laterite-lca-tea\.html/,
  'original Jhuma wrapper should embed or reference the source model'
);
assert.match(
  jhumaCaseStudyHtml,
  /cc-page-header/,
  'original Jhuma wrapper should use the site page header shell'
);

const jhumaPhaCaseStudyPath = path.join(
  __dirname,
  '..',
  'case_studies',
  'case-study-jhuma-pha-original.html'
);
assert.ok(
  fs.existsSync(jhumaPhaCaseStudyPath),
  'original Jhuma PHA wrapper page should exist'
);

const jhumaPhaCaseStudyHtml = fs.readFileSync(jhumaPhaCaseStudyPath, 'utf8');
assert.match(
  jhumaPhaCaseStudyHtml,
  /Clove Circle \| PHA from Lignocellulose/i,
  'original Jhuma PHA wrapper should use a case-study page title'
);
assert.match(
  jhumaPhaCaseStudyHtml,
  /href="\.\.\/resources\.html"/,
  'original Jhuma PHA wrapper should link back to resources'
);
assert.match(
  jhumaPhaCaseStudyHtml,
  /jhuma_data\/PHA-from-lignocellulose-lca-tea\.html/,
  'original Jhuma PHA wrapper should embed or reference the source model'
);

console.log('site domain tests passed');
