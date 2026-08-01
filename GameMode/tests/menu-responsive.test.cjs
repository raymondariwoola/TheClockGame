const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const pwa = fs.readFileSync(path.join(root, 'js', 'pwa.js'), 'utf8');

assert.match(css, /@media \(min-width: 900px\)[\s\S]*?#menuHubCompete,[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, 'wide destinations use two related columns');
assert.match(css, /@media \(min-width: 1200px\)[\s\S]*?\.menu-nav\s*\{[\s\S]*?grid-template-columns:\s*1fr;/, 'large desktop uses a navigation rail');
assert.match(css, /@media \(max-height: 520px\) and \(orientation: landscape\)[\s\S]*?\.menu-nav\s*\{[\s\S]*?width:\s*98px;/, 'short landscape uses a left rail');
assert.match(css, /\.pwa-connection-toast\s*\{[\s\S]*?max-width:\s*min\(235px/, 'small-phone cloud notice is compact');
assert.match(html, /class="clock-stack"[\s\S]*?id="objectiveHud"[\s\S]*?id="powerups"[\s\S]*?class="clock-stage"/, 'objectives and powers share responsive gameplay flow with the clock');
assert.match(css, /\.objective-hud\s*\{\s*position:\s*static[\s\S]*?\.objective-hud\[hidden\]\s*\{\s*display:\s*none/, 'Objective Cards cannot float over the score HUD and honor their hidden state');
assert.match(css, /@media \(max-width: 500px\)[\s\S]*?grid-template-areas:\s*'left right' 'center center'[\s\S]*?\.clock-stack\s*\{[^}]*?flex:\s*0 1 auto;[^}]*?justify-content:\s*flex-start;[\s\S]*?\.clock-stage\s*\{\s*width:\s*min\(80vw, 380px\)/, 'narrow gameplay anchors objectives below the HUD and restores a width-led clock');
assert.match(css, /@media \(max-width: 500px\) and \(max-height: 600px\)[\s\S]*?\.clock-stage\s*\{\s*width:\s*min\(80vw, 46dvh, 380px\)/, 'genuinely short phone viewports retain a height-aware clock safeguard');
assert.match(css, /@media \(max-width: 500px\)[\s\S]*?\.powerups\s*\{\s*position:\s*static/, 'mobile powers remain in gameplay flow instead of covering the HUD');
assert.match(game, /if \(window\.anime && A11y\.motion\(\)\)/, 'menu entrance motion respects the saved accessibility preference');
assert.match(game, /classList\.toggle\('gameplay-active', id === 'game'\)/, 'screen transitions expose a gameplay-only layout state');
assert.match(css, /\.gameplay-active \.pwa-connection-toast\s*\{\s*display:\s*none/, 'offline status never covers live gameplay HUD values');
const revision = /const CACHE_VERSION = (\d+);/.exec(worker)?.[1];
assert.ok(Number(revision) >= 16, 'UI shell revision is 16 or newer');
assert.match(pwa, new RegExp(`register\\('sw\\.js\\?v=${revision}'`), 'PWA registers the same UI shell revision');
for (const match of html.matchAll(/[?&]v=(\d+)/g)) assert.equal(match[1], revision, 'every HTML shell asset uses the current revision');
for (const match of worker.matchAll(/[?&]v=(\d+)/g)) assert.equal(match[1], revision, 'every cached shell asset uses the current revision');

console.log('✓ menu responsive polish and coherent PWA shell revision are locked');
