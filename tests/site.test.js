const assert = require('node:assert/strict');

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
  'https://clovecircle.com/contact.html?via=gh#form'
);

assert.equal(
  getCanonicalUrl('https://lampofsocrates.github.io/clove-circle/'),
  'https://clovecircle.com/'
);

console.log('site domain tests passed');
