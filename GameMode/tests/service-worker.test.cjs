const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]).filter((value) => !value.startsWith('../'));
for (const asset of localAssets) assert.ok(worker.includes(`'./${asset}'`), `offline shell missing ${asset}`);
assert.ok(worker.includes("url.pathname.startsWith('/v1/')"), 'API requests must remain network-only');
assert.ok(worker.includes("url.pathname.endsWith('/local-reset-config.js')"), 'owner reset config must be network-first');
assert.ok(html.includes('rel="manifest" href="manifest.webmanifest"'), 'page must advertise its web app manifest');
assert.ok(worker.includes("'./manifest.webmanifest'"), 'offline shell must include the manifest');
for (const size of [180, 192, 512]) {
  const icon = fs.readFileSync(path.join(root, 'assets', `icon-${size}.png`));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `icon-${size} must be PNG`);
  assert.equal(icon.readUInt32BE(16), size, `icon-${size} width`);
  assert.equal(icon.readUInt32BE(20), size, `icon-${size} height`);
  assert.ok(worker.includes(`'./assets/icon-${size}.png'`), `offline shell missing icon-${size}`);
}
assert.equal(worker.includes('Normal.mp3'), false, 'missing Normal track must use procedural fallback, not precache');
console.log('✓ service worker shell tests passed');
