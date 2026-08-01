const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const leaderboard = fs.readFileSync(path.join(root, 'leaderboard.js'), 'utf8');

function idCount(id) {
  return (html.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length;
}

const menuActionIds = [
  'playerIdentity',
  'dailyPlayBtn',
  'dailyChallengeBtn',
  'rivalInput',
  'rivalRaceBtn',
  'clashOpenBtn',
  'menuBoardBtn',
  'menuAchBtn',
  'menuCosBtn',
  'menuA11yBtn',
  'pwaInstallBtn',
  'pwaConnectionBtn',
];

const menuStateIds = [
  'menuBest',
  'menuCombo',
  'menuRound',
  'menuAchCount',
  'dailyCard',
  'dailyName',
  'dailyPreview',
  'dailyBest',
  'dailyAttempts',
  'dailyGhost',
  'dailyDone',
  'dailyCountdown',
];

for (const id of [...menuActionIds, ...menuStateIds]) {
  assert.equal(idCount(id), 1, `${id} must exist exactly once so its existing handler/state remains authoritative`);
}

for (const mode of ['classic', 'endless', 'zen']) {
  assert.equal((html.match(new RegExp(`class=["'][^"']*mode-card[^"']*["'][^>]*data-mode=["']${mode}["']`, 'g')) || []).length, 1,
    `${mode} must retain one mode-card entry point`);
}
for (const difficulty of ['easy', 'hardcore']) {
  assert.equal((html.match(new RegExp(`data-diff=["']${difficulty}["']`, 'g')) || []).length, 1,
    `${difficulty} must retain one difficulty entry point`);
}

const requiredBindings = [
  [/\$\$\('\.mode-card'\)\.forEach/, 'local mode handlers'],
  [/dailyPlayBtn\.addEventListener\('click'/, 'Daily launch handler'],
  [/rivalRaceBtn\.addEventListener\('click'/, 'Rival Code handler'],
  [/menuAchBtn\.addEventListener\('click'/, 'achievement handler'],
  [/menuCosBtn\.addEventListener\('click'/, 'cosmetics handler'],
  [/menuA11yBtn\.addEventListener\('click'/, 'accessibility handler'],
  [/chip\.addEventListener\('click', open\)/, 'identity handler'],
  [/canApplyPwaUpdate:\s*\(\)\s*=>\s*screens\.menu\.classList\.contains\('active'\)/, 'idle-menu update safety'],
];
for (const [pattern, label] of requiredBindings) assert.match(game, pattern, `${label} remains wired`);

assert.match(leaderboard, /menuBoardBtn/, 'Hall of Time remains wired by the leaderboard client');
assert.match(html, /data-board-mode="classic"/);
assert.match(html, /data-board-mode="endless"/);
assert.match(html, /data-board-mode="daily"/);
assert.match(html, /data-board-difficulty="normal"/);
assert.match(html, /data-board-difficulty="hardcore"/);
assert.match(html, /href="\.\.\/index\.html"[^>]*class="back-home"/, 'Clock Quest return remains available');

const protectedStorageKeys = [
  'cs_best_score',
  'cs_best_combo',
  'cs_best_round',
  'cs_player_name',
  'cs_achievements_v1',
  'cs_cosmetics_v1',
  'cs_daily_v1',
];
for (const key of protectedStorageKeys) assert.match(game, new RegExp(key), `${key} remains the existing storage authority`);

console.log('✓ menu interaction contract preserves every existing entry point and state authority');
