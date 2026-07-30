import test from 'node:test';
import assert from 'node:assert/strict';
import { handleShareRequest } from '../src/share-pages.js';
import { isPng, MAX_SHARE_CARD_BYTES, readPng } from '../src/share-card.js';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1]);

function binding(state) {
  return { getByName: () => ({ fetch: async (request) => new URL(request.url).pathname === '/share-card'
    ? new Response(png, { headers: { 'Content-Type': 'image/png' } })
    : Response.json(state) }) };
}

test('ghost share page emits rich metadata without leaking a hidden target', async () => {
  const env = {
    PUBLIC_GAME_URL: 'https://game.test/GameMode/',
    GHOST_CHALLENGE_ROOM: binding({ ok: true, challenge: {
      code: '2345-6789', mode: 'classic', difficulty: 'hardcore', hideHostScore: true,
      host: { name: '<Ray & Family>', result: null },
    } }),
  };
  const response = await handleShareRequest(new Request('https://worker.test/s/ghost/2345-6789'), env);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /property="og:image"/);
  assert.match(html, /Mystery score target/);
  assert.equal(html.includes('98765'), false);
  assert.equal(html.includes('<Ray & Family>'), false);
  assert.match(html, /&lt;Ray &amp; Family&gt;/);
  assert.match(html, /https:\/\/game\.test\/GameMode\/\?ghost=2345-6789/);

  const image = await handleShareRequest(new Request('https://worker.test/s/ghost/2345-6789/card.png'), env);
  assert.equal(image.headers.get('Content-Type'), 'image/png');
});

test('clash share page describes the live format and points to the room', async () => {
  const env = { PUBLIC_GAME_URL: 'https://game.test/', MATCH_ROOM: binding({ ok: true, room: {
    code: 'ABCD-EFGH', difficulty: 'normal', roundLimit: 10, seats: { host: { name: 'Host' } },
  } }) };
  const html = await (await handleShareRequest(new Request('https://worker.test/s/clash/ABCD-EFGH'), env)).text();
  assert.match(html, /Chrono Clash/); assert.match(html, /10 identical rounds/); assert.match(html, /\?duel=ABCD-EFGH/);
});

test('share card reader accepts bounded PNG only', async () => {
  assert.equal(isPng(png), true);
  let result = await readPng(new Request('https://test/', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: png }));
  assert.equal(result.status, 415);
  result = await readPng(new Request('https://test/', { method: 'PUT', headers: { 'Content-Type': 'image/png', 'Content-Length': String(MAX_SHARE_CARD_BYTES + 1) }, body: png }));
  assert.equal(result.status, 413);
});
