import { sanitizeGhostDraft, sanitizeGhostResult, sanitizeReplay, resultForSeats } from './ghost-validation.js';

export const GHOST_DRAFT_MS = 2 * 60 * 60 * 1000;
export const GHOST_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const KEY = 'challenge';

function json(body, status = 200) { return Response.json(body, { status }); }
function now(env) { const value = Number(env?.__TEST_NOW); return Number.isFinite(value) ? value : Date.now(); }

function publicReplay(replay, hideScores) {
  if (!replay) return null;
  return {
    ...replay,
    score: hideScores ? 0 : replay.score,
    strikes: replay.strikes.map((strike) => hideScores ? { ...strike, s: 0 } : { ...strike }),
  };
}

export function publicGhost(challenge, you = null) {
  const hide = challenge.hideHostScore && challenge.state !== 'finished' && you !== 'host';
  return {
    v: 1,
    code: challenge.code,
    state: challenge.state,
    mode: challenge.mode,
    difficulty: challenge.difficulty,
    identity: challenge.identity,
    seed: challenge.seed,
    rulesetVersion: challenge.rulesetVersion,
    hideHostScore: challenge.hideHostScore,
    createdAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
    you,
    host: {
      name: challenge.host.name,
      finished: !!challenge.host.result,
      result: hide ? null : challenge.host.result,
    },
    guest: challenge.guest ? { name: challenge.guest.name, finished: !!challenge.guest.result, result: challenge.guest.result } : null,
    replay: publicReplay(challenge.replay, hide),
    result: challenge.result,
  };
}

export class GhostChallengeRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url);
    const current = now(this.env);

    if (request.method === 'POST' && url.pathname === '/init') {
      const existing = await this.ctx.storage.get(KEY);
      if (existing && current < existing.expiresAt) return json({ ok: false, error: 'code_conflict' }, 409);
      if (existing) await this.deleteAll();
      const body = await request.json();
      const draft = sanitizeGhostDraft(body);
      if (!draft) return json({ ok: false, error: 'invalid_draft' }, 400);
      const challenge = {
        v: 1, code: body.code, state: 'host_pending', ...draft,
        createdAt: current, updatedAt: current, expiresAt: current + GHOST_DRAFT_MS,
        host: { name: draft.name, tokenHash: body.hostTokenHash, result: null },
        guest: null, replay: null, result: null,
      };
      await this.save(challenge);
      return json({ ok: true, challenge: publicGhost(challenge, 'host') }, 201);
    }

    const challenge = await this.ctx.storage.get(KEY);
    if (!challenge || current >= challenge.expiresAt) {
      if (challenge) await this.deleteAll();
      return json({ ok: false, error: 'challenge_not_found' }, 404);
    }

    if (request.method === 'GET' && url.pathname === '/state') return json({ ok: true, challenge: publicGhost(challenge) });

    if (request.method === 'POST' && url.pathname === '/join') {
      if (challenge.state !== 'open' || challenge.guest) return json({ ok: false, error: challenge.state === 'host_pending' ? 'challenge_not_ready' : 'challenge_claimed' }, 409);
      const body = await request.json();
      challenge.guest = { name: body.guestName, tokenHash: body.guestTokenHash, result: null };
      challenge.state = 'guest_playing';
      challenge.updatedAt = current;
      await this.save(challenge);
      return json({ ok: true, challenge: publicGhost(challenge, 'guest') });
    }

    if (request.method === 'POST' && url.pathname === '/finish') {
      const body = await request.json();
      const seatName = challenge.host.tokenHash === body.tokenHash ? 'host'
        : challenge.guest?.tokenHash === body.tokenHash ? 'guest' : null;
      if (!seatName) return json({ ok: false, error: 'unauthorized' }, 401);
      const seat = challenge[seatName];
      if (seat.result) return json({ ok: true, challenge: publicGhost(challenge, seatName), idempotent: true });
      const result = sanitizeGhostResult(body.result);
      if (!result) return json({ ok: false, error: 'invalid_result' }, 400);
      if (seatName === 'host') {
        if (challenge.state !== 'host_pending') return json({ ok: false, error: 'invalid_state' }, 409);
        const replay = sanitizeReplay(body.replay, challenge);
        if (!replay || replay.score !== result.score || replay.rounds > result.round) return json({ ok: false, error: 'invalid_replay' }, 400);
        challenge.replay = replay;
        challenge.host.result = result;
        challenge.state = 'open';
        challenge.expiresAt = current + GHOST_LIFETIME_MS;
      } else {
        if (challenge.state !== 'guest_playing') return json({ ok: false, error: 'invalid_state' }, 409);
        challenge.guest.result = result;
        challenge.state = 'finished';
        challenge.result = { ...resultForSeats(challenge.host.result, result), finishedAt: current };
      }
      challenge.updatedAt = current;
      await this.save(challenge);
      return json({ ok: true, challenge: publicGhost(challenge, seatName) });
    }

    if (request.method === 'POST' && url.pathname === '/cancel') {
      const body = await request.json();
      if (challenge.host.tokenHash !== body.tokenHash) return json({ ok: false, error: 'unauthorized' }, 401);
      await this.deleteAll();
      return json({ ok: true, cancelled: true });
    }

    return json({ ok: false, error: 'not_found' }, 404);
  }

  async alarm() { await this.deleteAll(); }
  async save(challenge) { await this.ctx.storage.put(KEY, challenge); await this.ctx.storage.setAlarm(challenge.expiresAt); }
  async deleteAll() { await this.ctx.storage.deleteAlarm(); await this.ctx.storage.deleteAll(); }
}
