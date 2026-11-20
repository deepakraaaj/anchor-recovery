/**
 * Small LRU cache with TTL. Map preserves insertion order, so the first key
 * is always the least recently used one.
 */
export function createLruCache({ maxEntries = 200, ttlMs = 60 * 60 * 1000, now = Date.now } = {}) {
  const store = new Map();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        store.delete(key);
        return undefined;
      }
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      store.delete(key);
      store.set(key, { value, expiresAt: now() + ttlMs });
      if (store.size > maxEntries) store.delete(store.keys().next().value);
    },
    get size() {
      return store.size;
    },
  };
}
