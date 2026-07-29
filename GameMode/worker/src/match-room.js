import {
  MATCH_LIMITS, MATCH_PROTOCOL_VERSION, MATCH_SOCKET_PROTOCOL, MATCH_STATES,
  ticketFromProtocols, validateMatchEnvelope,
} from '../../shared/match-protocol.mjs';
import { sha256hex } from './security.js';

const ROOM_KEY = 'room';
const TICKET_PREFIX = 'ticket:';
export const MATCH_TIMES = Object.freeze({
  waiting: 2 * 60 * 60 * 1000, countdown: 3000, active: 20 * 60 * 1000,
  disconnect: 30 * 1000, finished: 15 * 60 * 1000, ticket: 60 * 1000,
});
const MESSAGE_WINDOW = 10_000;
const MESSAGE_LIMIT = 80;

function now(env) { const value = Number(env?.__TEST_NOW); return Number.isFinite(value) ? value : Date.now(); }
function json(value, status = 200) { return Response.json(value, { status }); }
function progress() { return { score: 0, round: 0, perfect: 0, combo: 1, acc: 0, attempts: 0 }; }
function seat(id, name, tokenHash, at) {
  return { id, name, tokenHash, ready: false, connected: false, disconnectedAt: null, lastSeenAt: at,
    lastSeq: -1, progress: progress(), finished: false, forfeited: false, rematch: false };
}
function createRoom(value, at) {
  return {
    v: MATCH_PROTOCOL_VERSION, code: value.code, state: MATCH_STATES.WAITING, difficulty: value.difficulty,
    rulesetVersion: 1, matchNumber: 1, suddenDeath: 0, roundLimit: MATCH_LIMITS.rounds,
    seed: null, startAt: null, createdAt: at, updatedAt: at, expiresAt: at + MATCH_TIMES.waiting,
    seats: { host: seat('host', value.name, value.hostTokenHash, at), guest: null }, result: null,
  };
}
function publicSeat(value) {
  return value ? { id: value.id, name: value.name, ready: value.ready, connected: value.connected,
    progress: { ...value.progress }, finished: value.finished, forfeited: value.forfeited, rematch: value.rematch } : null;
}
export function publicMatch(room, you = null) {
  return {
    v: room.v, code: room.code, state: room.state, difficulty: room.difficulty,
    rulesetVersion: room.rulesetVersion, matchNumber: room.matchNumber, suddenDeath: room.suddenDeath,
    roundLimit: room.roundLimit, seed: room.seed, startAt: room.startAt, createdAt: room.createdAt,
    updatedAt: room.updatedAt, expiresAt: room.expiresAt, you,
    seats: { host: publicSeat(room.seats.host), guest: publicSeat(room.seats.guest) },
    result: room.result ? { ...room.result } : null,
  };
}
function sanitizeProgress(value, previous, finish = false) {
  if (!value || typeof value !== 'object') return null;
  const keys = ['score', 'round', 'perfect', 'combo', 'acc', 'attempts'];
  if (keys.some((key) => !Number.isSafeInteger(value[key]))) return null;
  if (value.score < 0 || value.score > 100_000_000 || value.round < 0 || value.round > 100 ||
      value.perfect < 0 || value.perfect > 1000 || value.combo < 0 || value.combo > 1000 ||
      value.acc < 0 || value.acc > 100 || value.attempts < 0 || value.attempts > 4000 ||
      value.perfect > value.attempts || value.round < previous.round || value.attempts < previous.attempts ||
      (!finish && value.round === previous.round && value.attempts === previous.attempts)) return null;
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}
export function compareMatch(host, guest) {
  for (const [field, reason] of [['score', 'score'], ['perfect', 'perfects'], ['combo', 'combo'], ['acc', 'accuracy']]) {
    if (host.progress[field] !== guest.progress[field]) return { winner: host.progress[field] > guest.progress[field] ? 'host' : 'guest', reason };
  }
  return { winner: null, reason: 'draw' };
}
function resetSeat(value, at) {
  if (!value) return; value.ready = true; value.progress = progress(); value.finished = false;
  value.forfeited = false; value.rematch = false; value.lastSeenAt = at;
}
function countdown(room, at, { rematch = false, suddenDeath = false } = {}) {
  resetSeat(room.seats.host, at); resetSeat(room.seats.guest, at);
  const random = new Uint32Array(2); crypto.getRandomValues(random);
  room.state = MATCH_STATES.COUNTDOWN;
  room.matchNumber += rematch ? 1 : 0;
  room.suddenDeath = suddenDeath ? room.suddenDeath + 1 : 0;
  room.roundLimit = suddenDeath ? MATCH_LIMITS.suddenDeathRounds : MATCH_LIMITS.rounds;
  room.seed = `clash|${room.rulesetVersion}|${room.code}|${room.matchNumber}|${room.suddenDeath}|${random[0].toString(36)}${random[1].toString(36)}`;
  room.startAt = at + MATCH_TIMES.countdown; room.updatedAt = at;
  room.expiresAt = room.startAt + MATCH_TIMES.active; room.result = null;
  return room;
}
function forfeit(room, loser, at, reason) {
  const seatValue = room.seats[loser]; if (seatValue) { seatValue.forfeited = true; seatValue.finished = true; }
  room.state = MATCH_STATES.FORFEIT; room.updatedAt = at; room.expiresAt = at + MATCH_TIMES.finished;
  room.result = { winner: loser === 'host' ? 'guest' : 'host', reason, loser, finishedAt: at };
  return room;
}
function deadline(room) {
  const values = [room.expiresAt];
  if (room.state === MATCH_STATES.COUNTDOWN && room.startAt) values.push(room.startAt);
  if ([MATCH_STATES.COUNTDOWN, MATCH_STATES.PLAYING].includes(room.state)) {
    for (const value of [room.seats.host, room.seats.guest]) if (value?.disconnectedAt != null) values.push(value.disconnectedAt + MATCH_TIMES.disconnect);
  }
  return Math.min(...values.filter(Number.isFinite));
}
function reconcile(room, at) {
  if (at >= room.expiresAt) return { room: null, expired: true, changed: false };
  let changed = false;
  if (room.state === MATCH_STATES.COUNTDOWN && at >= room.startAt) { room.state = MATCH_STATES.PLAYING; room.updatedAt = at; room.expiresAt = at + MATCH_TIMES.active; changed = true; }
  if ([MATCH_STATES.COUNTDOWN, MATCH_STATES.PLAYING].includes(room.state)) {
    const disconnected = ['host', 'guest'].filter((id) => room.seats[id]?.disconnectedAt != null && at >= room.seats[id].disconnectedAt + MATCH_TIMES.disconnect);
    if (disconnected.length) {
      if (disconnected.length === 1) forfeit(room, disconnected[0], at, 'disconnect');
      else { room.state = MATCH_STATES.FORFEIT; room.result = { winner: null, reason: 'both_disconnected', finishedAt: at }; room.expiresAt = at + MATCH_TIMES.finished; }
      changed = true;
    }
  }
  return { room, expired: false, changed };
}
function consume(ws, at) {
  const value = ws.deserializeAttachment() || {};
  if (!Number.isFinite(value.windowAt) || at - value.windowAt >= MESSAGE_WINDOW) { value.windowAt = at; value.messages = 0; }
  value.messages = Number(value.messages || 0) + 1; ws.serializeAttachment(value); return value.messages <= MESSAGE_LIMIT;
}

export class MatchRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url); const at = now(this.env);
    if (request.method === 'POST' && url.pathname === '/init') {
      const existing = await this.ctx.storage.get(ROOM_KEY);
      if (existing && at < existing.expiresAt) return json({ ok: false, error: 'code_conflict' }, 409);
      if (existing) await this.remove('expired');
      const room = createRoom(await request.json(), at); await this.save(room);
      return json({ ok: true, room: publicMatch(room, 'host') }, 201);
    }
    const room = await this.load(); if (!room) return json({ ok: false, error: 'room_not_found' }, 404);
    if (request.method === 'GET' && url.pathname === '/state') return json({ ok: true, room: publicMatch(room) });
    if (request.method === 'POST' && url.pathname === '/join') {
      if (room.state !== MATCH_STATES.WAITING) return json({ ok: false, error: 'room_started' }, 409);
      if (room.seats.guest) return json({ ok: false, error: 'room_full' }, 409);
      const value = await request.json(); room.seats.guest = seat('guest', value.name, value.tokenHash, at); room.updatedAt = at;
      await this.save(room); await this.broadcast('presence', { room: publicMatch(room) });
      return json({ ok: true, room: publicMatch(room, 'guest') });
    }
    if (request.method === 'POST' && url.pathname === '/ticket') {
      const value = await request.json(); const seatValue = this.seatForToken(room, value.tokenHash);
      if (!seatValue) return json({ ok: false, error: 'unauthorized' }, 401);
      if (!/^[a-f0-9]{64}$/.test(value.ticketHash || '') || value.expiresAt <= at) return json({ ok: false, error: 'bad_ticket' }, 400);
      await this.ctx.storage.put(TICKET_PREFIX + value.ticketHash, { seat: seatValue.id, expiresAt: Math.min(value.expiresAt, at + MATCH_TIMES.ticket) });
      return json({ ok: true, seat: seatValue.id }, 201);
    }
    if (request.method === 'GET' && url.pathname === '/socket') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return json({ ok: false, error: 'upgrade_required' }, 426);
      const ticket = ticketFromProtocols(request.headers.get('Sec-WebSocket-Protocol'));
      const key = TICKET_PREFIX + await sha256hex(ticket); const stored = await this.ctx.storage.get(key);
      if (!stored || stored.expiresAt <= at) { if (stored) await this.ctx.storage.delete(key); return json({ ok: false, error: 'invalid_ticket' }, 401); }
      await this.ctx.storage.delete(key);
      const seatValue = room.seats[stored.seat]; if (!seatValue) return json({ ok: false, error: 'invalid_ticket' }, 401);
      for (const socket of this.ctx.getWebSockets(`seat:${seatValue.id}`)) {
        try { const info = socket.deserializeAttachment() || {}; socket.serializeAttachment({ ...info, replaced: true }); socket.send(JSON.stringify(this.message('error', { code: 'socket_replaced' }))); socket.close(4001, 'replaced'); } catch {}
      }
      const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [`seat:${seatValue.id}`]); server.serializeAttachment({ seat: seatValue.id, windowAt: at, messages: 0 });
      seatValue.connected = true; seatValue.disconnectedAt = null; seatValue.lastSeenAt = at; room.updatedAt = at;
      await this.save(room); await this.broadcast('presence', { room: publicMatch(room) });
      server.send(JSON.stringify(this.message('snapshot', { room: publicMatch(room, seatValue.id) })));
      return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': MATCH_SOCKET_PROTOCOL } });
    }
    return json({ ok: false, error: 'not_found' }, 404);
  }

  async webSocketMessage(ws, raw) {
    try {
      if (this.env.MULTIPLAYER_ENABLED === 'false') { this.error(ws, 'multiplayer_disabled'); ws.close(4003, 'disabled'); return; }
      if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MATCH_LIMITS.maxMessageBytes) return this.error(ws, 'message_too_large');
      const at = now(this.env); if (!consume(ws, at)) return this.error(ws, 'rate_limited');
      let parsed; try { parsed = JSON.parse(raw); } catch { return this.error(ws, 'invalid_json'); }
      const message = validateMatchEnvelope(parsed); if (!message) return this.error(ws, 'invalid_message');
      const info = ws.deserializeAttachment() || {}; if (info.replaced) return this.error(ws, 'socket_replaced');
      let room = await this.load(); if (!room) return this.error(ws, 'room_not_found');
      const player = room.seats[info.seat]; if (!player) return this.error(ws, 'unauthorized');
      if (message.seq <= player.lastSeq) return this.error(ws, 'duplicate_sequence');
      player.lastSeq = message.seq; player.lastSeenAt = at;

      if (message.type === 'ready') {
        if (room.state !== MATCH_STATES.WAITING || !room.seats.guest) return this.error(ws, 'not_readyable');
        player.ready = true;
        if (room.seats.host.ready && room.seats.guest.ready) { room = countdown(room, at); await this.save(room); await this.broadcastCountdown(room, at); }
        else { await this.save(room); await this.broadcast('presence', { room: publicMatch(room) }); }
        return;
      }
      if (message.type === 'progress' || message.type === 'finish') {
        if (room.state === MATCH_STATES.COUNTDOWN && at >= room.startAt) room.state = MATCH_STATES.PLAYING;
        if (room.state !== MATCH_STATES.PLAYING) return this.error(ws, 'not_playing');
        const finished = message.type === 'finish'; const next = sanitizeProgress(message.payload, player.progress, finished);
        if (!next) return this.error(ws, 'invalid_progress');
        player.progress = next; room.updatedAt = at;
        if (!finished) { await this.save(room); await this.others(player.id, 'opponent_progress', { seat: player.id, progress: next }); return; }
        player.finished = true;
        if (!room.seats.host.finished || !room.seats.guest.finished) { await this.save(room); await this.others(player.id, 'opponent_finished', { seat: player.id, progress: next }); return; }
        const result = compareMatch(room.seats.host, room.seats.guest);
        if (!result.winner && room.suddenDeath < MATCH_LIMITS.maxSuddenDeath) {
          room = countdown(room, at, { suddenDeath: true }); await this.save(room); await this.broadcastCountdown(room, at); return;
        }
        room.state = MATCH_STATES.FINISHED; room.result = { ...result, finishedAt: at }; room.expiresAt = at + MATCH_TIMES.finished;
        await this.save(room); await this.broadcast('result', { room: publicMatch(room) }); return;
      }
      if (message.type === 'heartbeat') { await this.save(room); ws.send(JSON.stringify(this.message('presence', { serverTime: at }))); return; }
      if (message.type === 'rematch_vote') {
        if (![MATCH_STATES.FINISHED, MATCH_STATES.FORFEIT].includes(room.state)) return this.error(ws, 'rematch_unavailable');
        player.rematch = true;
        if (room.seats.host.rematch && room.seats.guest.rematch) { room = countdown(room, at, { rematch: true }); await this.save(room); await this.broadcastCountdown(room, at); }
        else { await this.save(room); await this.broadcast('rematch_state', { room: publicMatch(room) }); }
        return;
      }
      if (message.type === 'forfeit') {
        if (room.state === MATCH_STATES.WAITING) {
          if (player.id === 'host') { room.state = MATCH_STATES.CANCELLED; room.expiresAt = at + MATCH_TIMES.finished; }
          else room.seats.guest = null;
        } else if ([MATCH_STATES.COUNTDOWN, MATCH_STATES.PLAYING].includes(room.state)) forfeit(room, player.id, at, 'forfeit');
        await this.save(room); await this.broadcast(room.result ? 'result' : 'presence', { room: publicMatch(room) });
      }
    } catch { this.error(ws, 'server_error'); }
  }

  async webSocketClose(ws, code, reason) {
    const info = ws.deserializeAttachment() || {}; const room = await this.load(); if (!room?.seats[info.seat]) return;
    const open = this.ctx.getWebSockets(`seat:${info.seat}`).some((item) => item !== ws && item.readyState === 1 && !(item.deserializeAttachment() || {}).replaced);
    if (!open) { const player = room.seats[info.seat]; player.connected = false; if ([MATCH_STATES.COUNTDOWN, MATCH_STATES.PLAYING].includes(room.state)) player.disconnectedAt = now(this.env); await this.save(room); await this.broadcast('presence', { room: publicMatch(room) }); }
    try { ws.close(code, reason); } catch {}
  }
  async webSocketError(ws) { await this.webSocketClose(ws, 1011, 'socket error'); }
  async alarm() {
    const room = await this.ctx.storage.get(ROOM_KEY); if (!room) return;
    const outcome = reconcile(room, now(this.env));
    if (outcome.expired) { await this.broadcast('expired', { code: room.code }); await this.remove('expired'); }
    else if (outcome.changed) { await this.save(outcome.room); await this.broadcast(outcome.room.result ? 'result' : 'snapshot', { room: publicMatch(outcome.room) }); }
    else await this.schedule(room);
  }
  seatForToken(room, hash) { return room.seats.host.tokenHash === hash ? room.seats.host : room.seats.guest?.tokenHash === hash ? room.seats.guest : null; }
  async load() {
    const room = await this.ctx.storage.get(ROOM_KEY); if (!room) return null;
    const outcome = reconcile(room, now(this.env)); if (outcome.expired) { await this.remove('expired'); return null; }
    if (outcome.changed) await this.save(outcome.room); return outcome.room;
  }
  async save(room) { await this.ctx.storage.put(ROOM_KEY, room); await this.schedule(room); }
  async schedule(room) { const value = deadline(room); if (Number.isFinite(value)) await this.ctx.storage.setAlarm(value); }
  async remove(reason) { for (const socket of this.ctx.getWebSockets()) try { socket.close(4000, reason); } catch {} await this.ctx.storage.deleteAlarm(); await this.ctx.storage.deleteAll(); }
  message(type, payload) { return { v: MATCH_PROTOCOL_VERSION, type, payload }; }
  error(ws, code) { try { ws.send(JSON.stringify(this.message('error', { code }))); } catch {} }
  async broadcast(type, payload) { const value = JSON.stringify(this.message(type, payload)); for (const ws of this.ctx.getWebSockets()) if (!(ws.deserializeAttachment() || {}).replaced) try { ws.send(value); } catch {} }
  async others(seatId, type, payload) { const value = JSON.stringify(this.message(type, payload)); for (const ws of this.ctx.getWebSockets()) { const info = ws.deserializeAttachment() || {}; if (!info.replaced && info.seat !== seatId) try { ws.send(value); } catch {} } }
  async broadcastCountdown(room, at) { await this.broadcast('countdown', { room: publicMatch(room), seed: room.seed, startAt: room.startAt, serverTime: at, difficulty: room.difficulty, rulesetVersion: room.rulesetVersion, roundLimit: room.roundLimit, suddenDeath: room.suddenDeath }); }
}
