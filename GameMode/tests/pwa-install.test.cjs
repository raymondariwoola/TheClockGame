const assert = require('node:assert/strict');

delete require.cache[require.resolve('../js/pwa.js')];
const PWA = require('../js/pwa.js');

assert.equal(PWA.isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone' }), true);
assert.equal(PWA.isIOS({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 5 }), true, 'touch iPad desktop UA is detected');
assert.equal(PWA.isIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux armv8l' }), false);
assert.match(PWA.guidance({ userAgent: 'iPhone', platform: 'iPhone' }).text, /Share button/);
assert.match(PWA.guidance({ userAgent: 'Android', platform: 'Linux' }).text, /browser menu/);
assert.equal(PWA.isStandalone({ navigator: {}, matchMedia: () => ({ matches: true }) }), true);
assert.equal(PWA.isStandalone({ navigator: { standalone: true }, matchMedia: () => ({ matches: false }) }), true);
assert.equal(PWA.isStandalone({ navigator: {}, matchMedia: () => ({ matches: false }) }), false);
assert.equal(PWA.canApplyUpdate({ canApplyPwaUpdate: () => true }), true);
assert.equal(PWA.canApplyUpdate({ canApplyPwaUpdate: () => false }), false);
assert.equal(PWA.canApplyUpdate({ canApplyPwaUpdate: () => { throw new Error('not ready'); } }), false);

console.log('✓ PWA install guidance tests passed');
