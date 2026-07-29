import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.CHRONOS_SITE_PORT || 8000);
const WORKER = String(process.env.CHRONOS_WORKER_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
}

async function proxy(request, response) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 1024 * 1024) return send(response, 413, 'Request too large');
    chunks.push(chunk);
  }
  const upstream = await fetch(WORKER + request.url, {
    method: request.method,
    headers: { 'Content-Type': request.headers['content-type'] || 'application/json' },
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.concat(chunks),
  });
  const headers = Object.fromEntries(upstream.headers);
  headers['Cache-Control'] = 'no-store';
  response.writeHead(upstream.status, headers);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function serve(request, response) {
  if (request.url === '/v1' || request.url.startsWith('/v1/')) return proxy(request, response);
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(response, 400, 'Bad path'); }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = resolve(ROOT, relative);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return send(response, 403, 'Forbidden');
  try {
    const info = await stat(target);
    const file = info.isDirectory() ? resolve(target, 'index.html') : target;
    const body = await readFile(file);
    send(response, 200, body, MIME[extname(file).toLowerCase()] || 'application/octet-stream');
  } catch { send(response, 404, 'Not found'); }
}

const server = http.createServer((request, response) => {
  serve(request, response).catch(() => send(response, 502, 'Development proxy unavailable'));
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Chronos GameMode: http://127.0.0.1:${PORT} (Worker proxy: ${WORKER})`);
});
