(function initChronosMultiplayerClient(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosMultiplayerClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMultiplayerApi(root) {
  'use strict';
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const SOCKET_PROTOCOL = 'chronos-clash.v1';
  const TICKET_PREFIX = 'chronos-ticket.';
  const PREFIX = 'cs_match_';
  const FULL_ROUNDS = 40;
  const RECONNECT = [500, 1000, 2000, 4000, 8000, 10000];
  const REACTIONS = Object.freeze({
    nice: Object.freeze({ emoji: '👏', label: 'Nice!' }),
    close: Object.freeze({ emoji: '😮', label: 'Too close!' }),
    wow: Object.freeze({ emoji: '🤯', label: 'Wow!' }),
    again: Object.freeze({ emoji: '🔁', label: 'Again!' }),
    gg: Object.freeze({ emoji: '🤝', label: 'Good game!' }),
  });
  const SABOTAGES = Object.freeze({
    reverse: Object.freeze({ emoji: '↺', label: 'Reverse Time', description: 'Reverse the next round.' }),
    narrow: Object.freeze({ emoji: '🎯', label: 'Tight Window', description: 'Narrow the next target.' }),
    haste: Object.freeze({ emoji: '⚡', label: 'Time Rush', description: 'Speed up the next round.' }),
  });
  const HANDICAPS = Object.freeze({
    none: Object.freeze({ label: 'Standard', description: 'No assistance.' }),
    headstart: Object.freeze({ label: '+500 Head Start', description: 'Begin with 500 points.' }),
    extra_life: Object.freeze({ label: '+1 Life', description: 'Begin with four lives.' }),
    wider: Object.freeze({ label: 'Wider Targets', description: 'Real targets are 25% wider.' }),
  });
  function normalizeHandicap(value) { return Object.prototype.hasOwnProperty.call(HANDICAPS, value) ? value : 'none'; }

  class MultiplayerError extends Error {
    constructor(code, status = 0) { super(code || 'network_error'); this.name = 'MultiplayerError'; this.code = code || 'network_error'; this.status = status; }
  }
  function normalizeCode(value) {
    const raw = String(value || '').toUpperCase().split('').filter((char) => ALPHABET.includes(char)).join('').slice(0, 8);
    return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : null;
  }
  function cleanName(value) { return String(value || '').replace(/[<>&"'`\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); }
  function codeFromUrl(value) {
    try { const raw = new URL(String(value || ''), 'https://chronos.local/').searchParams.get('duel'); return raw ? (normalizeCode(raw) || '') : null; }
    catch { return ''; }
  }
  function buildUrl(value, code) {
    const normalized = normalizeCode(code); if (!normalized) throw new MultiplayerError('bad_code');
    const url = new URL(String(value)); url.search = ''; url.hash = ''; url.searchParams.set('duel', normalized); return url.toString();
  }
  function removeCodeFromUrl(value) {
    const url = new URL(String(value)); url.searchParams.delete('duel'); return url.toString();
  }
  function rematchStory(room, viewer = null) {
    const result = room?.result || {}; const story = result.story || {};
    const winner = result.winner; const viewed = viewer === 'host' || viewer === 'guest'; const won = viewed && winner === viewer;
    const lost = viewed && winner && winner !== viewer; const margin = Math.max(0, Number(story.margin) || 0);
    let headline = 'TIMELINE DRAW';
    if (winner && Number(story.suddenDeath || room?.suddenDeath) > 0) headline = viewed ? `SUDDEN-DEATH ${won ? 'WIN' : 'LOSS'}` : 'SUDDEN-DEATH FINISH';
    else if (winner && ['forfeit', 'disconnect'].includes(result.reason)) headline = viewed ? `${won ? 'WIN' : 'LOSS'} BY ${result.reason.toUpperCase()}` : `${result.reason.toUpperCase()} FINISH`;
    else if (winner && margin > 0) headline = viewed ? `${won ? 'WON' : 'LOST'} BY ${margin.toLocaleString()}` : `WIN BY ${margin.toLocaleString()}`;
    else if (winner) headline = viewed ? `${won ? 'WON' : 'LOST'} ON ${String(result.reason || 'TIEBREAK').toUpperCase()}` : `WIN ON ${String(result.reason || 'TIEBREAK').toUpperCase()}`;
    if (!winner && lost) headline = 'TIMELINE DRAW';
    const details = [];
    const changes = Math.max(0, Number(story.leadChanges) || 0);
    if (changes) details.push(`${changes} LEAD ${changes === 1 ? 'CHANGE' : 'CHANGES'}`);
    if (Number.isFinite(story.closestGap)) details.push(`CLOSEST GAP · ${Math.max(0, story.closestGap).toLocaleString()}`);
    if (!details.length) details.push(`MATCH ${Math.max(1, Number(room?.matchNumber) || 1)}`);
    return { headline, details: details.slice(0, 2) };
  }
  function socketUrl(base, code) { const url = new URL(`${base}/v1/matches/${encodeURIComponent(code)}/socket`); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; return url.toString(); }

  class MultiplayerClient {
    constructor({ baseUrl, fetchImpl, WebSocketImpl, sessionStore, heartbeatMs = 15000 } = {}) {
      this.baseUrl = String(baseUrl || '').replace(/\/+$/, ''); this.fetchImpl = fetchImpl || root?.fetch?.bind(root);
      this.WebSocketImpl = WebSocketImpl || root?.WebSocket; this.store = sessionStore || root?.sessionStorage;
      this.heartbeatMs = heartbeatMs; this.memory = new Map(); this.listeners = new Map(); this.socket = null;
      this.room = null; this.code = null; this.connection = 'idle'; this.manualClose = false; this.reconnectAttempt = 0;
      this.reconnectTimer = null; this.heartbeatTimer = null; this.generation = 0; this.pendingProgress = null; this.pendingFinish = null;
    }
    on(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); return () => this.listeners.get(type)?.delete(fn); }
    emit(type, value = {}) { for (const fn of this.listeners.get(type) || []) fn(value); }
    setConnection(value, detail = {}) { this.connection = value; this.emit('connection', { connection: value, ...detail }); }
    key(code) { return PREFIX + String(normalizeCode(code) || '').replace('-', ''); }
    session(code) {
      const normalized = normalizeCode(code); if (!normalized) return null;
      if (this.memory.has(normalized)) return { ...this.memory.get(normalized) };
      try {
        const value = JSON.parse(this.store?.getItem(this.key(normalized)) || 'null');
        if (value?.code === normalized && ['host', 'guest'].includes(value.seat) && /^[a-f0-9]{48}$/.test(value.token)) {
          value.nextSeq = Math.max(0, Number(value.nextSeq) || 0); this.memory.set(normalized, value); return { ...value };
        }
      } catch {}
      return null;
    }
    saveSession(value) {
      const session = { ...value, code: normalizeCode(value.code), nextSeq: Math.max(0, Number(value.nextSeq) || 0) };
      this.memory.set(session.code, session); try { this.store?.setItem(this.key(session.code), JSON.stringify(session)); } catch {}
      return { ...session };
    }
    clearSession(code) { const normalized = normalizeCode(code); if (!normalized) return; this.memory.delete(normalized); try { this.store?.removeItem(this.key(normalized)); } catch {} }
    async request(path, options = {}) {
      if (!this.baseUrl || !this.fetchImpl) throw new MultiplayerError('multiplayer_unconfigured');
      let response; try { response = await this.fetchImpl(this.baseUrl + path, options); } catch { throw new MultiplayerError('offline'); }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok === false) throw new MultiplayerError(data?.error || 'network_error', response.status);
      return data;
    }
    async create({ name, difficulty, handicap = 'none' }) {
      const player = cleanName(name); if (!player) throw new MultiplayerError('bad_name');
      const data = await this.request('/v1/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: player, difficulty, roundLimit: FULL_ROUNDS, handicap: normalizeHandicap(handicap) }) });
      const session = this.saveSession({ code: data.code, seat: 'host', token: data.hostToken, nextSeq: 0 });
      this.code = session.code; this.room = data.room; return { room: data.room, session };
    }
    async join({ code, name, handicap = 'none' }) {
      const normalized = normalizeCode(code); const player = cleanName(name); if (!normalized) throw new MultiplayerError('bad_code'); if (!player) throw new MultiplayerError('bad_name');
      const data = await this.request(`/v1/matches/${normalized}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: player, maxRoundLimit: FULL_ROUNDS, handicap: normalizeHandicap(handicap) }) });
      const session = this.saveSession({ code: normalized, seat: 'guest', token: data.playerToken, nextSeq: 0 });
      this.code = normalized; this.room = data.room; return { room: data.room, session };
    }
    async uploadShareCard(blob, code = this.code) {
      const session = this.session(code); if (!session || session.seat !== 'host') throw new MultiplayerError('session_missing');
      if (!(blob && blob.type === 'image/png')) throw new MultiplayerError('invalid_share_card');
      return this.request(`/v1/matches/${session.code}/share-card`, { method: 'PUT', headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${session.token}` }, body: blob });
    }
    async read(code) { const normalized = normalizeCode(code); if (!normalized) throw new MultiplayerError('bad_code'); const data = await this.request(`/v1/matches/${normalized}`); this.code = normalized; this.room = data.room; return data.room; }
    async recover(code) { const room = await this.read(code); const session = this.session(code); if (session) await this.connect(session.code); return { room, session }; }
    async connect(code = this.code) {
      const session = this.session(code); if (!session) throw new MultiplayerError('session_missing'); if (!this.WebSocketImpl) throw new MultiplayerError('websocket_unavailable');
      const generation = ++this.generation; this.manualClose = false; this.code = session.code; this.cancelReconnect(); this.setConnection(this.reconnectAttempt ? 'reconnecting' : 'connecting');
      const ticket = await this.request(`/v1/matches/${session.code}/ticket`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
      if (generation !== this.generation) return null;
      const socket = new this.WebSocketImpl(socketUrl(this.baseUrl, session.code), [SOCKET_PROTOCOL, TICKET_PREFIX + ticket.ticket]); this.socket = socket;
      return new Promise((resolve, reject) => {
        let settled = false;
        socket.addEventListener('open', () => { if (socket !== this.socket || generation !== this.generation) return; settled = true; this.reconnectAttempt = 0; const flushed = this.flushPending(); this.setConnection('connected', { flushed }); this.scheduleHeartbeat(); resolve(socket); }, { once: true });
        socket.addEventListener('message', (event) => this.handleMessage(socket, event.data));
        socket.addEventListener('close', (event) => { if (socket !== this.socket || generation !== this.generation) return; this.stopHeartbeat(); this.socket = null; if (!settled) { settled = true; reject(new MultiplayerError('socket_failed')); } if (!this.manualClose) this.scheduleReconnect(); this.emit('close', event); });
        socket.addEventListener('error', () => { if (!settled) { settled = true; reject(new MultiplayerError('socket_failed')); } }, { once: true });
      });
    }
    handleMessage(socket, raw) {
      if (socket !== this.socket) return; let message; try { message = JSON.parse(String(raw)); } catch { return; }
      if (!message || message.v !== 1 || typeof message.type !== 'string' || !message.payload || typeof message.payload !== 'object') return;
      if (message.payload.room) this.room = message.payload.room;
      if (message.type === 'error' && ['socket_replaced', 'multiplayer_disabled'].includes(message.payload.code)) { this.manualClose = true; this.setConnection(message.payload.code === 'socket_replaced' ? 'replaced' : 'disabled'); }
      if (message.type === 'expired') { this.clearSession(this.code); this.manualClose = true; }
      this.emit('message', message); this.emit(message.type, message.payload);
    }
    send(type, payload = {}) {
      if (!this.socket || this.socket.readyState !== 1) throw new MultiplayerError('not_connected');
      const session = this.session(this.code); if (!session) throw new MultiplayerError('session_missing'); const seq = session.nextSeq;
      this.socket.send(JSON.stringify({ v: 1, type, seq, payload })); this.saveSession({ ...session, nextSeq: seq + 1 }); return seq;
    }
    ready() { return this.send('ready'); }
    progress(value) {
      if (this.pendingFinish) return null;
      if (!this.socket || this.socket.readyState !== 1) { this.pendingProgress = value; return null; }
      return this.send('progress', value);
    }
    finish(value) {
      if (!this.socket || this.socket.readyState !== 1) { this.pendingProgress = null; this.pendingFinish = value; return null; }
      return this.send('finish', value);
    }
    flushPending() {
      const type = this.pendingFinish ? 'finish' : this.pendingProgress ? 'progress' : null;
      const payload = this.pendingFinish || this.pendingProgress;
      if (!type) return false;
      this.pendingFinish = null; this.pendingProgress = null;
      try { this.send(type, payload); return true; }
      catch { if (type === 'finish') this.pendingFinish = payload; else this.pendingProgress = payload; return false; }
    }
    rematch() { return this.send('rematch_vote'); }
    reaction(id) {
      const value = String(id || '');
      if (!Object.prototype.hasOwnProperty.call(REACTIONS, value)) throw new MultiplayerError('invalid_reaction');
      return this.send('reaction', { id: value });
    }
    sabotage(effect) {
      const value = String(effect || '');
      if (!Object.prototype.hasOwnProperty.call(SABOTAGES, value)) throw new MultiplayerError('invalid_sabotage');
      return this.send('sabotage', { effect: value });
    }
    forfeit() { return this.send('forfeit'); }
    disconnect() { this.manualClose = true; this.generation++; this.cancelReconnect(); this.stopHeartbeat(); this.pendingProgress = null; this.pendingFinish = null; const socket = this.socket; this.socket = null; try { if (socket && socket.readyState < 2) socket.close(1000, 'client closed'); } catch {} this.setConnection('idle'); }
    scheduleReconnect() { if (this.manualClose || !this.code || !this.session(this.code) || this.reconnectTimer) return; const delay = RECONNECT[Math.min(this.reconnectAttempt++, RECONNECT.length - 1)]; this.setConnection('reconnecting', { delay }); this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect().catch(() => this.scheduleReconnect()); }, delay); }
    cancelReconnect() { if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    scheduleHeartbeat() { this.stopHeartbeat(); if (!this.heartbeatMs || this.manualClose) return; this.heartbeatTimer = setTimeout(() => { this.heartbeatTimer = null; try { this.send('heartbeat'); } catch {} this.scheduleHeartbeat(); }, this.heartbeatMs); this.heartbeatTimer?.unref?.(); }
    stopHeartbeat() { if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer); this.heartbeatTimer = null; }
  }
  return { MultiplayerClient, MultiplayerError, REACTIONS, SABOTAGES, HANDICAPS, rematchStory, normalizeCode, normalizeHandicap, cleanName, codeFromUrl, buildUrl, removeCodeFromUrl };
});
