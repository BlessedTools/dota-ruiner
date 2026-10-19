import { describe, expect, it } from 'vitest';
import ranked from '../fixtures/ranked.json';
import partial from '../fixtures/partial.json';
import turbo from '../fixtures/turbo.json';
import unparsedRich from '../fixtures/unparsed-rich.json';
import { normalizeMatch } from '../../src/domain/normalize-match.js';

const clone = (value) => structuredClone(value);

describe('normalizeMatch', () => {
  it('normalizes a parsed ranked match without changing observed values', () => {
    const result = normalizeMatch(clone(ranked));
    expect(result.ok).toBe(true);
    expect(result.match.mode).toBe('ranked');
    expect(result.match.players).toHaveLength(10);
    expect(result.match.players[0]).toMatchObject({ gpm: 600, xpm: 700, personaname: 'Carry', team: 'radiant' });
    expect(result.match.players[0].gold_t).toEqual([0, 600, 1300]);
  });

  it('preserves OpenDota net worth, benchmark percentiles, position estimate and death events', () => {
    const raw = clone(ranked);
    Object.assign(raw.players[0], {
      position_est: 1,
      networth_t: [600, 1094, 1524],
      teamfight_participation: 0.6,
      deaths_log: [{ time: 1900, gold_fed: 640, gold_lost: 320, time_dead: 72 }],
      benchmarks: {
        gold_per_min: { raw: 600, pct: 0.82 },
        deaths_per_min: { raw: 0.05, pct: 0.18 },
        hero_damage_per_min: { raw: 625, pct: 0.71 },
      },
    });
    const player = normalizeMatch(raw).match.players[0];
    expect(player).toMatchObject({ positionEstimate: 1, teamfightParticipation: 0.6 });
    expect(player.networth_t).toEqual([600, 1094, 1524]);
    expect(player.deathsLog).toEqual([{ time: 1900, goldFed: 640, goldLost: 320, timeDead: 72 }]);
    expect(player.benchmarks).toEqual({
      gold_per_min: { raw: 600, percentile: 0.82 },
      deaths_per_min: { raw: 0.05, percentile: 0.18 },
      hero_damage_per_min: { raw: 625, percentile: 0.71 },
    });
  });

  it('normalizes rich match metadata, equipment, support metrics and bounded parsed logs', () => {
    const raw = clone(ranked);
    Object.assign(raw, {
      region: 8,
      cluster: 274,
      skill: 3,
      avg_rank_tier: 64,
      radiant_gold_adv: [0, 120, null, Number.POSITIVE_INFINITY],
      radiant_xp_adv: [0, 80, -40],
      objectives: [{ time: 600, type: 'CHAT_MESSAGE_TOWER_KILL', slot: 1, key: 'npc_dota_badguys_tower1_mid', ignored: '<unsafe>' }],
      teamfights: [{ start: 720, end: 755, last_death: 750, players: [{ deaths: 1, damage: 2100 }] }],
    });
    Object.assign(raw.players[0], {
      account_id: 42,
      kda: 9,
      gold_spent: 18100,
      denies: 21,
      hero_healing: 320,
      stuns: 14.5,
      camps_stacked: 3,
      item_0: 1,
      item_1: 2,
      backpack_0: 3,
      item_neutral: 4,
      aghanims_scepter: 1,
      aghanims_shard: 0,
      kills_log: [{ time: 500, key: 'npc_dota_hero_axe' }],
      buyback_log: [{ time: 1200, slot: 0, player_slot: 0 }],
      purchase_log: [{ time: 100, key: 'boots' }],
      obs_log: [{ time: 220, type: 'obs_log', x: 120, y: 88 }],
      sen_log: [{ time: 260, type: 'sen_log', x: 121, y: 89 }],
      runes_log: [{ time: 0, key: 5 }],
    });

    const match = normalizeMatch(raw).match;
    const player = match.players[0];
    expect(match).toMatchObject({ region: 8, cluster: 274, skill: 3, avgRankTier: 64 });
    expect(match.radiantGoldAdv).toEqual([0, 120, null, null]);
    expect(match.radiantXpAdv).toEqual([0, 80, -40]);
    expect(match.objectives[0]).toEqual({ time: 600, type: 'CHAT_MESSAGE_TOWER_KILL', slot: 1, key: 'npc_dota_badguys_tower1_mid' });
    expect(match.teamfights[0]).toMatchObject({ start: 720, end: 755, lastDeath: 750 });
    expect(player).toMatchObject({ accountId: 42, kda: 9, goldSpent: 18100, denies: 21, heroHealing: 320, stuns: 14.5, campsStacked: 3 });
    expect(player.itemSlots).toEqual([1, 2, null, null, null, null]);
    expect(player.backpack).toEqual([3, null, null]);
    expect(player.neutralItem).toBe(4);
    expect(player.aghanimsScepter).toBe(true);
    expect(player.aghanimsShard).toBe(false);
    expect(player.killsLog[0]).toEqual({ time: 500, key: 'npc_dota_hero_axe' });
    expect(player.buybackLog[0]).toEqual({ time: 1200, slot: 0, playerSlot: 0 });
    expect(player.purchaseLog[0]).toEqual({ time: 100, key: 'boots' });
    expect(player.obsLog[0]).toEqual({ time: 220, type: 'obs_log', x: 120, y: 88 });
    expect(player.runesLog[0]).toEqual({ time: 0, key: 5 });
  });

  it('caps player timelines and logs and keeps an unparsed match free of invented parsed data', () => {
    const raw = clone(ranked);
    raw.duration = 600;
    raw.players[0].gold_t = Array.from({ length: 300 }, (_, index) => index);
    raw.players[0].kills_log = Array.from({ length: 300 }, (_, index) => ({ time: index, key: `hero_${index}` }));
    const capped = normalizeMatch(raw).match.players[0];
    expect(capped.gold_t).toHaveLength(12);
    expect(capped.killsLog).toHaveLength(256);

    const unparsed = normalizeMatch(clone(unparsedRich)).match;
    expect(unparsed.parsed).toBe(false);
    expect(unparsed.players[0].netWorth).toBe(14321);
    expect(unparsed.players[0].networth_t).toBeNull();
    expect(unparsed.radiantGoldAdv).toBeNull();
    expect(unparsed.teamfights).toEqual([]);
  });

  it('keeps unavailable metrics null and preserves timeline gaps', () => {
    const result = normalizeMatch(clone(partial));
    expect(result.ok).toBe(true);
    expect(result.match.players[0].gpm).toBeNull();
    expect(result.match.players[0].heroDamage).toBeNull();
    expect(result.match.players[0].gold_t).toEqual([0, null, 900]);
    expect(result.warnings).toContain('unknown-hero');
    expect(result.warnings).toContain('partial-match-data');
  });

  it('identifies turbo independently from lobby type', () => {
    expect(normalizeMatch(clone(turbo)).match.mode).toBe('turbo');
  });

  it('uses a conservative generic profile and warning for unsupported custom modes', () => {
    const custom = clone(ranked);
    custom.game_mode = 99;
    custom.lobby_type = 0;
    const result = normalizeMatch(custom);
    expect(result.match.mode).toBe('generic');
    expect(result.warnings).toContain('unsupported-mode');
  });

  it.each([9, 11])('accepts a separated %i-player match with a composition warning', (count) => {
    const raw = clone(ranked);
    raw.players = count === 9 ? raw.players.slice(0, 9) : [...raw.players, { ...raw.players[0], player_slot: 5, hero_id: 11 }];
    const result = normalizeMatch(raw);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('unusual-player-count');
  });

  it('returns controlled errors for too-short and unusable matches', () => {
    const short = normalizeMatch({ ...clone(turbo), duration: 299 });
    const empty = normalizeMatch({ match_id: 1, duration: 900, players: [] });
    expect(short).toMatchObject({ ok: false, errors: ['match-too-short'] });
    expect(empty.ok).toBe(false);
    expect(empty.errors).toContain('not-enough-players');
  });
});
