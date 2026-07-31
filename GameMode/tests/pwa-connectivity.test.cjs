const assert = require('node:assert/strict');

delete require.cache[require.resolve('../js/pwa.js')];
const PWA = require('../js/pwa.js');

assert.equal(PWA.connectivityApiBase({ location: { hostname: '127.0.0.1', origin: 'http://127.0.0.1:8000' }, CHRONOS_LB_CONFIG: { apiBase: 'https://example.test' } }), 'http://127.0.0.1:8000');
assert.equal(PWA.connectivityApiBase({ location: { hostname: 'raymondariwoola.github.io', origin: 'https://raymondariwoola.github.io' }, CHRONOS_LB_CONFIG: { apiBase: 'https://worker.example/' } }), 'https://worker.example');

(async () => {
  let calls = 0;
  const offlineNav = { onLine: false };
  const offline = new PWA.ConnectivityMonitor({
    navigatorLike: offlineNav, apiBase: 'https://worker.example',
    fetchImpl: async () => { calls++; throw new Error('must not fetch'); },
  });
  assert.equal((await offline.check()).kind, 'offline');
  assert.equal(calls, 0, 'known-offline state skips the health request');

  const online = new PWA.ConnectivityMonitor({
    navigatorLike: { onLine: true }, apiBase: 'https://worker.example',
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, 'https://worker.example/v1/health');
      assert.equal(options.cache, 'no-store');
      return { ok: true, json: async () => ({ ok: true, features: { leaderboard: true } }) };
    },
  });
  const states = [];
  online.subscribe((next) => states.push(next.kind));
  const ready = await online.check();
  assert.equal(ready.kind, 'online');
  assert.equal(ready.features.leaderboard, true);
  assert.deepEqual(states, ['online']);

  const unavailable = new PWA.ConnectivityMonitor({
    navigatorLike: { onLine: true }, apiBase: 'https://worker.example',
    fetchImpl: async () => { throw new Error('network'); },
  });
  assert.equal((await unavailable.check()).kind, 'cloud_unavailable');

  const unhealthy = new PWA.ConnectivityMonitor({
    navigatorLike: { onLine: true }, apiBase: 'https://worker.example',
    fetchImpl: async () => ({ ok: false, json: async () => ({ error: 'maintenance' }) }),
  });
  assert.equal((await unhealthy.check()).kind, 'cloud_unavailable');

  console.log('✓ PWA connectivity tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
