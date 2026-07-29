import {
  MATCH_SOCKET_PROTOCOL, cleanMatchName, formatMatchCode, normalizeMatchCode,
  ticketFromProtocols, validMatchCode,
} from '../../shared/match-protocol.mjs';
import { allowRequest } from './rate-limit.js';
import { sha256hex } from './security.js';
import { MATCH_TIMES } from './match-room.js';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_BODY_BYTES = 2048;

function json(body, status, cors) { return Response.json(body, { status, headers: cors }); }
function randomHex() {
  const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}
function randomCode() {
  let result = '';
  while (result.length < 8) {
    const bytes = new Uint8Array(8); crypto.getRandomValues(bytes);
    for (const value of bytes) {
      if (value >= 248) continue;
      result += ALPHABET[value % ALPHABET.length];
      if (result.length === 8) break;
    }
  }
  return formatMatchCode(result);
}
function client(request, action) { return `${action}:${request.headers.get('CF-Connecting-IP') || 'local'}`; }
function room(env, code) { return env.MATCH_ROOM.getByName(normalizeMatchCode(code)); }
function bearer(request) {
  const found = /^Bearer ([a-f0-9]{48})$/.exec(request.headers.get('Authorization') || '');
  return found ? found[1] : null;
}
function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = String(env.ALLOW_ORIGIN || '*').split(',').map((item) => item.trim()).filter(Boolean);
  return list.includes('*') || (!!origin && list.includes(origin));
}
async function body(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return { error: 'body_too_large', status: 413 };
  try { return { value: JSON.parse(text || '{}') }; } catch { return { error: 'invalid_json', status: 400 }; }
}
async function internal(stub, path, value = null, headers = {}) {
  return stub.fetch(new Request(`https://match.internal${path}`, {
    method: value == null ? 'GET' : 'POST', headers: { ...headers, ...(value == null ? {} : { 'Content-Type': 'application/json' }) },
    body: value == null ? undefined : JSON.stringify(value),
  }));
}
async function relay(response, cors, additions) {
  const data = await response.json().catch(() => ({ ok: false, error: 'room_error' }));
  return json(response.ok && additions ? { ...data, ...additions } : data, response.status, cors);
}

export function isMatchPath(pathname) { return pathname === '/v1/matches' || pathname.startsWith('/v1/matches/'); }

export async function handleMatchRequest(request, env, cors) {
  if (env.MULTIPLAYER_ENABLED === 'false') return json({ ok: false, error: 'multiplayer_disabled' }, 503, cors);
  if (!env.MATCH_ROOM) return json({ ok: false, error: 'multiplayer_unconfigured' }, 503, cors);
  const url = new URL(request.url);

  if (url.pathname === '/v1/matches') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!allowRequest(client(request, 'match-create'), 10, 60_000)) return json({ ok: false, error: 'rate_limited' }, 429, cors);
    const parsed = await body(request); if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status, cors);
    const name = cleanMatchName(parsed.value.name);
    const difficulty = parsed.value.difficulty === 'hardcore' ? 'hardcore' : parsed.value.difficulty === 'normal' ? 'normal' : null;
    if (!name || !difficulty) return json({ ok: false, error: !name ? 'bad_name' : 'bad_difficulty' }, 400, cors);
    const hostToken = randomHex(); const hostTokenHash = await sha256hex(hostToken);
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = randomCode();
      const response = await internal(room(env, code), '/init', { code, name, difficulty, hostTokenHash });
      if (response.status === 409) continue;
      return relay(response, cors, response.ok ? { code, hostToken } : null);
    }
    return json({ ok: false, error: 'code_generation_failed' }, 503, cors);
  }

  const match = /^\/v1\/matches\/([^/]+)(?:\/(join|ticket|socket))?$/.exec(url.pathname);
  if (!match) return json({ ok: false, error: 'not_found' }, 404, cors);
  let decoded; try { decoded = decodeURIComponent(match[1]); } catch { return json({ ok: false, error: 'bad_code' }, 400, cors); }
  const code = formatMatchCode(decoded);
  if (!validMatchCode(code)) return json({ ok: false, error: 'bad_code' }, 400, cors);
  const action = match[2] || 'state'; const stub = room(env, code);

  if (action === 'state') {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!allowRequest(client(request, 'match-read'), 120, 60_000)) return json({ ok: false, error: 'rate_limited' }, 429, cors);
    return relay(await internal(stub, '/state'), cors);
  }
  if (action === 'join') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!allowRequest(client(request, 'match-join'), 30, 60_000)) return json({ ok: false, error: 'rate_limited' }, 429, cors);
    const parsed = await body(request); if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status, cors);
    const name = cleanMatchName(parsed.value.name); if (!name) return json({ ok: false, error: 'bad_name' }, 400, cors);
    const playerToken = randomHex();
    const response = await internal(stub, '/join', { name, tokenHash: await sha256hex(playerToken) });
    return relay(response, cors, response.ok ? { playerToken } : null);
  }
  if (action === 'ticket') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!allowRequest(client(request, 'match-ticket'), 60, 60_000)) return json({ ok: false, error: 'rate_limited' }, 429, cors);
    const capability = bearer(request); if (!capability) return json({ ok: false, error: 'unauthorized' }, 401, cors);
    const ticket = randomHex();
    const response = await internal(stub, '/ticket', {
      tokenHash: await sha256hex(capability), ticketHash: await sha256hex(ticket), expiresAt: Date.now() + MATCH_TIMES.ticket,
    });
    return relay(response, cors, response.ok ? { ticket } : null);
  }
  if (action === 'socket') {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!allowedOrigin(request, env)) return json({ ok: false, error: 'origin_forbidden' }, 403, cors);
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return json({ ok: false, error: 'upgrade_required' }, 426, cors);
    if (!ticketFromProtocols(request.headers.get('Sec-WebSocket-Protocol'))) return json({ ok: false, error: 'invalid_ticket' }, 401, cors);
    const response = await stub.fetch(new Request('https://match.internal/socket', { method: 'GET', headers: request.headers }));
    if (response.status === 101 && response.headers.get('Sec-WebSocket-Protocol') !== MATCH_SOCKET_PROTOCOL) return json({ ok: false, error: 'protocol_error' }, 502, cors);
    return response;
  }
  return json({ ok: false, error: 'not_found' }, 404, cors);
}
