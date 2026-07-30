// Chronos Strike — offline shell plus range-aware soundtrack cache.
// Bump the version whenever a core asset changes so returning phones receive
// one coherent game revision. API, ghost, and multiplayer requests are never
// cached; offline play simply falls back to the local game shell.

const CACHE_VERSION = 7;
const APP_CACHE = `cs-app-v${CACHE_VERSION}`;
const TRACK_CACHE = `cs-soundtrack-v${CACHE_VERSION}`;
const APP_SHELL = [
  './', './index.html', './style.css?v=7', './engine.js?v=7', './game.js?v=7',
  './leaderboard-config.js?v=7', './leaderboard.js?v=7', './share.js?v=7',
  './js/storage.js?v=7', './js/run-context.js?v=7', './js/cheat-state.js?v=7',
  './js/ghost-client.js?v=7', './js/ghost-ui.js?v=7', './js/multiplayer.js?v=7',
  './js/multiplayer-ui.js?v=7', './js/share-cards.js?v=7', './vendor/anime.min.js?v=7', './vendor/fonts/fonts.css?v=7',
];
const TRACK_RE = /\/soundtrack\/.+\.(wav|mp3|ogg|m4a|aac|flac)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) =>
      (key.startsWith('cs-app-') && key !== APP_CACHE) ||
      (key.startsWith('cs-soundtrack-') && key !== TRACK_CACHE)
    ).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/v1/')) return;
  if (TRACK_RE.test(url.pathname)) { event.respondWith(serveTrack(request)); return; }
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') { event.respondWith(networkFirstPage(request)); return; }
  if (url.pathname.endsWith('/leaderboard-config.js')) { event.respondWith(networkFirstAsset(request)); return; }
  if (['script', 'style', 'font', 'image'].includes(request.destination)) event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstPage(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(new URL('index.html', self.registration.scope).href, response.clone());
    return response;
  } catch {
    return (await cache.match(new URL('index.html', self.registration.scope).href)) ||
      (await cache.match(new URL('./', self.registration.scope).href)) ||
      new Response('Chronos Strike is unavailable offline until it has been opened once.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await refresh) || new Response('', { status: 504 });
}

async function networkFirstAsset(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || new Response('', { status: 504 });
  }
}

async function serveTrack(request) {
  const cache = await caches.open(TRACK_CACHE);
  const key = new Request(request.url, { method: 'GET' });
  let full = await cache.match(key);
  if (!full) {
    try {
      const response = await fetch(key);
      if (response.status === 200) { await cache.put(key, response.clone()); full = response; }
      else return fetch(request);
    } catch { return fetch(request); }
  }
  const range = request.headers.get('range');
  if (!range) return full;
  const buffer = await full.clone().arrayBuffer(); const total = buffer.byteLength;
  const match = /bytes=(\d+)-(\d*)/.exec(range) || [];
  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const end = match[2] ? Math.min(Number.parseInt(match[2], 10), total - 1) : total - 1;
  if (start >= total || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  const chunk = buffer.slice(start, end + 1);
  return new Response(chunk, { status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': full.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${total}`,
    'Content-Length': String(chunk.byteLength), 'Accept-Ranges': 'bytes',
  } });
}
