(function initChronosStorage(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStorage() {
  'use strict';

  function backend() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; }
    catch { return null; }
  }

  function read(key, fallback = null) {
    const store = backend();
    if (!store) return fallback;
    try {
      const raw = store.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }

  function write(key, value) {
    const store = backend();
    if (!store) return false;
    try { store.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function readInt(key, fallback = 0) {
    const store = backend();
    if (!store) return fallback;
    try {
      const value = Number.parseInt(store.getItem(key) || '', 10);
      return Number.isFinite(value) ? value : fallback;
    } catch { return fallback; }
  }

  function writeInt(key, value) {
    const store = backend();
    if (!store) return false;
    const safe = Number.isFinite(value) ? Math.trunc(value) : 0;
    try { store.setItem(key, String(safe)); return true; }
    catch { return false; }
  }

  // Applies a narrowly scoped localStorage reset once per reset ID and browser
  // origin. Keeping the same ID makes subsequent page loads a no-op; changing
  // it intentionally starts one new reset cycle on each device's next load.
  function resetKeysOnce(resetId, keys, markerKey = 'cs_local_reset_applied') {
    const store = backend();
    const id = String(resetId || '').trim();
    const targets = [...new Set((Array.isArray(keys) ? keys : [])
      .map((key) => String(key || '').trim()).filter(Boolean))];
    if (!store || !id || !targets.length || targets.includes(markerKey)) {
      return { applied: false, resetId: id || null, removed: [] };
    }
    try {
      if (store.getItem(markerKey) === id) return { applied: false, resetId: id, removed: [] };
      const removed = targets.filter((key) => store.getItem(key) !== null);
      targets.forEach((key) => store.removeItem(key));
      store.setItem(markerKey, id);
      return { applied: true, resetId: id, removed };
    } catch {
      return { applied: false, resetId: id, removed: [] };
    }
  }

  // Additive versioned migration helper. Each migration receives the previous
  // document and must return the next one; failures preserve the old value.
  function migrate(key, targetVersion, migrations, fallback = {}) {
    const current = read(key, fallback) || fallback;
    let next = (current && typeof current === 'object') ? { ...current } : { ...fallback };
    let version = Number.isInteger(next.version) ? next.version : 0;
    try {
      while (version < targetVersion) {
        const migration = migrations && migrations[version + 1];
        if (typeof migration !== 'function') throw new Error('missing_migration');
        next = migration(next);
        version++;
        next.version = version;
      }
      write(key, next);
      return next;
    } catch { return current; }
  }

  return { read, write, readInt, writeInt, resetKeysOnce, migrate };
});
