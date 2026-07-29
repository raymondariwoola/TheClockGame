(function initChronosRunContext(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosRunContext = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createRunContextApi() {
  'use strict';

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  class RunContextStore {
    constructor() { this.active = null; this.lastCompleted = null; }

    start(input) {
      if (this.active) throw new Error('run_already_active');
      const source = input || {};
      if (!source.runId || !source.seed || !source.mode) throw new Error('invalid_run_context');
      this.active = deepFreeze({
        runId: String(source.runId),
        runType: String(source.runType || source.mode),
        clientVersion: String(source.clientVersion || ''),
        rulesetVersion: Number(source.rulesetVersion || 0),
        protocolVersion: Number(source.protocolVersion || 0),
        seed: String(source.seed),
        identity: String(source.identity || source.seed),
        mode: String(source.mode),
        difficulty: source.difficulty === 'hardcore' ? 'hardcore' : 'normal',
        roundLimit: source.roundLimit == null ? null : Math.max(1, Math.trunc(source.roundLimit)),
        startedAt: Number(source.startedAt || Date.now()),
        serverStartAt: source.serverStartAt == null ? null : Number(source.serverStartAt),
        assists: { ...(source.assists || {}) },
        roomCode: source.roomCode ? String(source.roomCode) : null,
        seat: source.seat === 'guest' ? 'guest' : source.seat === 'host' ? 'host' : null,
      });
      return this.active;
    }

    snapshot() { return this.active; }

    complete(extra) {
      if (!this.active) return null;
      this.lastCompleted = deepFreeze({ ...this.active, ...(extra || {}) });
      this.active = null;
      return this.lastCompleted;
    }

    abandon() {
      const previous = this.active;
      this.active = null;
      return previous;
    }
  }

  return { RunContextStore, deepFreeze };
});
