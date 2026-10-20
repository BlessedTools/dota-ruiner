import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTimeline } from '../../src/domain/timeline.js';
import { normalizeMatch } from '../../src/domain/normalize-match.js';

const observed = {
  parsed: true,
  duration: 2400,
  radiantGoldAdv: [0, 120, -80],
  radiantXpAdv: [0, 60, 140],
  objectives: [{ time: 600, type: 'CHAT_MESSAGE_TOWER_KILL', slot: 1, key: 'npc_dota_badguys_tower1_mid' }],
  teamfights: [{ start: 720, end: 755, lastDeath: 750, players: [] }],
  players: [
    { slot: 0, team: 'radiant', heroId: 1, networth_t: [600, 900, 1300], gold_t: [0, 300, 700], xp_t: [0, 250, 620], heroDamage_t: null, deathsLog: [{ time: 500, goldFed: 200 }], buybackLog: [] },
    { slot: 1, team: 'radiant', heroId: 2, networth_t: [600, 850, 1200], gold_t: [0, 250, 600], xp_t: [0, 200, 500], heroDamage_t: null, deathsLog: [], buybackLog: [{ time: 1200, slot: 1 }] },
    { slot: 128, team: 'dire', heroId: 3, networth_t: [600, 1100, 1500], gold_t: [0, 500, 900], xp_t: [0, 390, 800], heroDamage_t: null, deathsLog: [], buybackLog: [] },
  ],
};

describe('observed match timeline', () => {
  it('sums every observed player net worth into team totals without interpolation', () => {
    const timeline = buildTimeline(observed);
    const networth = timeline.metrics.find((metric) => metric.key === 'networth');
    expect(networth.source).toBe('OpenDota · players[].networth_t');
    expect(networth.teams.radiant).toEqual([
      { minute: 0, value: 1200, observedPlayers: 2 },
      { minute: 1, value: 1750, observedPlayers: 2 },
      { minute: 2, value: 2500, observedPlayers: 2 },
    ]);
    expect(networth.teams.dire[2]).toEqual({ minute: 2, value: 1500, observedPlayers: 1 });
  });

  it('retains the exact OpenDota source for supplied advantage series', () => {
    const timeline = buildTimeline(observed);
    expect(timeline.advantages.gold).toMatchObject({ source: 'OpenDota · radiant_gold_adv' });
    expect(timeline.advantages.gold.points[2]).toEqual({ minute: 2, value: -80 });
    expect(timeline.advantages.xp.source).toBe('OpenDota · radiant_xp_adv');
  });

  it('includes only observed deaths, buybacks, objectives, and teamfights', () => {
    const timeline = buildTimeline(observed);
    expect(timeline.events.map((event) => event.type)).toEqual(['death', 'objective', 'teamfight', 'buyback']);
    expect(timeline.events[0]).toMatchObject({ time: 500, slot: 0, source: 'OpenDota · players[].deaths_log' });
    expect(timeline.events[1]).toMatchObject({ time: 600, source: 'OpenDota · objectives' });
  });

  it('returns no synthetic metric or event for an unparsed match', () => {
    const raw = JSON.parse(readFileSync(new URL('../fixtures/unparsed-rich.json', import.meta.url), 'utf8'));
    const normalized = normalizeMatch(raw);
    const timeline = buildTimeline(normalized.match);
    expect(timeline.metrics).toEqual([]);
    expect(timeline.events).toEqual([]);
    expect(JSON.stringify(timeline)).not.toMatch(/gpm|approx|estimated/i);
  });
});
