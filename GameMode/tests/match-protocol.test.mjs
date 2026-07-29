import assert from 'node:assert/strict';
import {
  formatMatchCode, matchTicketProtocol, normalizeMatchCode, ticketFromProtocols,
  validateMatchEnvelope, validMatchCode,
} from '../shared/match-protocol.mjs';

assert.equal(normalizeMatchCode('abcd-efgh'), 'ABCDEFGH');
assert.equal(formatMatchCode('abcdefgh'), 'ABCD-EFGH');
assert.equal(validMatchCode('ABCD-EFGH'), true);
assert.equal(validMatchCode('BAD'), false);
const ticket = 'a'.repeat(48);
assert.equal(ticketFromProtocols(`chronos-clash.v1, ${matchTicketProtocol(ticket)}`), ticket);
assert.equal(validateMatchEnvelope({ v: 1, type: 'progress', seq: 2, payload: {} }).seq, 2);
assert.equal(validateMatchEnvelope({ v: 1, type: 'hack', seq: 2, payload: {} }), null);
console.log('✓ match protocol tests passed');
