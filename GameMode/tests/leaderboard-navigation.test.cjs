const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const client = fs.readFileSync(path.join(root, 'leaderboard.js'), 'utf8');
const sharing = fs.readFileSync(path.join(root, 'share.js'), 'utf8');

for (const mode of ['classic', 'endless', 'daily']) {
  assert.match(html, new RegExp(`data-board-mode="${mode}"`), `${mode} board is directly selectable`);
}
for (const difficulty of ['normal', 'hardcore']) {
  assert.match(html, new RegExp(`data-board-difficulty="${difficulty}"`), `${difficulty} board is directly selectable`);
}

assert.match(html, /id="boardContext"[^>]*aria-live="polite"/, 'the active board identity is announced');
assert.match(client, /BOARD_PREF_KEY/, 'standard board selection persists independently of the last run');
assert.match(client, /returnTo === 'menu'[^\n]+loadBoardPreference/, 'menu Hall opens the chosen board, not a hidden last-run partition');
assert.match(client, /Daily Rift uses Normal difficulty/, 'Daily explicitly disables its unsupported Hardcore variant');
assert.match(client, /requestSequence !== boardLoadSequence/, 'rapid board switching ignores stale network responses');
assert.match(client, /setRank\(rank, identity\.rankLabel\)/, 'result sharing receives the exact rank board');
assert.doesNotMatch(sharing, /GLOBAL #|Global #|Global rank/, 'share cards do not mislabel partition ranks as global');

console.log('✓ leaderboard boards are explicit, switchable, and rank-labelled');
