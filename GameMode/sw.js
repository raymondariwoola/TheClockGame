// Chronos Strike — minimal service worker.
// Its ONLY job is to cache the soundtrack files so a large track isn't
// re-downloaded on every page load. Every other request passes straight
// through to the network (so HTML/JS/CSS are never stale).
//
// To force a re-download after replacing a track file, bump CACHE_VERSION.

const CACHE_VERSION = 1;
const CACHE = 'cs-soundtrack-v' + CACHE_VERSION;
const TRACK_RE = /\/soundtrack\/.+\.(wav|mp3|ogg|m4a|aac|flac)$/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('cs-soundtrack-') && k !== CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !TRACK_RE.test(url.pathname)) return; // ignore everything else
  event.respondWith(serveTrack(event.request));
});

async function serveTrack(request) {
  const cache = await caches.open(CACHE);
  // Cache the full file once under a range-less key.
  const key = new Request(request.url, { method: 'GET' });
  let full = await cache.match(key);

  if (!full) {
    try {
      const net = await fetch(key); // no Range header → full 200 response
      if (net && net.status === 200) { await cache.put(key, net.clone()); full = net; }
      else return fetch(request);    // couldn't get a full copy → just proxy
    } catch (e) {
      return fetch(request);
    }
  }

  const range = request.headers.get('range');
  if (!range) return full;

  // Build a 206 Partial Content slice from the cached full file (media elements
  // often request ranges when streaming/seeking/looping).
  const buf = await full.clone().arrayBuffer();
  const total = buf.byteLength;
  const m = /bytes=(\d+)-(\d*)/.exec(range) || [];
  const start = m[1] ? parseInt(m[1], 10) : 0;
  const end = m[2] ? parseInt(m[2], 10) : total - 1;
  if (start >= total || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  const chunk = buf.slice(start, end + 1);
  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'audio/wav',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(chunk.byteLength),
      'Accept-Ranges': 'bytes',
    },
  });
}
