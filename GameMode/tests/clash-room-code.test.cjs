const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'js', 'multiplayer-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

assert.match(ui, /function roomCodePanel\(code\)[\s\S]*?normalizeCode\(code\)[\s\S]*?SAY OR TYPE THIS CODE/, 'lobby builds a dedicated voiceable room-code panel');
assert.match(ui, /clash-room-code[\s\S]*?Room code[\s\S]*?split\(''\)\.join\(' '\)/, 'room code has a character-by-character accessible label');
assert.match(ui, /COPY CODE[\s\S]*?clipboard\.writeText\(normalized\)/, 'code-only copy excludes the link and private capabilities');
assert.match(ui, /showLobby\(room[\s\S]*?appendChild\(roomCodePanel\(room\.code\)\)/, 'host and guest lobby views display the room code');
assert.match(css, /\.clash-code-panel[\s\S]*?\.clash-room-code[\s\S]*?letter-spacing:\s*5px/, 'room code has a prominent readable treatment');

console.log('✓ Clash lobby exposes a large voiceable and code-only-copy room code');
