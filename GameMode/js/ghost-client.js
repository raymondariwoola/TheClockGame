(function initGhostClient(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosGhostClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createGhostClientApi(root) {
  'use strict';
  const PREFIX = 'cs_cloud_ghost_';
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  class GhostClientError extends Error {
    constructor(code, status = 0) { super(code); this.name = 'GhostClientError'; this.code = code; this.status = status; }
  }

  function normalizeCode(value) {
    const raw = String(value || '').toUpperCase().split('').filter((char) => ALPHABET.includes(char)).join('');
    return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : null;
  }

  function codeFromUrl(value) {
    try {
      const raw = new URL(String(value || ''), 'https://chronos.local/').searchParams.get('ghost');
      return raw ? (normalizeCode(raw) || '') : null;
    } catch { return ''; }
  }

  function buildUrl(value, code) {
    const normalized = normalizeCode(code);
    if (!normalized) throw new GhostClientError('bad_code');
    const url = new URL(String(value));
    url.search = '';
    url.hash = '';
    url.searchParams.set('ghost', normalized);
    return url.toString();
  }

  class GhostChallengeClient {
    constructor({ baseUrl, fetchImpl, sessionStore } = {}) {
      this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
      this.fetchImpl = fetchImpl || root?.fetch?.bind(root);
      this.store = sessionStore || root?.sessionStorage;
      this.memory = new Map();
      this.code = null;
      this.challenge = null;
    }

    key(code) { return PREFIX + normalizeCode(code); }
    session(code) {
      const normalized = normalizeCode(code);
      if (!normalized) return null;
      if (this.memory.has(normalized)) return { ...this.memory.get(normalized) };
      try {
        const value = JSON.parse(this.store?.getItem(this.key(normalized)) || 'null');
        if (value?.code === normalized && ['host', 'guest'].includes(value.seat) && /^[a-f0-9]{48}$/.test(value.token)) {
          this.memory.set(normalized, value);
          return { ...value };
        }
      } catch {}
      return null;
    }

    saveSession(value) {
      const session = { ...value, code: normalizeCode(value.code) };
      this.memory.set(session.code, session);
      try { this.store?.setItem(this.key(session.code), JSON.stringify(session)); } catch {}
      return { ...session };
    }

    async request(path, options = {}) {
      if (!this.baseUrl || !this.fetchImpl) throw new GhostClientError('ghosts_unconfigured');
      let response;
      try { response = await this.fetchImpl(this.baseUrl + path, options); }
      catch { throw new GhostClientError('offline'); }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok === false) throw new GhostClientError(data?.error || 'network_error', response.status);
      return data;
    }

    async createFromReplay({ name, record, result, hideHostScore = false }) {
      const created = await this.request('/v1/ghosts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, mode: record.mode, difficulty: record.hardcore ? 'hardcore' : 'normal',
          identity: record.identity, seed: record.identity, rulesetVersion: record.rulesetVersion,
          hideHostScore,
        }),
      });
      const session = this.saveSession({ code: created.code, seat: 'host', token: created.hostToken });
      this.code = session.code;
      const finished = await this.request(`/v1/ghosts/${session.code}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ replay: record, result }),
      });
      this.challenge = finished.challenge;
      return { challenge: finished.challenge, session };
    }

    async read(code) {
      const normalized = normalizeCode(code);
      if (!normalized) throw new GhostClientError('bad_code');
      const data = await this.request(`/v1/ghosts/${normalized}`);
      this.code = normalized;
      this.challenge = data.challenge;
      return data.challenge;
    }

    async recover(code) { return { challenge: await this.read(code), session: this.session(code) }; }

    async join(code, name) {
      const normalized = normalizeCode(code);
      if (!normalized) throw new GhostClientError('bad_code');
      const data = await this.request(`/v1/ghosts/${normalized}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const session = this.saveSession({ code: normalized, seat: 'guest', token: data.guestToken });
      this.code = normalized;
      this.challenge = data.challenge;
      return { challenge: data.challenge, session };
    }

    async finishGuest(result) {
      const session = this.session(this.code);
      if (!session || session.seat !== 'guest') throw new GhostClientError('session_missing');
      const data = await this.request(`/v1/ghosts/${session.code}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ result }),
      });
      this.challenge = data.challenge;
      return data.challenge;
    }

    async uploadShareCard(blob, code = this.code) {
      const session = this.session(code);
      if (!session || session.seat !== 'host') throw new GhostClientError('session_missing');
      if (!(blob && blob.type === 'image/png')) throw new GhostClientError('invalid_share_card');
      return this.request(`/v1/ghosts/${session.code}/share-card`, {
        method: 'PUT', headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${session.token}` }, body: blob,
      });
    }
  }

  return { GhostChallengeClient, GhostClientError, normalizeCode, codeFromUrl, buildUrl };
});
