import { LIMITS, cleanName, compareResults } from '../../shared/protocol.mjs';

const MODES = new Set(['classic', 'endless', 'zen']);
const KINDS = new Set(['perfect', 'great', 'good', 'miss']);

function int(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : min;
}

function token(value, max = 128) {
  const result = String(value || '').replace(/[^\w|.:-]/g, '').slice(0, max);
  return result || null;
}

export function sanitizeGhostDraft(value) {
  if (!value || typeof value !== 'object' || !MODES.has(value.mode)) return null;
  const identity = token(value.identity, 160);
  const seed = token(value.seed, 128);
  const rulesetVersion = int(value.rulesetVersion, 1, 9999);
  if (!identity || !seed || !rulesetVersion) return null;
  return {
    name: cleanName(value.name),
    mode: value.mode,
    difficulty: value.difficulty === 'hardcore' ? 'hardcore' : 'normal',
    identity,
    seed,
    rulesetVersion,
    hideHostScore: value.hideHostScore === true,
  };
}

export function sanitizeGhostResult(value) {
  if (!value || typeof value !== 'object') return null;
  const score = Number(value.score);
  if (!Number.isFinite(score) || score < 0 || score > LIMITS.maxScore) return null;
  return {
    score: Math.trunc(score),
    round: int(value.round, 0, LIMITS.maxRound),
    perfect: int(value.perfect, 0, LIMITS.maxRound * 4),
    combo: int(value.combo, 0, LIMITS.maxCombo),
    acc: int(value.acc, 0, 100),
    finishedAt: Number.isFinite(Number(value.finishedAt)) ? Number(value.finishedAt) : Date.now(),
  };
}

export function sanitizeReplay(value, expected) {
  if (!value || typeof value !== 'object' || value.identity !== expected.identity ||
      value.mode !== expected.mode || !!value.hardcore !== (expected.difficulty === 'hardcore') ||
      Number(value.rulesetVersion) !== expected.rulesetVersion || !Array.isArray(value.strikes) ||
      value.strikes.length < 1 || value.strikes.length > LIMITS.maxReplayEvents) return null;
  let previousRound = 0;
  let previousTime = 0;
  let previousScore = 0;
  const strikes = [];
  for (const raw of value.strikes) {
    const round = int(raw?.round, 0, LIMITS.maxRound);
    const angle = Number(raw?.angle);
    const time = int(raw?.t, 0, 600_000);
    const score = int(raw?.s, 0, LIMITS.maxScore);
    if (round < 1 || !Number.isFinite(angle) || angle < 0 || angle >= 360 || !KINDS.has(raw?.kind) ||
        round < previousRound || (round === previousRound && time < previousTime) || score < previousScore) return null;
    strikes.push({ round, angle: Math.round(angle * 100) / 100, kind: raw.kind, t: time, s: score });
    previousRound = round;
    previousTime = time;
    previousScore = score;
  }
  return {
    identity: expected.identity,
    mode: expected.mode,
    hardcore: expected.difficulty === 'hardcore',
    gameVersion: token(value.gameVersion, 16),
    rulesetVersion: expected.rulesetVersion,
    score: previousScore,
    rounds: previousRound,
    strikes,
  };
}

export function resultForSeats(host, guest) {
  const comparison = compareResults({
    score: host.score, perfects: host.perfect, bestCombo: host.combo, accuracy: host.acc,
  }, {
    score: guest.score, perfects: guest.perfect, bestCombo: guest.combo, accuracy: guest.acc,
  });
  return { winner: comparison > 0 ? 'host' : comparison < 0 ? 'guest' : 'tie', hostScore: host.score, guestScore: guest.score };
}
