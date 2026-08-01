const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

const destinations = ['play', 'compete', 'progress', 'settings'];
for (const name of destinations) {
  const title = name[0].toUpperCase() + name.slice(1);
  assert.equal((html.match(new RegExp(`data-menu-nav="${name}"`, 'g')) || []).length, 1, `${name} has one navigation control`);
  assert.equal((html.match(new RegExp(`data-menu-destination="${name}"`, 'g')) || []).length, 1, `${name} has one destination panel`);
  assert.match(html, new RegExp(`aria-controls="menuHub${title}"`), `${name} navigation names its panel`);
  assert.match(html, new RegExp(`id="menuHub${title}"[\\s\\S]*?aria-labelledby="menuHub${title}Title"`), `${name} panel names its heading`);
}

assert.equal((html.match(/aria-current="page"/g) || []).length, 1, 'only initial Play is current in static markup');
assert.match(html, /id="menuHubCompete"[^>]*hidden inert/, 'inactive Compete is hidden and inert before script load');
assert.match(html, /id="menuHubProgress"[^>]*hidden inert/, 'inactive Progress is hidden and inert before script load');
assert.match(html, /id="menuHubSettings"[^>]*hidden inert/, 'inactive Settings is hidden and inert before script load');
assert.match(game, /const destinations = \['play', 'compete', 'progress', 'settings'\]/, 'controller allows only the four stable destinations');
assert.match(game, /panel\.hidden = !active;[\s\S]*?panel\.inert = !active;/, 'inactive panels leave visual and accessibility navigation');
assert.match(game, /setAttribute\('aria-current', 'page'\)/, 'active destination is announced');
assert.match(game, /ArrowRight[\s\S]*?ArrowLeft[\s\S]*?Home[\s\S]*?End/, 'navigation supports directional and boundary keys');
assert.match(game, /window\.ChronosMenu = MenuShell/, 'deep-link modules can select a destination without duplicating menu state');
assert.match(css, /\.menu-nav\s*\{[\s\S]*?position:\s*fixed;/, 'mobile navigation remains visible');
assert.match(css, /bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\)/, 'navigation respects the bottom safe area');
assert.match(css, /\.menu-nav-btn\s*\{[\s\S]*?min-height:\s*52px;/, 'navigation exceeds the 44px touch-target design minimum');
assert.match(css, /\.menu-hub\[hidden\]\s*\{\s*display:\s*none !important;/, 'hidden destination CSS cannot be overridden by flex layout');

console.log('✓ menu shell exposes four stable, accessible destinations');
