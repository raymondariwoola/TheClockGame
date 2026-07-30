import { PUBLIC_ENTRIES, partitionKey, sanitizeEntry, sanitizeList } from './validation.js';

function response(body, status = 200) {
  return Response.json(body, { status });
}

export class LeaderboardRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.recentSubmissions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const key = `board:${partitionKey(Object.fromEntries(url.searchParams))}`;

    if (request.method === 'GET' && url.pathname === '/export') {
      const stored = await this.ctx.storage.list({ prefix: 'board:' });
      const boards = {};
      let entries = 0;
      for (const [boardKey, value] of stored) {
        const clean = sanitizeList(value);
        boards[boardKey] = clean;
        entries += clean.length;
      }
      return response({ boards, boardCount: Object.keys(boards).length, entryCount: entries });
    }

    if (request.method === 'POST' && url.pathname === '/clear') {
      const stored = await this.ctx.storage.list({ prefix: 'board:' });
      let entries = 0;
      for (const value of stored.values()) entries += sanitizeList(value).length;
      await this.ctx.storage.deleteAll();
      this.recentSubmissions.clear();
      return response({ clearedBoards: stored.size, clearedEntries: entries });
    }

    if (request.method === 'GET' && url.pathname === '/entries') {
      const entries = sanitizeList(await this.ctx.storage.get(key));
      return response({ entries: entries.slice(0, PUBLIC_ENTRIES), total: entries.length });
    }

    if (request.method === 'POST' && url.pathname === '/submit') {
      const body = await request.json().catch(() => null);
      const entry = sanitizeEntry(body?.entry, body?.forced || {});
      if (!entry || partitionKey(entry) !== key.slice(6)) return response({ error: 'invalid_entry' }, 400);
      const fingerprint = String(body?.fingerprint || '').slice(0, 96);
      const now = Date.now();
      if (fingerprint && now - (this.recentSubmissions.get(fingerprint) || 0) < 1500) {
        return response({ error: 'rate_limited' }, 429);
      }
      if (fingerprint) this.recentSubmissions.set(fingerprint, now);
      const submissionKey = String(body?.submissionKey || '').replace(/[^\w-]/g, '').slice(0, 72);
      const result = await this.ctx.storage.transaction(async (txn) => {
        if (submissionKey) {
          const previous = await txn.get(`submission:${submissionKey}`);
          if (previous) {
            const existing = sanitizeList(await txn.get(key));
            return { entries: existing, entryId: previous.entryId };
          }
        }
        const entries = sanitizeList([...(await txn.get(key) || []), entry]);
        await txn.put(key, entries);
        if (submissionKey) await txn.put(`submission:${submissionKey}`, { entryId: entry.id, at: now });
        return { entries, entryId: entry.id };
      });
      return response({
        entries: result.entries.slice(0, PUBLIC_ENTRIES),
        made: result.entries.some((item) => item.id === result.entryId),
        entryId: result.entryId,
      });
    }

    if (request.method === 'POST' && url.pathname === '/import') {
      const body = await request.json().catch(() => null);
      const incoming = (Array.isArray(body?.entries) ? body.entries : [])
        .map((entry) => sanitizeEntry(entry, { verification: 'legacy_unverified' }))
        .filter(Boolean);
      const entries = await this.ctx.storage.transaction(async (txn) => {
        const merged = sanitizeList([...(await txn.get(key) || []), ...incoming]);
        await txn.put(key, merged);
        return merged;
      });
      return response({ imported: incoming.length, retained: entries.length });
    }

    if (request.method === 'POST' && url.pathname === '/delete') {
      const body = await request.json().catch(() => null);
      const id = String(body?.id || '').replace(/[^\w.:-]/g, '').slice(0, 64);
      if (!id) return response({ error: 'invalid_entry_id' }, 400);
      const result = await this.ctx.storage.transaction(async (txn) => {
        const before = sanitizeList(await txn.get(key));
        const entries = before.filter((entry) => entry.id !== id);
        if (entries.length !== before.length) {
          if (entries.length) await txn.put(key, entries);
          else await txn.delete(key);
        }
        return { removed: before.length - entries.length, retained: entries.length };
      });
      return response(result);
    }

    return response({ error: 'not_found' }, 404);
  }
}
