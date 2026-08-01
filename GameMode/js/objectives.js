(function initChronosObjectives(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosObjectives = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createObjectivesApi() {
  'use strict';
  const STORAGE_KEY = 'cs_objective_mastery_v1';
  const DEFINITIONS = Object.freeze([
    Object.freeze({ id: 'perfect-trio', icon: '✨', title: 'Perfect Trio', description: 'Land 3 Perfect strikes.', metric: 'perfectHits', target: 3 }),
    Object.freeze({ id: 'against-flow', icon: '↺', title: 'Against the Flow', description: 'Land 2 counter-clockwise Perfects.', metric: 'reversePerfects', target: 2, exclude: ['zen'] }),
    Object.freeze({ id: 'clean-boss', icon: '👑', title: 'Untouched Boss', description: 'Clear a boss round without a miss.', metric: 'cleanBosses', target: 1, exclude: ['zen'] }),
    Object.freeze({ id: 'streak-six', icon: '🔥', title: 'Hot Streak', description: 'Reach a 6-hit streak.', metric: 'bestStreak', target: 6 }),
    Object.freeze({ id: 'clean-five', icon: '🛡️', title: 'Clean Clock', description: 'Clear 5 rounds without a miss.', metric: 'cleanRounds', target: 5 }),
    Object.freeze({ id: 'score-2500', icon: '💫', title: 'Shard Hunter', description: 'Reach 2,500 points.', metric: 'score', target: 2500 }),
  ]);

  function hash(value) {
    let out = 2166136261;
    for (const char of String(value || '')) { out ^= char.charCodeAt(0); out = Math.imul(out, 16777619); }
    return out >>> 0;
  }
  function draw(identity, mode, count = 2, eligibleIds = null) {
    const allowed = Array.isArray(eligibleIds) ? new Set(eligibleIds) : null;
    const pool = DEFINITIONS.filter((item) => !(item.exclude || []).includes(mode) && (!allowed || allowed.has(item.id))); const picked = [];
    let seed = hash(`objectives|v1|${identity}|${mode}`);
    while (pool.length && picked.length < Math.max(0, count)) {
      seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 3266489917) >>> 0;
      picked.push(pool.splice(seed % pool.length, 1)[0]);
    }
    return picked;
  }
  function mastery(total) {
    const value = Math.max(0, Number(total) || 0);
    if (value >= 25) return { rank: 'Objective Legend', theme: 'gold', next: null };
    if (value >= 10) return { rank: 'Chronomancer', theme: 'cyan', next: 25 };
    if (value >= 3) return { rank: 'Pathfinder', theme: 'bronze', next: 10 };
    return { rank: 'Objective Scout', theme: 'standard', next: 3 };
  }
  function cleanProfile(value) {
    const byId = {};
    for (const item of DEFINITIONS) byId[item.id] = Math.max(0, Math.min(9999, Number(value?.byId?.[item.id]) || 0));
    const total = Object.values(byId).reduce((sum, count) => sum + count, 0);
    return { v: 1, total, byId, ...mastery(total) };
  }
  function loadProfile(store) {
    try { return cleanProfile(JSON.parse(store?.getItem(STORAGE_KEY) || 'null')); } catch { return cleanProfile(null); }
  }
  function saveProfile(store, profile) { try { store?.setItem(STORAGE_KEY, JSON.stringify({ v: 1, total: profile.total, byId: profile.byId })); } catch {} }
  function createTracker({ identity, mode, store, eligibleIds = null } = {}) {
    const cards = draw(identity, mode, 2, eligibleIds).map((item) => ({ ...item, progress: 0, completed: false }));
    let profile = loadProfile(store);
    function update(metrics = {}) {
      const newly = [];
      for (const card of cards) {
        card.progress = Math.max(card.progress, Math.max(0, Number(metrics[card.metric]) || 0));
        if (!card.completed && card.progress >= card.target) { card.completed = true; newly.push(card.id); }
      }
      if (newly.length) {
        for (const id of newly) profile.byId[id] = Math.min(9999, (profile.byId[id] || 0) + 1);
        profile = cleanProfile(profile); saveProfile(store, profile);
      }
      return { newly, cards: snapshot().cards, profile: { ...profile, byId: { ...profile.byId } } };
    }
    function snapshot() { return { identity: String(identity || ''), mode: String(mode || ''), cards: cards.map((card) => ({ ...card })), profile: { ...profile, byId: { ...profile.byId } } }; }
    return { update, snapshot };
  }
  function profileSummary(store) {
    const profile = loadProfile(store);
    return `${profile.total} cards completed · ${profile.rank}${profile.next ? ` · Next style at ${profile.next}` : ' · Max style unlocked'}`;
  }

  return { STORAGE_KEY, DEFINITIONS, hash, draw, mastery, loadProfile, createTracker, profileSummary };
});
