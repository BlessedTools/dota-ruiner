import { describe, expect, it } from 'vitest';
import { createHistoryStore, toHistorySnapshot } from '../../src/storage/history.js';

const analysis = (id, source = 'opendota') => ({ source, matchId: id, startTime: 1000 + id, duration: 1800, mode: 'ranked', dataCoverage: 80, quality: { quality: 'medium' }, modelVersions: { ruin: 'ruin-v2.0.0', impact: 'impact-v2.0.0' }, leaders: {}, teams: [], match: { rawSecret: 'never-store', players: [] } });
function memoryStorage(initial = null) { let value = initial; return { getItem: () => value, setItem: (_key, next) => { value = next; }, value: () => value }; }

describe('analysis history', () => {
  it('stores at most 15 compact schema-versioned snapshots and replaces duplicates', () => {
    const storage = memoryStorage(); const store = createHistoryStore(storage);
    for (let id = 1; id <= 17; id++) store.save(analysis(id));
    store.save({ ...analysis(17), dataCoverage: 91 });
    expect(store.list()).toHaveLength(15);
    expect(store.list()[0]).toMatchObject({ matchId: 17, dataCoverage: 91, schemaVersion: 1 });
    expect(storage.value()).not.toContain('rawSecret');
  });

  it('excludes demo, survives corrupt JSON, and reports quota failure', () => {
    const corrupt = createHistoryStore(memoryStorage('{broken'));
    expect(corrupt.list()).toEqual([]);
    expect(corrupt.save(analysis(1, 'demo'))).toBe(false);
    const blocked = createHistoryStore({ getItem: () => null, setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } });
    expect(blocked.save(analysis(2))).toBe(false);
  });

  it('creates a snapshot without raw match data', () => {
    expect(toHistorySnapshot(analysis(9))).not.toHaveProperty('match');
  });
});
