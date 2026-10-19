/** A small TTL cache with least-recently-used eviction and request coalescing. */
export class TtlCache {
  constructor({ ttlMs = 10 * 60_000, maxEntries = 100, now = Date.now } = {}) {
    if (ttlMs <= 0 || maxEntries <= 0) throw new TypeError('ttlMs and maxEntries must be positive');
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
    this.loads = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
    return value;
  }

  getOrLoad(key, loader) {
    const cached = this.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    if (this.loads.has(key)) return this.loads.get(key);

    const load = Promise.resolve()
      .then(loader)
      .then((value) => this.set(key, value))
      .finally(() => this.loads.delete(key));
    this.loads.set(key, load);
    return load;
  }
}
