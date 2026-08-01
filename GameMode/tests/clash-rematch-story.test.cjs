const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { rematchStory } = require('../js/multiplayer.js');

const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'js', 'multiplayer-ui.js'), 'utf8');
const room = fs.readFileSync(path.join(root, 'worker', 'src', 'match-room.js'), 'utf8');

assert.deepEqual(rematchStory({ matchNumber: 1, result: { winner: 'host', reason: 'score', story: { margin: 28, leadChanges: 3, closestGap: 4 } } }, 'host'),
  { headline: 'WON BY 28', details: ['3 LEAD CHANGES', 'CLOSEST GAP · 4'] });
assert.equal(rematchStory({ result: { winner: 'guest', reason: 'disconnect', story: {} } }, 'host').headline, 'LOSS BY DISCONNECT');
assert.equal(rematchStory({ result: { winner: null, reason: 'draw', story: {} } }, 'guest').headline, 'TIMELINE DRAW');
assert.match(room, /function trackStory[\s\S]*?leadChanges\+\+[\s\S]*?closestGap/, 'Worker retains bounded counters instead of a timeline');
assert.match(room, /story: resultStory\(room, result\)/, 'final result freezes its compact story');
assert.match(ui, /clash-rematch-story[\s\S]*?storyModel\.headline[\s\S]*?REMATCH/, 'story is paired with the existing rematch action');
assert.match(ui, /RECONNECTING · RUN CONTINUES[\s\S]*?MINUTE GRACE/, 'live HUD explains that play continues during the reconnect grace');
assert.match(ui, /Your live connection did not return within/, 'disconnect results explain why a local player lost');

console.log('✓ compact rematch stories are perspective-aware, bounded, and paired with rematch');
