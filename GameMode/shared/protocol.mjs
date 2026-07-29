export const PROTOCOL_VERSION = 1;

export const LIMITS = Object.freeze({
  maxMessageBytes: 8192,
  maxNameChars: 24,
  maxReplayEvents: 512,
  maxScore: 2_000_000_000,
  maxRound: 10_000,
  maxCombo: 1_000_000,
});

const ROOM_CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

export function normalizeRoomCode(value) {
  const raw = String(value || '').toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, '');
  if (raw.length !== 8) return null;
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return ROOM_CODE_RE.test(code) ? code : null;
}

export function cleanName(value) {
  return String(value || '')
    .replace(/[<>&"'`\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITS.maxNameChars) || 'Rival';
}

function boundedInt(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

// Cheat state is intentionally absent. Only resulting ordinary progress crosses
// the multiplayer/ghost boundary.
export function normalizeProgress(source = {}) {
  return {
    score: boundedInt(source.score, 0, LIMITS.maxScore),
    round: boundedInt(source.round, 0, LIMITS.maxRound),
    perfects: boundedInt(source.perfects, 0, LIMITS.maxRound * 4),
    bestCombo: boundedInt(source.bestCombo, 0, LIMITS.maxCombo),
    accuracy: boundedInt(source.accuracy, 0, 100),
    finished: source.finished === true,
  };
}

export function compareResults(left, right) {
  const a = normalizeProgress(left);
  const b = normalizeProgress(right);
  const fields = ['score', 'perfects', 'bestCombo', 'accuracy'];
  for (const field of fields) {
    if (a[field] !== b[field]) return a[field] > b[field] ? 1 : -1;
  }
  return 0;
}

export function envelope(type, payload = {}, sequence = 0) {
  return { v: PROTOCOL_VERSION, type: String(type), seq: boundedInt(sequence, 0, Number.MAX_SAFE_INTEGER), payload };
}

export function parseEnvelope(value) {
  if (!value || typeof value !== 'object' || value.v !== PROTOCOL_VERSION ||
      typeof value.type !== 'string' || value.type.length > 32 ||
      !Number.isInteger(value.seq) || value.seq < 0 ||
      !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) return null;
  return value;
}
