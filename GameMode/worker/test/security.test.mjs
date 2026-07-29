import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { safeEqual, signRun, verifyRun } from '../src/security.js';

globalThis.crypto ||= webcrypto;

test('safe comparison and signed run tokens reject tampering and expiry', async () => {
  assert.equal(safeEqual('family', 'family'), true);
  assert.equal(safeEqual('family', 'friends'), false);
  const payload = { id: 'run-1', exp: Date.now() + 10_000 };
  const token = await signRun(payload, 'unit-test-secret');
  assert.equal((await verifyRun(token, 'unit-test-secret')).id, 'run-1');
  assert.equal(await verifyRun(token + 'x', 'unit-test-secret'), null);
  const expired = await signRun({ id: 'old', exp: Date.now() - 1 }, 'unit-test-secret');
  assert.equal(await verifyRun(expired, 'unit-test-secret'), null);
});
