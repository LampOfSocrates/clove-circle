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
  null
);

assert.equal(
  getCanonicalUrl('https://lampofsocrates.github.io/clove-circle/'),
  'https://lampofsocrates.github.io/clove-circle/'
);

console.log('site domain tests passed');
