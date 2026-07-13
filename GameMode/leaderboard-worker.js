
const MAX_ENTRIES = 20;
const MODES = ['classic', 'endless', 'zen'];

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const GIST_ID = env.GIST_ID;
    const GIST_FILE = env.GIST_FILE || 'chronos-leaderboard.json';
    const TOKEN = env.GITHUB_TOKEN;
    if (!GIST_ID || !TOKEN) return json({ error: 'worker not configured' }, cors, 500);

    const ghHeaders = (extra = {}) => ({
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + TOKEN,
      'User-Agent': 'chronos-strike-worker',
      ...extra,
    });

    async function readEntries() {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers: ghHeaders() });
      if (!res.ok) throw new Error('gist read ' + res.status);
      const gist = await res.json();
      const file = gist.files && gist.files[GIST_FILE];
      let content = file ? file.content : '{"entries":[]}';
      if (file && file.truncated) content = await (await fetch(file.raw_url)).text();
      const data = JSON.parse(content || '{"entries":[]}');
      return Array.isArray(data.entries) ? data.entries : [];
    }

    async function writeEntries(entries) {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: ghHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          files: { [GIST_FILE]: { content: JSON.stringify({ entries }, null, 2) } },
        }),
      });
      if (!res.ok) throw new Error('gist write ' + res.status);
    }

    try {
      if (request.method === 'GET') {
        return json({ entries: sanitizeList(await readEntries()) }, cors);
      }

      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));

        // Admin (GOD mode) code check
        if (body && body.action === 'verifyAdmin') {
          const ok = !!(env.ADMIN_CODE && typeof body.code === 'string'
            && safeEqual(body.code, env.ADMIN_CODE));
          return json({ ok }, cors);
        }

        // Cheat code check — on success we hand back the modifiers themselves,
        // so the exact values live here (env), not in the shipped site.
        // Optional env: CHEAT_MULT (score multiplier, default 3);
        //               CHEAT_UNLIMITED (actual life count, e.g. 5 / 50 / 9999).
        if (body && body.action === 'verifyCheat') {
          const ok = !!(env.CHEAT_CODE && typeof body.code === 'string'
            && safeEqual(body.code, env.CHEAT_CODE));
          if (!ok) return json({ ok: false }, cors);
          const mult = Number(env.CHEAT_MULT) > 0 ? Number(env.CHEAT_MULT) : 3;
          const rawLives = Number(env.CHEAT_UNLIMITED);
          const lives = (isFinite(rawLives) && rawLives >= 1) ? Math.floor(rawLives) : 9999;
          return json({ ok: true, mult, lives }, cors);
        }

        const raw = body && body.entry ? body.entry : body;
        const entry = sanitizeEntry(raw);
        if (!entry) return json({ error: 'invalid entry' }, cors, 400);

        const merged = sanitizeList([...(await readEntries()), entry]);
        const made = merged.some((e) => e.id === entry.id);
        if (made) await writeEntries(merged);
        return json({ entries: merged, made }, cors);
      }

      return json({ error: 'method not allowed' }, cors, 405);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, cors, 502);
    }
  },
};

// ---- validation / sanitation (server-side; don't trust the client) ----
function sanitizeEntry(e) {
  if (!e || typeof e.name !== 'string' || typeof e.score !== 'number') return null;
  if (!isFinite(e.score) || e.score < 0 || e.score > 100000000) return null;
  const name = e.name.replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name) return null;
  const date = e.date && !isNaN(new Date(e.date).getTime())
    ? new Date(e.date).toISOString() : new Date().toISOString();
  return {
    id: String(e.id || 'e' + Date.now().toString(36)).replace(/[^\w-]/g, '').slice(0, 40),
    name,
    score: Math.floor(e.score),
    mode: MODES.includes(e.mode) ? e.mode : 'classic',
    round: clampInt(e.round, 0, 99999),
    combo: clampInt(e.combo, 0, 99999),
    acc: clampInt(e.acc, 0, 100),
    hc: !!e.hc,
    date,
  };
}

function sanitizeList(list) {
  return (Array.isArray(list) ? list : [])
    .map(sanitizeEntry)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || new Date(a.date) - new Date(b.date))
    .slice(0, MAX_ENTRIES);
}

function clampInt(v, lo, hi) {
  const n = parseInt(v, 10);
  return isNaN(n) ? lo : Math.max(lo, Math.min(hi, n));
}

// length-aware constant-time-ish string compare (avoids trivial timing leaks)
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function json(obj, cors, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
