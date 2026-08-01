import assert from 'node:assert/strict';
import {
  formatMatchCode, MATCH_HANDICAPS, MATCH_LIMITS, MATCH_REACTIONS, MATCH_SABOTAGES, matchTicketProtocol,
  normalizeMatchCode, normalizeMatchHandicap, ticketFromProtocols,
  validateMatchEnvelope, validMatchCode,
} from '../shared/match-protocol.mjs';

assert.equal(normalizeMatchCode('abcd-efgh'), 'ABCDEFGH');
assert.equal(formatMatchCode('abcdefgh'), 'ABCD-EFGH');
assert.equal(validMatchCode('ABCD-EFGH'), true);
assert.equal(validMatchCode('BAD'), false);
const ticket = 'a'.repeat(48);
assert.equal(ticketFromProtocols(`chronos-clash.v1, ${matchTicketProtocol(ticket)}`), ticket);
assert.equal(validateMatchEnvelope({ v: 1, type: 'progress', seq: 2, payload: {} }).seq, 2);
assert.equal(validateMatchEnvelope({ v: 1, type: 'reaction', seq: 3, payload: { id: 'nice' } }).type, 'reaction');
assert.deepEqual(Object.keys(MATCH_REACTIONS), ['nice', 'close', 'wow', 'again', 'gg']);
assert.deepEqual(Object.keys(MATCH_SABOTAGES), ['reverse', 'narrow', 'haste']);
assert.deepEqual(Object.keys(MATCH_HANDICAPS), ['none', 'headstart', 'extra_life', 'wider']);
assert.equal(normalizeMatchHandicap('wider'), 'wider'); assert.equal(normalizeMatchHandicap('unknown'), 'none');
assert.equal(MATCH_LIMITS.reactionCooldownMs, 1200);
assert.equal(MATCH_LIMITS.maxShards, 2);
assert.equal(validateMatchEnvelope({ v: 1, type: 'sabotage', seq: 4, payload: { effect: 'reverse' } }).type, 'sabotage');
assert.equal(validateMatchEnvelope({ v: 1, type: 'hack', seq: 2, payload: {} }), null);
console.log('✓ match protocol tests passed');
