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
assert.match(
  resourcesHtml,
  /case_studies\/case-study-laterite-lca-tea\.html/,
  'resources page should link to the laterite case study'
);
assert.match(
  resourcesHtml,
  /case_studies\/case-study-jhuma-original\.html/,
  'resources page should link to the original Jhuma case study'
);
assert.match(
  resourcesHtml,
  /Laterite NHM Processing/i,
  'resources page should mention the laterite case study title'
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
  fs.existsSync(lateriteCaseStudyPath),
  'laterite case study page should exist'
);

const lateriteCaseStudyHtml = fs.readFileSync(lateriteCaseStudyPath, 'utf8');
assert.match(
  lateriteCaseStudyHtml,
  /Laterite NHM Processing/i,
  'laterite case study should identify the laterite NHM processing topic'
);
assert.match(
  lateriteCaseStudyHtml,
  /Critical metals recovery/i,
  'laterite case study should describe critical metals recovery'
);
assert.match(
  lateriteCaseStudyHtml,
  /laterite-case-study\.js/,
  'laterite case study should load the interactive script'
);
assert.match(
  lateriteCaseStudyHtml,
  /id="laterite-feed"/,
  'laterite case study should expose an editable dry feed input'
);
assert.match(
  lateriteCaseStudyHtml,
  /id="laterite-net-margin"/,
  'laterite case study should expose a live net margin output'
);
assert.match(
  lateriteCaseStudyHtml,
  /id="csAccordion"/,
  'laterite case study should use the full case-study accordion layout'
);
assert.match(
  lateriteCaseStudyHtml,
  /id="collapseBalance"/,
  'laterite case study should expose a mass-balance pane'
);
assert.match(
  lateriteCaseStudyHtml,
  /id="collapseTea"/,
  'laterite case study should expose a TEA pane'
);
assert.match(
  lateriteCaseStudyHtml,
  /id="collapseGWP"/,
  'laterite case study should expose a GWP pane'
);

const lateriteScriptPath = path.join(
  __dirname,
  '..',
  'case_studies',
  'laterite-case-study.js'
);
assert.ok(
  fs.existsSync(lateriteScriptPath),
  'interactive laterite script should exist'
);

const lateriteScript = fs.readFileSync(lateriteScriptPath, 'utf8');
assert.match(
  lateriteScript,
  /function calculateLateriteModel|const calculateLateriteModel/,
  'interactive laterite script should define the calculator'
);
assert.match(
  lateriteScript,
  /laterite-net-margin/,
  'interactive laterite script should update the net margin output'
);

const jhumaCaseStudyPath = path.join(
  __dirname,
  '..',
  'case_studies',
  'case-study-jhuma-original.html'
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
  /jhuma_data\/index\.html/,
  'original Jhuma wrapper should embed or reference the source model'
);
assert.match(
  jhumaCaseStudyHtml,
  /cc-page-header/,
  'original Jhuma wrapper should use the site page header shell'
);

console.log('site domain tests passed');
