import { normalizeRoomCode } from '../../shared/protocol.mjs';
import { formatMatchCode, validMatchCode } from '../../shared/match-protocol.mjs';

export function isSharePath(pathname) { return /^\/s\/(ghost|clash)\/[^/]+(?:\/card\.png)?$/.test(pathname); }

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function titleCase(value) { const text = String(value || 'classic'); return text.charAt(0).toUpperCase() + text.slice(1); }
function score(value) { return Math.max(0, Number(value) || 0).toLocaleString('en-US'); }
function gameTarget(env, kind, code) {
  const game = new URL(String(env.PUBLIC_GAME_URL || 'https://raymondariwoola.github.io/TheClockGame/GameMode/'));
  game.search = ''; game.hash = ''; game.searchParams.set(kind === 'ghost' ? 'ghost' : 'duel', code); return game.toString();
}
function pageModel(kind, state) {
  if (kind === 'ghost') {
    const challenge = state.challenge; const hidden = !!challenge.hideHostScore && !challenge.host.result;
    return {
      title: `${challenge.host.name} challenged you to Beat My Time`,
      description: `${titleCase(challenge.difficulty)} ${titleCase(challenge.mode)} Ghost Challenge. ${hidden ? 'Mystery score target—revealed after you finish.' : `Target: ${score(challenge.host.result?.score)} points.`}`,
      eyebrow: 'GHOST CHALLENGE', heading: 'BEAT MY TIME', code: challenge.code,
    };
  }
  const room = state.room;
  return {
    title: `${room.seats.host.name} challenged you to a Chrono Clash`,
    description: `Live ${titleCase(room.difficulty)} race across ${room.roundLimit || 10} identical rounds. Join room ${room.code}.`,
    eyebrow: 'LIVE TWO-PLAYER CHALLENGE', heading: 'CHRONO CLASH', code: room.code,
  };
}

export function buildShareDocument({ model, pageUrl, imageUrl, targetUrl }) {
  const title = escapeHtml(model.title); const description = escapeHtml(model.description);
  const canonical = escapeHtml(pageUrl); const image = escapeHtml(imageUrl); const target = escapeHtml(targetUrl);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><meta name="description" content="${description}">
<link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="Chronos Strike">
<meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">
<style>html{color-scheme:dark;background:#03050c;font-family:system-ui,sans-serif}body{min-height:100vh;margin:0;display:grid;place-items:center;background:radial-gradient(circle at top,#182455,#03050c 65%);color:#f7fbff}.card{width:min(88vw,560px);padding:36px;border:1px solid #00f0ff66;border-radius:24px;background:#081022dd;box-shadow:0 0 50px #00f0ff22;text-align:center}.eye{color:#00f0ff;font-size:12px;letter-spacing:.2em}.code{font:800 clamp(28px,8vw,52px) monospace;color:#fff;text-shadow:0 0 22px #ff2bb5}.note{color:#b9cae8;line-height:1.5}a{display:inline-block;margin-top:12px;padding:14px 22px;border-radius:999px;background:#00f0ff;color:#031019;font-weight:800;text-decoration:none}</style></head>
<body><main class="card"><div class="eye">${escapeHtml(model.eyebrow)}</div><h1>${escapeHtml(model.heading)}</h1><div class="code">${escapeHtml(model.code)}</div><p class="note">${description}</p><a href="${target}">OPEN CHALLENGE</a></main>
<script>setTimeout(function(){location.replace(${JSON.stringify(targetUrl).replace(/</g, '\\u003c')})},350);</script></body></html>`;
}

function expiredDocument(targetUrl) {
  const target = escapeHtml(targetUrl);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chronos Strike challenge unavailable</title></head><body><p>This challenge expired or is unavailable.</p><p><a href="${target}">Open Chronos Strike</a></p><script>location.replace(${JSON.stringify(targetUrl).replace(/</g, '\\u003c')})</script></body></html>`;
}

export async function handleShareRequest(request, env) {
  const url = new URL(request.url); const match = /^\/s\/(ghost|clash)\/([^/]+)(?:\/(card\.png))?$/.exec(url.pathname);
  if (!match || request.method !== 'GET') return new Response('Not found', { status: 404 });
  const kind = match[1]; let decoded; try { decoded = decodeURIComponent(match[2]); } catch { return new Response('Bad challenge code', { status: 400 }); }
  const code = kind === 'ghost' ? normalizeRoomCode(decoded) : formatMatchCode(decoded);
  if (!code || (kind === 'clash' && !validMatchCode(code))) return new Response('Bad challenge code', { status: 400 });
  const binding = kind === 'ghost' ? env.GHOST_CHALLENGE_ROOM : env.MATCH_ROOM;
  if (!binding) return new Response('Challenge service unavailable', { status: 503 });
  const stub = binding.getByName(code);
  if (match[3]) return stub.fetch(new Request('https://share.internal/share-card'));
  const stateResponse = await stub.fetch(new Request('https://share.internal/state'));
  const targetUrl = gameTarget(env, kind, code);
  if (!stateResponse.ok) return new Response(expiredDocument(targetUrl), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  const state = await stateResponse.json(); const model = pageModel(kind, state);
  const pageUrl = `${url.origin}/s/${kind}/${encodeURIComponent(code)}`; const imageUrl = `${pageUrl}/card.png`;
  return new Response(buildShareDocument({ model, pageUrl, imageUrl, targetUrl }), { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  } });
}
