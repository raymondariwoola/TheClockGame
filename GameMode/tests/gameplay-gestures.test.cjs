const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

delete require.cache[require.resolve('../js/gameplay-gestures.js')];
const Gestures = require('../js/gameplay-gestures.js');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const source = fs.readFileSync(path.join(root, 'js', 'gameplay-gestures.js'), 'utf8');

const activeGame = { classList: { contains: (name) => name === 'active' } };
const idleGame = { classList: { contains: () => false } };
let prevented = 0;
const cancelable = { cancelable: true, preventDefault: () => { prevented++; } };
assert.equal(Gestures.gameIsActive(activeGame), true);
assert.equal(Gestures.gameIsActive(idleGame), false);
assert.equal(Gestures.blockGameZoom(cancelable, activeGame), true);
assert.equal(prevented, 1);
assert.equal(Gestures.blockGameZoom(cancelable, idleGame), false, 'informational screens are not blocked');
assert.equal(prevented, 1);
assert.equal(Gestures.blockGameZoom({ cancelable: false, preventDefault: () => { prevented++; } }, activeGame), false);

assert.match(css, /#screen-game[\s\S]*?touch-action:\s*none;/, 'game screen must disable browser gestures');
assert.match(css, /#screen-menu,[\s\S]*?#screen-over,[\s\S]*?#screen-board,[\s\S]*?\.overlay[\s\S]*?touch-action:\s*manipulation;/, 'informational surfaces retain panning and pinch zoom');
const viewport = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1] || '';
assert.equal(/user-scalable\s*=\s*no/i.test(viewport), false, 'global browser zoom must remain available');
assert.equal(/maximum-scale/i.test(viewport), false, 'viewport must not globally cap zoom');
assert.match(source, /'gesturestart', 'gesturechange'/, 'Safari pinch fallback must be scoped to the game element');
assert.match(source, /game\.addEventListener\('dblclick'/, 'double-tap fallback must be scoped to the game element');

console.log('✓ gameplay gesture lock tests passed');
