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
  /Laterite NHM Processing/i,
  'resources page should mention the laterite case study title'
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

console.log('site domain tests passed');
