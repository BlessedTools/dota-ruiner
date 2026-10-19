import { describe, expect, it, vi } from 'vitest';

import { TtlCache } from '../../server/cache.js';

describe('TtlCache', () => {
  it('expires values after the configured ten minute TTL', () => {
    let now = 1_000;
    const cache = new TtlCache({ ttlMs: 10 * 60_000, now: () => now });
    cache.set('42', { match_id: 42 });

    now += 10 * 60_000 - 1;
    expect(cache.get('42')).toEqual({ match_id: 42 });
    now += 1;
    expect(cache.get('42')).toBeUndefined();
  });

  it('evicts the least recently used value when bounded capacity is reached', () => {
    const cache = new TtlCache({ maxEntries: 2 });
    cache.set('first', 1);
    cache.set('second', 2);
    expect(cache.get('first')).toBe(1);
    cache.set('third', 3);

    expect(cache.get('second')).toBeUndefined();
    expect(cache.get('first')).toBe(1);
    expect(cache.get('third')).toBe(3);
  });

  it('does not cache a loader failure', async () => {
    const cache = new TtlCache();
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('upstream unavailable'))
      .mockResolvedValueOnce({ match_id: 42 });

    await expect(cache.getOrLoad('42', loader)).rejects.toThrow('upstream unavailable');
    await expect(cache.getOrLoad('42', loader)).resolves.toEqual({ match_id: 42 });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
