const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const pwa = fs.readFileSync(path.join(root, 'js', 'pwa.js'), 'utf8');
const devServer = fs.readFileSync(path.join(root, 'scripts', 'dev-server.mjs'), 'utf8');

assert.equal(manifest.id, './');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.theme_color, '#080416');
assert.equal(manifest.background_color, '#080416');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), `missing manifest icon ${icon.src}`);

assert.match(devServer, /'\.webmanifest': 'application\/manifest\+json; charset=utf-8'/);
assert.match(html, /<meta name="theme-color" content="#080416"/);
assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="assets\/icon-180\.png"/);

const cacheVersion = Number(/const CACHE_VERSION = (\d+);/.exec(worker)?.[1]);
const registeredVersion = Number(/register\('sw\.js\?v=(\d+)'/.exec(pwa)?.[1]);
assert.equal(cacheVersion, 24, 'release cache revision');
assert.equal(registeredVersion, cacheVersion, 'page and service worker revision must match');
for (const match of html.matchAll(/[?&]v=(\d+)/g)) assert.equal(Number(match[1]), cacheVersion, `HTML asset revision ${match[1]} must match cache`);
for (const match of worker.matchAll(/[?&]v=(\d+)/g)) assert.equal(Number(match[1]), cacheVersion, `shell asset revision ${match[1]} must match cache`);

console.log('✓ PWA manifest and revision tests passed');
