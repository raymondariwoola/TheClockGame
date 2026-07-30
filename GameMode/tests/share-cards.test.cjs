const assert = require('node:assert/strict');
const cards = require('../js/share-cards.js');

const ghost = {
  code: '2345-6789', mode: 'classic', difficulty: 'hardcore', seed: 'seed', hideHostScore: true,
  host: { name: 'Ray & Family', result: { score: 98765 } }, guest: null, result: null,
};
const hidden = cards.ghostInviteModel(ghost);
assert.equal(hidden.hero, 'MYSTERY');
assert.equal(JSON.stringify(hidden).includes('98,765'), false, 'hidden score must not leak into the card model');
assert.equal(hidden.rows[0][1], 'RAY & FAMILY');

const visible = cards.ghostInviteModel({ ...ghost, hideHostScore: false });
assert.equal(visible.hero, '98,765');
assert.equal(visible.rows[1][1], 'CLASSIC · HARDCORE');
assert.equal(cards.shareUrl('https://worker.test/', 'ghost', ghost.code), 'https://worker.test/s/ghost/2345-6789');

const clash = cards.clashInviteModel({ code: 'ABCD-EFGH', difficulty: 'normal', roundLimit: 10, seats: { host: { name: 'Host' }, guest: null } });
assert.equal(clash.hero, 'ABCD-EFGH');
assert.equal(clash.rows[1][1], '10 ROUNDS · NORMAL');
assert.equal(cards.shareUrl('https://worker.test/api/', 'clash', 'ABCD-EFGH'), 'https://worker.test/api/s/clash/ABCD-EFGH');

const result = cards.ghostResultModel({ ...ghost, hideHostScore: false, guest: { name: 'Guest', result: { score: 100000 } }, result: { winner: 'guest' } });
assert.equal(result.title, 'GUEST WINS');
assert.equal(result.hero, '100,000');

assert.throws(() => cards.shareUrl('https://worker.test', 'bad', '1234'), /bad_share_kind/);
console.log('✓ share card model tests passed');
