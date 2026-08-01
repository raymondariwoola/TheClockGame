const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const pwa = fs.readFileSync(path.join(root, 'js', 'pwa.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

const progress = /id="menuHubProgress"[\s\S]*?id="menuHubSettings"/.exec(html)?.[0] || '';
const settings = /id="menuHubSettings"[\s\S]*?<\/section>\s*<\/main>/.exec(html)?.[0] || '';
for (const id of ['menuBest', 'menuCombo', 'menuRound', 'menuAchBtn', 'menuAchCount', 'menuAchSummary', 'menuCosBtn', 'menuCosSummary']) {
  assert.match(progress, new RegExp(`id="${id}"`), `${id} lives in Progress`);
}
for (const id of ['settingsIdentityBtn', 'settingsIdentityName', 'menuA11yBtn', 'pwaInstallBtn', 'pwaConnectionBtn']) {
  assert.match(settings, new RegExp(`id="${id}"`), `${id} lives in Settings`);
}
for (const heading of ['settingsProfileTitle', 'settingsComfortTitle', 'settingsAppTitle', 'settingsAboutTitle']) {
  assert.match(settings, new RegExp(`aria-labelledby="${heading}"[\\s\\S]*?id="${heading}"`), `${heading} names a Settings group`);
}

assert.match(game, /achSummary\.textContent = Achievements\.summary\(\)/, 'Progress reads its achievement summary from the achievement module');
assert.match(game, /cosSummary\.textContent = Cosmetics\.summary\(\)/, 'Progress reads its cosmetic summary from the cosmetics module');
assert.match(game, /const next = ChronosEngine\.ACHIEVEMENTS\.find/, 'achievement summary derives from the existing roster');
assert.match(game, /const r = resolved\(\);[\s\S]*?Equipped:/, 'cosmetic summary derives from the existing resolver');
assert.match(game, /settingsButton\.addEventListener\('click', open\)/, 'header and Settings profile use the existing identity overlay');
assert.match(game, /menuA11yBtn\.addEventListener\('click', \(\) => A11y\.open\(\)\)/, 'Settings comfort uses the existing accessibility module');
assert.match(game, /menuCosBtn\.addEventListener\('click', \(\) => Cosmetics\.open\(\)\)/, 'Progress cosmetics uses the existing overlay');
assert.match(pwa, /getElementById\('pwaInstallBtn'\)/);
assert.match(pwa, /getElementById\('pwaConnectionBtn'\)/);
assert.match(settings, /href="\.\.\/index\.html" class="back-home"/, 'Clock Quest route remains in About');
assert.match(css, /\.settings-action\s*\{[\s\S]*?min-height:\s*48px;/, 'Profile action exceeds the touch target minimum');

console.log('✓ Progress and Settings summarize existing local modules without duplicating persistence');
