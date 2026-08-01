const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

for (const id of ['menuStartBtn', 'menuStartLabel', 'menuModeSummary', 'dailyQuickCard', 'dailyQuickPlayBtn', 'dailyQuickDetailsBtn']) {
  assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} is unique`);
}
for (const mode of ['classic', 'endless', 'zen']) {
  assert.match(html, new RegExp(`class="[^"]*mode-card[^"]*" data-mode="${mode}"[^>]*aria-pressed=`), `${mode} is an announced selector`);
}

assert.match(game, /const KEY = 'cs_menu_mode_v1'/, 'last selected local mode persists independently of a run');
assert.match(game, /if \(CONFIG\.modes\[saved\]\) selected = saved/, 'only known persisted modes are accepted');
assert.match(game, /cards\.forEach\(\(card\) => card\.addEventListener\('click', \(\) => select\(card\.dataset\.mode\)\)\)/, 'mode taps select without starting');
assert.match(game, /startButton\?\.addEventListener\('click', start\)/, 'one explicit Start action launches the selection');
assert.match(game, /setTimeout\(\(\) => \{[\s\S]*?startMode\(selected\)/, 'Start delegates to the existing startMode path');
assert.match(game, /State\.dailyRun = false;[\s\S]*?State\.clashRun = null;/, 'ordinary Start clears prior special-run context');
assert.match(game, /dailyPlayBtn\?\.addEventListener\('click', launchDaily\);[\s\S]*?dailyQuickPlayBtn\?\.addEventListener\('click', launchDaily\)/, 'Daily full and compact actions share one launcher');
assert.match(game, /dailyQuickDetailsBtn[\s\S]*?MenuShell\.select\('compete'/, 'Daily details route to Compete');
assert.match(game, /b\.setAttribute\('aria-pressed', selected \? 'true' : 'false'\)/, 'difficulty selected state is announced');
assert.match(css, /\.menu-hub \.menu-modes\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, 'three compact mode choices remain on one row');
assert.match(css, /\.menu-start-btn\s*\{[\s\S]*?min-height:\s*58px;/, 'Start exceeds the touch-target minimum');
assert.match(css, /\.daily-quick\[hidden\]\s*\{\s*display:\s*none;/, 'Daily preview respects initial hidden state');

console.log('✓ compact Play selection delegates to unchanged run and Daily launch paths');
