const assert = require('node:assert/strict');
const { GhostChallengeClient, codeFromUrl, buildUrl } = require('../js/ghost-client.js');

class Store {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
}
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

assert.equal(buildUrl('https://example.test/GameMode/?old=1#result', '2345 6789'), 'https://example.test/GameMode/?ghost=2345-6789');
assert.equal(codeFromUrl('https://example.test/?ghost=2345-6789&token=secret'), '2345-6789');

(async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/v1/ghosts')) return response(201, { ok: true, code: '2345-6789', hostToken: 'a'.repeat(48) });
    if (url.endsWith('/finish')) return response(200, { ok: true, challenge: { code: '2345-6789', state: 'open' } });
    if (url.endsWith('/share-card')) return response(201, { ok: true });
    throw new Error('unexpected request');
  };
  const client = new GhostChallengeClient({ baseUrl: 'https://worker.test', fetchImpl, sessionStore: new Store() });
  const record = { identity: 'run-seed', mode: 'classic', hardcore: false, rulesetVersion: 1, strikes: [{ round: 1, angle: 20, kind: 'perfect', t: 100, s: 100 }], score: 100, rounds: 1 };
  const created = await client.createFromReplay({ name: 'Host', record, result: { score: 100, round: 1, perfect: 1, combo: 1, acc: 100 } });
  assert.equal(created.session.token, 'a'.repeat(48));
  assert.equal(requests[0].options.body.includes(created.session.token), false);
  assert.equal(requests[1].options.headers.Authorization, `Bearer ${created.session.token}`);
  assert.equal(buildUrl('https://example.test/GameMode/', created.session.code).includes('token'), false);
  await client.uploadShareCard(new Blob(['png'], { type: 'image/png' }), created.session.code);
  assert.equal(requests[2].options.method, 'PUT');
  assert.equal(requests[2].options.headers.Authorization, `Bearer ${created.session.token}`);
  console.log('✓ ghost client tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
