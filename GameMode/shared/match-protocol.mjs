export const MATCH_PROTOCOL_VERSION = 1;
export const MATCH_SOCKET_PROTOCOL = `chronos-clash.v${MATCH_PROTOCOL_VERSION}`;
export const MATCH_TICKET_PREFIX = 'chronos-ticket.';

export const MATCH_STATES = Object.freeze({
  WAITING: 'waiting', COUNTDOWN: 'countdown', PLAYING: 'playing', FINISHED: 'finished',
  FORFEIT: 'forfeit', CANCELLED: 'cancelled', EXPIRED: 'expired',
});

export const MATCH_CLIENT_TYPES = Object.freeze([
  'ready', 'progress', 'finish', 'heartbeat', 'rematch_vote', 'forfeit',
]);
export const MATCH_SERVER_TYPES = Object.freeze([
  'snapshot', 'presence', 'countdown', 'opponent_progress', 'opponent_finished',
  'result', 'rematch_state', 'expired', 'error',
]);
export const MATCH_LIMITS = Object.freeze({
  maxName: 24, maxMessageBytes: 4096, maxSequence: 1_000_000, codeLength: 8,
  rounds: 10, suddenDeathRounds: 1, maxSuddenDeath: 3,
});

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_RE = new RegExp(`^[${ALPHABET}]{${MATCH_LIMITS.codeLength}}$`);

export function matchTicketProtocol(ticket) { return MATCH_TICKET_PREFIX + String(ticket || ''); }
export function ticketFromProtocols(value) {
  for (const part of String(value || '').split(',').map((item) => item.trim())) {
    if (!part.startsWith(MATCH_TICKET_PREFIX)) continue;
    const ticket = part.slice(MATCH_TICKET_PREFIX.length);
    if (/^[a-f0-9]{48}$/.test(ticket)) return ticket;
  }
  return '';
}
export function normalizeMatchCode(value) {
  return String(value || '').toUpperCase().split('').filter((char) => ALPHABET.includes(char)).join('').slice(0, 8);
}
export function formatMatchCode(value) {
  const code = normalizeMatchCode(value);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
export function validMatchCode(value) { return CODE_RE.test(normalizeMatchCode(value)); }
export function cleanMatchName(value) {
  return String(value || '').replace(/[<>&"'`\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MATCH_LIMITS.maxName);
}
export function validateMatchEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.v !== MATCH_PROTOCOL_VERSION ||
      !MATCH_CLIENT_TYPES.includes(value.type) || !Number.isSafeInteger(value.seq) || value.seq < 0 ||
      value.seq > MATCH_LIMITS.maxSequence || !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) {
    return null;
  }
  return { v: MATCH_PROTOCOL_VERSION, type: value.type, seq: value.seq, payload: value.payload };
}
