const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const ghostUi = fs.readFileSync(path.join(root, 'js', 'ghost-ui.js'), 'utf8');
const clashUi = fs.readFileSync(path.join(root, 'js', 'multiplayer-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

const compete = /<section class="menu-hub" id="menuHubCompete"[\s\S]*?<\/section>\s*<section class="menu-hub" id="menuHubProgress"/.exec(html)?.[0] || '';
for (const id of ['dailyCard', 'clashOpenBtn', 'rivalInput', 'rivalRaceBtn', 'menuBoardBtn']) {
  assert.match(compete, new RegExp(`id="${id}"`), `${id} lives in Compete`);
}
for (const heading of ['competeClashTitle', 'competeGhostTitle', 'competeHallTitle']) {
  assert.match(compete, new RegExp(`aria-labelledby="${heading}"[\\s\\S]*?id="${heading}"`), `${heading} names its feature card`);
}
assert.match(compete, /for="rivalInput"/, 'Rival Code input has a programmatic label');
assert.match(compete, /id="rivalError" role="alert" hidden/, 'Rival errors are announced');
assert.match(game, /params\.has\('ghost'\) \|\| params\.has\('duel'\)/, 'Ghost and Clash deep links select Compete behind their modal');
assert.match(ghostUi, /ChronosGhostClient\.codeFromUrl\(location\.href\)/, 'Ghost module remains the challenge authority');
assert.match(clashUi, /ChronosMultiplayerClient\.codeFromUrl\(location\.href\)/, 'Clash module remains the room authority');
assert.match(clashUi, /getElementById\('clashOpenBtn'\)\?\.addEventListener\('click', openMenu\)/, 'Clash card calls its existing menu');
assert.match(css, /#menuHubCompete\s*\{[\s\S]*?max-width:\s*680px;/, 'Compete remains a readable mobile-width stack');

console.log('✓ Compete groups Daily, Clash, Ghost/Rival, and every Hall board without changing protocols');
