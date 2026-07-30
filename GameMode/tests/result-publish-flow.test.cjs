const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'leaderboard.js'), 'utf8');
const submitStart = source.indexOf("elNameForm?.addEventListener('submit'");
const submitEnd = source.indexOf("$('nameSkip')?.addEventListener", submitStart);
assert.ok(submitStart >= 0 && submitEnd > submitStart, 'leaderboard submit flow is present');
const submitFlow = source.slice(submitStart, submitEnd);

assert.doesNotMatch(submitFlow, /await\s+show\s*\(/, 'publishing must not navigate away from Results');
assert.match(submitFlow, /PUBLISHED —.*identity\.rankLabel/, 'successful publishing confirms the exact board rank on Results');
assert.match(submitFlow, /ChronosShare\.setRank/, 'published rank updates the retained share card');
assert.doesNotMatch(source, /GLOBAL #|GLOBAL RANK|LIVE GLOBAL/, 'partition ranks must never be presented as one global rank');
assert.match(source, /show\('over'\)/, 'Hall opened from Results remembers Results as its return screen');
assert.match(source, /BACK TO RESULTS/, 'Hall offers an explicit return to the completed run');
assert.match(source, /showScreen\(boardReturnScreen\)/, 'Hall back action restores its originating screen');

console.log('✓ result publishing preserves share and challenge flow');
