import { cleanName, normalizeRoomCode } from '../../shared/protocol.mjs';
import { allowRequest } from './rate-limit.js';
import { sha256hex } from './security.js';
import { sanitizeGhostDraft } from './ghost-validation.js';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_BODY_BYTES = 64 * 1024;

function json(body, status, cors) { return Response.json(body, { status, headers: cors }); }
function token() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}
function code() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const raw = [...bytes].map((value) => ALPHABET[value % ALPHABET.length]).join('');
  return normalizeRoomCode(raw);
}
function bearer(request) {
  const match = /^Bearer ([a-f0-9]{48})$/.exec(request.headers.get('Authorization') || '');
  return match ? match[1] : null;
}
function client(request, action) { return `${action}:${request.headers.get('CF-Connecting-IP') || 'local'}`; }
function room(env, roomCode) { return env.GHOST_CHALLENGE_ROOM.getByName(roomCode); }

async function body(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return { error: 'body_too_large', status: 413 };
  try { return { value: JSON.parse(text || '{}') }; } catch { return { error: 'invalid_json', status: 400 }; }
}

async function internal(stub, path, value) {
  return stub.fetch(new Request(`https://ghost.internal${path}`, {
    method: value == null ? 'GET' : 'POST',
    headers: value == null ? undefined : { 'Content-Type': 'application/json' },
    body: value == null ? undefined : JSON.stringify(value),
  }));
}

async function relay(response, cors, additions) {
  const data = await response.json().catch(() => ({ ok: false, error: 'ghost_error' }));
  return json(response.ok && additions ? { ...data, ...additions } : data, response.status, cors);
}

export function isGhostPath(pathname) { return pathname === '/v1/ghosts' || pathname.startsWith('/v1/ghosts/'); }

export async function handleGhostRequest(request, env, cors) {
  if (env.GHOSTS_ENABLED === 'false') return json({ ok: false, error: 'ghosts_disabled' }, 503, cors);
  if (!env.GHOST_CHALLENGE_ROOM) return json({ ok: false, error: 'ghosts_unconfigured' }, 503, cors);
  const url = new URL(request.url);

  if (url.pathname === '/v1/ghosts') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!allowRequest(client(request, 'ghost-create'), 10, 60_000)) return json({ ok: false, error: 'rate_limited' }, 429, cors);
    const parsed = await body(request);
    if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status, cors);
    const draft = sanitizeGhostDraft(parsed.value);
    if (!draft) return json({ ok: false, error: 'invalid_draft' }, 400, cors);
    const hostToken = token();
    for (let attempt = 0; attempt < 6; attempt++) {
      const roomCode = code();
      const response = await internal(room(env, roomCode), '/init', {
        ...draft, code: roomCode, hostTokenHash: await sha256hex(hostToken),
      });
      if (response.status === 409) continue;
      return relay(response, cors, response.ok ? { code: roomCode, hostToken } : null);
    }
    return json({ ok: false, error: 'code_generation_failed' }, 503, cors);
  }

  const match = /^\/v1\/ghosts\/([^/]+)(?:\/(join|finish|cancel))?$/.exec(url.pathname);
  if (!match) return json({ ok: false, error: 'not_found' }, 404, cors);
  const roomCode = normalizeRoomCode(decodeURIComponent(match[1]));
  if (!roomCode) return json({ ok: false, error: 'bad_code' }, 400, cors);
  const action = match[2] || 'state';
  const stub = room(env, roomCode);

  if (action === 'state') {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!allowRequest(client(request, 'ghost-read'), 120, 60_000)) return json({ ok: false, error: 'rate_limited' }, 429, cors);
    return relay(await internal(stub, '/state'), cors);
  }

  if (action === 'join') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!allowRequest(client(request, 'ghost-join'), 30, 60_000)) return json({ ok: false, error: 'rate_limited' }, 429, cors);
    const parsed = await body(request);
    if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status, cors);
    const guestName = cleanName(parsed.value.name);
    const guestToken = token();
    const response = await internal(stub, '/join', { guestName, guestTokenHash: await sha256hex(guestToken) });
    return relay(response, cors, response.ok ? { guestToken } : null);
  }

  const capability = bearer(request);
  if (!capability) return json({ ok: false, error: 'unauthorized' }, 401, cors);
  if (action === 'finish') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    const parsed = await body(request);
    if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status, cors);
    return relay(await internal(stub, '/finish', { ...parsed.value, tokenHash: await sha256hex(capability) }), cors);
  }
  if (action === 'cancel') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    return relay(await internal(stub, '/cancel', { tokenHash: await sha256hex(capability) }), cors);
  }
  return json({ ok: false, error: 'not_found' }, 404, cors);
}
