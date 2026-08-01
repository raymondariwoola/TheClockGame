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
assert.match(game, /if \(window\.anime && A11y\.motion\(\)\)/, 'menu entrance motion respects the saved accessibility preference');
assert.match(worker, /const CACHE_VERSION = 16;/, 'UI shell ships as revision 16');
assert.match(pwa, /register\('sw\.js\?v=16'/, 'PWA registers the same UI shell revision');
for (const match of html.matchAll(/[?&]v=(\d+)/g)) assert.equal(match[1], '16', 'every HTML shell asset uses revision 16');
for (const match of worker.matchAll(/[?&]v=(\d+)/g)) assert.equal(match[1], '16', 'every cached shell asset uses revision 16');

console.log('✓ menu responsive polish and coherent PWA shell revision are locked');
