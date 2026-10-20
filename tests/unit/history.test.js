import { describe, expect, it } from 'vitest';
import { createHistoryStore, toHistorySnapshot } from '../../src/storage/history.js';

const analysis = (id, source = 'opendota') => ({ source, matchId: id, startTime: 1000 + id, duration: 1800, mode: 'ranked', metadata: { patch: '7.40', region: 'Europe' }, dataCoverage: 80, quality: { quality: 'medium' }, modelVersions: { ruin: 'ruin-v4.0.0', impact: 'impact-v4.0.0' }, leaders: {}, teams: [], summaries: { radiant: { observedPlayers: 5 }, dire: { observedPlayers: 5 } }, availability: { categories: { summary: { status: 'available', reason: 'summary-observed' } } }, narrative: { lead: 'Radiant победили.', paragraphs: ['Наблюдаемый итог.'], limitations: [] }, match: { rawSecret: 'never-store', objectives: [{ time: 500, secret: true }], players: [] } });
function memoryStorage(initial = null) { let value = initial; return { getItem: () => value, setItem: (_key, next) => { value = next; }, value: () => value }; }

describe('analysis history', () => {
  it('stores at most 15 compact schema-versioned snapshots and replaces duplicates', () => {
    const storage = memoryStorage(); const store = createHistoryStore(storage);
    for (let id = 1; id <= 17; id++) store.save(analysis(id));
    store.save({ ...analysis(17), dataCoverage: 91 });
    expect(store.list()).toHaveLength(15);
    expect(store.list()[0]).toMatchObject({ matchId: 17, dataCoverage: 91, schemaVersion: 3, cacheState: 'cached' });
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

  it('keeps a compact real net worth timeline for offline review', () => {
    const input = analysis(10);
    input.match.players = [{ slot: 0, heroId: 1, networth_t: [600, 900, 1300], gold_t: [0, 300, 700], xp_t: [0, 250, 600] }];
    expect(toHistorySnapshot(input).timelines[0]).toMatchObject({ networth_t: [600, 900, 1300] });
  });

  it('keeps the result and compact presentation fields required by the offline screen', () => {
    const input = analysis(11);
    Object.assign(input, { radiantWin: true, radiantScore: 30, direScore: 20 });
    input.teams = [{ id: 'radiant', label: 'Radiant', players: [{
      slot: 0, name: 'Player', heroName: 'Axe', heroId: 2, heroImage: 'https://cdn.cloudflare.steamstatic.com/axe.png',
      kills: 8, deaths: 2, assists: 10, gpm: 600, netWorth: 21000, ruinScore: 20, impactScore: 80,
      ruin: { components: [{ id: 'deaths', available: true }, { id: 'throw', available: false }] },
      role: { position: 'offlane', certainty: 'medium' }, recommendations: { weaknesses: [], strengths: [] },
    }] }];
    expect(toHistorySnapshot(input)).toMatchObject({
      schemaVersion: 3, radiantWin: true, radiantScore: 30, direScore: 20,
      teams: [{ players: [{ heroImage: 'https://cdn.cloudflare.steamstatic.com/axe.png', gpm: 600, netWorth: 21000, ruin: { components: [{ id: 'deaths', available: true }, { id: 'throw', available: false }] } }] }],
    });
  });

  it('migrates schema-v2 entries and marks unavailable rich sections explicitly', () => {
    const legacy = [{ schemaVersion: 2, source: 'opendota', matchId: 42, teams: [], leaders: {}, timelines: [] }];
    const store = createHistoryStore(memoryStorage(JSON.stringify(legacy)));
    expect(store.list()[0]).toMatchObject({
      schemaVersion: 3,
      matchId: 42,
      cacheState: 'cached',
      metadata: {},
      summaries: null,
      availability: { status: 'missing', reason: 'legacy-schema-v2' },
    });
  });

  it('stores the enriched presentation model without raw logs and stays below 2.5 MB', () => {
    const input = analysis(77);
    input.match.players = Array.from({ length: 10 }, (_, slot) => ({ slot, heroId: slot + 1, networth_t: Array.from({ length: 240 }, (_v, minute) => minute * 100), deathsLog: Array.from({ length: 200 }, () => ({ time: 10 })) }));
    const snapshot = toHistorySnapshot(input);
    expect(snapshot).toMatchObject({ metadata: { patch: '7.40' }, summaries: input.summaries, availability: input.availability, narrative: input.narrative });
    expect(snapshot.timelines[0].networth_t.length).toBeLessThanOrEqual(61);
    expect(JSON.stringify(snapshot)).not.toContain('deathsLog');
    expect(new Blob([JSON.stringify(Array(15).fill(snapshot))]).size).toBeLessThan(2_500_000);
  });
});
