import { LIMITS, cleanName, normalizeProgress } from '../../shared/protocol.mjs';

export const MAX_ENTRIES = 100;
export const PUBLIC_ENTRIES = 20;
export const MODES = new Set(['classic', 'endless', 'zen']);

function boundedInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function cleanToken(value, max = 64) {
  const token = String(value || '').replace(/[^\w.:-]/g, '').slice(0, max);
  return token || null;
}

function sanitizeAssists(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output = {};
  for (const key of Object.keys(value).slice(0, 12)) {
    const safeKey = cleanToken(key, 24);
    if (!safeKey) continue;
    const item = value[key];
    if (typeof item === 'boolean') output[safeKey] = item;
    else if (Number.isFinite(item)) output[safeKey] = boundedInt(item, -1000, 1000);
    else output[safeKey] = String(item).slice(0, 24);
  }
  return output;
}

export function normalizeBoardQuery(source = {}) {
  const mode = MODES.has(source.mode) ? source.mode : 'classic';
  const difficulty = source.difficulty === 'hardcore' ? 'hardcore' : 'normal';
  const rulesetVersion = boundedInt(source.rulesetVersion ?? source.ruleset, 1, 9999);
  const dailyDate = /^\d{4}-\d{2}-\d{2}$/.test(String(source.dailyDate || source.day || ''))
    ? String(source.dailyDate || source.day) : null;
  const scope = source.scope === 'daily' && dailyDate ? 'daily' : 'standard';
  return { scope, mode: scope === 'daily' ? 'classic' : mode, difficulty, rulesetVersion, dailyDate };
}

export function parseBoardQuery(source = {}) {
  if (source.mode && !MODES.has(source.mode)) return null;
  if (source.difficulty && !['normal', 'hardcore'].includes(source.difficulty)) return null;
  if (source.scope && !['standard', 'daily'].includes(source.scope)) return null;
  const ruleset = Number(source.rulesetVersion ?? source.ruleset ?? 1);
  if (!Number.isInteger(ruleset) || ruleset < 1 || ruleset > 9999) return null;
  const query = normalizeBoardQuery(source);
  if (source.scope === 'daily' && !query.dailyDate) return null;
  return query;
}

export function partitionKey(query) {
  const q = normalizeBoardQuery(query);
  return [q.rulesetVersion, q.scope, q.mode, q.difficulty, q.dailyDate || '-'].join('|');
}

export function sanitizeEntry(value, forced = {}) {
  if (!value || typeof value !== 'object') return null;
  const score = Number(value.score);
  if (!Number.isFinite(score) || score < 0 || score > LIMITS.maxScore) return null;
  const mode = MODES.has(forced.mode || value.mode) ? (forced.mode || value.mode) : null;
  if (!mode) return null;
  const name = cleanName(value.name);
  const id = cleanToken(value.id || forced.runId, 64);
  if (!id || !name) return null;
  const dailyDate = /^\d{4}-\d{2}-\d{2}$/.test(String(forced.dailyDate || value.dailyDate || ''))
    ? String(forced.dailyDate || value.dailyDate) : null;
  const scope = (forced.runType === 'daily' || value.scope === 'daily') && dailyDate ? 'daily' : 'standard';
  const dateValue = new Date(value.date || Date.now());
  return {
    id,
    name,
    score: Math.trunc(score),
    mode: scope === 'daily' ? 'classic' : mode,
    round: boundedInt(value.round, 0, LIMITS.maxRound),
    combo: boundedInt(value.combo, 0, LIMITS.maxCombo),
    acc: boundedInt(value.acc, 0, 100),
    perfect: boundedInt(value.perfect, 0, LIMITS.maxRound * 4),
    hc: (forced.difficulty || (value.hc ? 'hardcore' : 'normal')) === 'hardcore',
    gameVersion: cleanToken(value.gameVersion, 16),
    rulesetVersion: boundedInt(forced.rulesetVersion ?? value.rulesetVersion, 1, 9999),
    seed: cleanToken(forced.seed || value.seed, 128),
    assists: sanitizeAssists(value.assists),
    scope,
    dailyDate: scope === 'daily' ? dailyDate : null,
    verification: forced.verification === 'legacy_unverified' ? 'legacy_unverified' : 'accepted',
    date: Number.isNaN(dateValue.getTime()) ? new Date().toISOString() : dateValue.toISOString(),
  };
}

export function sanitizeList(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((entry) => sanitizeEntry(entry, {
      runType: entry?.scope === 'daily' ? 'daily' : entry?.mode,
      dailyDate: entry?.dailyDate,
      difficulty: entry?.hc ? 'hardcore' : 'normal',
      rulesetVersion: entry?.rulesetVersion,
      seed: entry?.seed,
      verification: entry?.verification,
    }))
    .filter((entry) => entry && !seen.has(entry.id) && seen.add(entry.id))
    .sort((a, b) => b.score - a.score || b.perfect - a.perfect || b.combo - a.combo || new Date(a.date) - new Date(b.date))
    .slice(0, MAX_ENTRIES);
}

export function validateProgress(events, finalEntry) {
  if (!Array.isArray(events) || events.length < 1 || events.length > LIMITS.maxReplayEvents) return false;
  let previous = { score: 0, round: 0, perfects: 0, bestCombo: 0, accuracy: 0 };
  for (const raw of events) {
    const next = normalizeProgress(raw);
    if (next.score < previous.score || next.round < previous.round || next.perfects < previous.perfects || next.bestCombo < previous.bestCombo) return false;
    previous = next;
  }
  return previous.score === Math.trunc(finalEntry.score) && previous.round === Math.trunc(finalEntry.round);
}
