import { LeaderboardRoom } from './leaderboard-room.js';
import { GhostChallengeRoom } from './ghost-challenge-room.js';
import { handleGhostRequest, isGhostPath } from './ghost-api.js';
import { MatchRoom } from './match-room.js';
import { handleMatchRequest, isMatchPath } from './match-api.js';
import { allowRequest } from './rate-limit.js';
import { safeEqual, signRun, verifyRun } from './security.js';
import { MODES, normalizeBoardQuery, parseBoardQuery, sanitizeEntry, validateProgress } from './validation.js';

export { LeaderboardRoom, GhostChallengeRoom, MatchRoom };

const MAX_BODY_BYTES = 48 * 1024;
const RUN_LIFETIME_MS = 6 * 60 * 60 * 1000;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configured = String(env.ALLOW_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
  const allowed = configured.length === 0 || configured.includes('*') || configured.includes(origin);
  const headers = {
    'Access-Control-Allow-Origin': allowed && origin ? origin : (configured[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
  if (env.ALLOW_PRIVATE_NETWORK === 'true') headers['Access-Control-Allow-Private-Network'] = 'true';
  return headers;
}

function json(request, env, body, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request, env) });
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

async function readJson(request) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY_BYTES) throw new Error('body_too_large');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('body_too_large');
  try { return JSON.parse(text || '{}'); } catch { throw new Error('invalid_json'); }
}

function clientKey(request, action) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  return `${action}:${ip}`;
}

function boardStub(env) {
  return env.LEADERBOARD_ROOM.getByName('global');
}

function boardUrl(request, query, path = '/entries') {
  const url = new URL(path, request.url);
  const normalized = normalizeBoardQuery(query);
  url.searchParams.set('scope', normalized.scope);
  url.searchParams.set('mode', normalized.mode);
  url.searchParams.set('difficulty', normalized.difficulty);
  url.searchParams.set('rulesetVersion', String(normalized.rulesetVersion));
  if (normalized.dailyDate) url.searchParams.set('dailyDate', normalized.dailyDate);
  return url;
}

async function issueRun(request, env, body) {
  if (!env.RUN_SIGNING_SECRET) return json(request, env, { error: 'run_signing_not_configured' }, 503);
  if (!MODES.has(body.mode) || !['normal', 'hardcore'].includes(body.difficulty) ||
      !Number.isInteger(Number(body.rulesetVersion)) || Number(body.rulesetVersion) < 1) {
    return json(request, env, { error: 'invalid_run_context' }, 400);
  }
  const query = normalizeBoardQuery({
    scope: body.runType === 'daily' ? 'daily' : 'standard',
    mode: body.mode,
    difficulty: body.difficulty,
    rulesetVersion: body.rulesetVersion,
    dailyDate: body.dailyDate,
  });
  if (body.runType === 'daily' && !query.dailyDate) return json(request, env, { error: 'invalid_daily_identity' }, 400);
  const now = Date.now();
  const runId = `run_${crypto.randomUUID().replace(/-/g, '')}`;
  const payload = {
    id: runId,
    runType: query.scope === 'daily' ? 'daily' : query.mode,
    mode: query.mode,
    difficulty: query.difficulty,
    rulesetVersion: query.rulesetVersion,
    dailyDate: query.dailyDate,
    seed: String(body.seed || '').replace(/[^\w|.:-]/g, '').slice(0, 128),
    iat: now,
    exp: now + RUN_LIFETIME_MS,
  };
  if (!payload.seed) return json(request, env, { error: 'invalid_seed' }, 400);
  if (payload.runType === 'daily') {
    const today = new Date().toISOString().slice(0, 10);
    if (payload.dailyDate !== today || payload.seed !== `daily|${payload.rulesetVersion}|${today}`) {
      return json(request, env, { error: 'stale_daily_identity' }, 400);
    }
  }
  return json(request, env, { runId, finishToken: await signRun(payload, env.RUN_SIGNING_SECRET), expiresAt: payload.exp });
}

async function finishRun(request, env, runId, body) {
  if (!env.RUN_SIGNING_SECRET) return json(request, env, { error: 'run_signing_not_configured' }, 503);
  const auth = request.headers.get('Authorization') || '';
  const run = await verifyRun(auth.startsWith('Bearer ') ? auth.slice(7) : '', env.RUN_SIGNING_SECRET);
  if (!run || run.id !== runId) return json(request, env, { error: 'invalid_run_token' }, 401);
  const entry = sanitizeEntry(body.entry, { ...run, runId, verification: 'accepted' });
  if (!entry || !validateProgress(body.progress, entry)) return json(request, env, { error: 'invalid_result_shape' }, 400);
  const target = boardUrl(request, entry, '/submit');
  const forwarded = new Request(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry, forced: run, fingerprint: clientKey(request, 'score'), submissionKey: run.id }),
  });
  return withCors(await boardStub(env).fetch(forwarded), request, env);
}

async function compatibilityPost(request, env, body) {
  if (body.action === 'verifyAdmin') {
    return json(request, env, { ok: !!env.ADMIN_CODE && safeEqual(body.code, env.ADMIN_CODE) });
  }
  if (body.action === 'verifyCheat') {
    const ok = env.CHEATS_ENABLED !== 'false' && !!env.CHEAT_CODE && safeEqual(body.code, env.CHEAT_CODE);
    return json(request, env, { ok });
  }
  const entry = sanitizeEntry(body.entry || body, { verification: 'accepted' });
  if (!entry) return json(request, env, { error: 'invalid_entry' }, 400);
  const target = boardUrl(request, entry, '/submit');
  return withCors(await boardStub(env).fetch(new Request(target, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry, fingerprint: clientKey(request, 'compat-score') }),
  })), request, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    try {
      if (request.method === 'GET' && url.pathname === '/v1/health') {
        return json(request, env, {
          ok: true,
          protocolVersion: 1,
          features: {
            leaderboard: env.LEADERBOARD_ENABLED !== 'false',
            daily: env.DAILY_ENABLED !== 'false',
            ghosts: env.GHOSTS_ENABLED !== 'false' && !!env.GHOST_CHALLENGE_ROOM,
            multiplayer: env.MULTIPLAYER_ENABLED !== 'false' && !!env.MATCH_ROOM,
            cheats: env.CHEATS_ENABLED !== 'false',
          },
        });
      }

      if (request.method === 'GET' && url.pathname === '/v1/daily') {
        if (env.DAILY_ENABLED === 'false') return json(request, env, { error: 'daily_disabled' }, 503);
        const day = new Date().toISOString().slice(0, 10);
        const rulesetVersion = 2;
        return json(request, env, { day, rulesetVersion, seed: `daily|${rulesetVersion}|${day}`, serverTime: Date.now() });
      }

      if (isGhostPath(url.pathname)) return handleGhostRequest(request, env, corsHeaders(request, env));
      if (isMatchPath(url.pathname)) return handleMatchRequest(request, env, corsHeaders(request, env));

      if (request.method === 'GET' && (url.pathname === '/v1/leaderboards' || url.pathname === '/')) {
        if (env.LEADERBOARD_ENABLED === 'false') return json(request, env, { error: 'leaderboard_disabled' }, 503);
        const query = parseBoardQuery(Object.fromEntries(url.searchParams));
        if (!query) return json(request, env, { error: 'invalid_partition' }, 400);
        return withCors(await boardStub(env).fetch(new Request(boardUrl(request, query))), request, env);
      }

      if (request.method === 'POST' && url.pathname === '/v1/runs') {
        if (!allowRequest(clientKey(request, 'run'), 30, 60_000)) return json(request, env, { error: 'rate_limited' }, 429);
        return issueRun(request, env, await readJson(request));
      }

      const finishMatch = url.pathname.match(/^\/v1\/runs\/([\w-]{1,64})\/finish$/);
      if (request.method === 'POST' && finishMatch) {
        if (!allowRequest(clientKey(request, 'finish'), 20, 60_000)) return json(request, env, { error: 'rate_limited' }, 429);
        return finishRun(request, env, finishMatch[1], await readJson(request));
      }

      if (request.method === 'POST' && (url.pathname === '/v1/cheats/verify' || url.pathname === '/v1/admin/verify')) {
        if (!allowRequest(clientKey(request, 'secret'), 10, 5 * 60_000)) return json(request, env, { ok: false, error: 'rate_limited' }, 429);
        const body = await readJson(request);
        const isCheat = url.pathname.includes('/cheats/');
        const secret = isCheat ? env.CHEAT_CODE : env.ADMIN_CODE;
        const enabled = !isCheat || env.CHEATS_ENABLED !== 'false';
        const ok = enabled && !!secret && safeEqual(body.code, secret);
        return json(request, env, { ok });
      }

      if (request.method === 'POST' && url.pathname === '/v1/admin/import-leaderboard') {
        const auth = request.headers.get('Authorization') || '';
        if (!env.ADMIN_CODE || !safeEqual(auth, `Bearer ${env.ADMIN_CODE}`)) return json(request, env, { error: 'unauthorized' }, 401);
        const body = await readJson(request);
        const query = normalizeBoardQuery(body.partition || {});
        return withCors(await boardStub(env).fetch(new Request(boardUrl(request, query, '/import'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: body.entries }),
        })), request, env);
      }

      if (request.method === 'GET' && url.pathname === '/v1/admin/export-leaderboards') {
        const auth = request.headers.get('Authorization') || '';
        if (!env.ADMIN_CODE || !safeEqual(auth, `Bearer ${env.ADMIN_CODE}`)) return json(request, env, { error: 'unauthorized' }, 401);
        return withCors(await boardStub(env).fetch(new Request(new URL('/export', request.url))), request, env);
      }

      if (request.method === 'DELETE' && url.pathname === '/v1/admin/leaderboards') {
        const auth = request.headers.get('Authorization') || '';
        if (!env.ADMIN_CODE || !safeEqual(auth, `Bearer ${env.ADMIN_CODE}`)) return json(request, env, { error: 'unauthorized' }, 401);
        return withCors(await boardStub(env).fetch(new Request(new URL('/clear', request.url), { method: 'POST' })), request, env);
      }

      const deleteEntry = url.pathname.match(/^\/v1\/admin\/entries\/([\w.:-]{1,64})$/);
      if (request.method === 'DELETE' && deleteEntry) {
        const auth = request.headers.get('Authorization') || '';
        if (!env.ADMIN_CODE || !safeEqual(auth, `Bearer ${env.ADMIN_CODE}`)) return json(request, env, { error: 'unauthorized' }, 401);
        const query = parseBoardQuery(Object.fromEntries(url.searchParams));
        if (!query) return json(request, env, { error: 'invalid_partition' }, 400);
        return withCors(await boardStub(env).fetch(new Request(boardUrl(request, query, '/delete'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteEntry[1] }),
        })), request, env);
      }

      if (request.method === 'POST' && url.pathname === '/') {
        return compatibilityPost(request, env, await readJson(request));
      }

      return json(request, env, { error: 'not_found' }, 404);
    } catch (error) {
      const message = error?.message === 'body_too_large' ? 'body_too_large' : error?.message === 'invalid_json' ? 'invalid_json' : 'request_failed';
      return json(request, env, { error: message }, message === 'body_too_large' ? 413 : message === 'invalid_json' ? 400 : 500);
    }
  },
};
