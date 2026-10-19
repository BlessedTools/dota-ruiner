import { describe, expect, it } from 'vitest';
import ranked from '../fixtures/ranked.json';
import zeroKill from '../fixtures/zero-kill.json';
import { normalizeMatch } from '../../src/domain/normalize-match.js';
import { buildTeamSummaries, compareTeams } from '../../src/domain/team-summary.js';

const normalized = (raw) => normalizeMatch(structuredClone(raw)).match;

describe('team summaries', () => {
  it('aggregates observed team totals, averages and coverage without turning null into zero', () => {
    const [radiant, dire] = buildTeamSummaries(normalized(ranked));
    expect(radiant).toMatchObject({
      id: 'radiant',
      playerCount: 5,
      totals: {
        kills: 18, deaths: 20, assists: 74, netWorth: 77000, gpm: 2030, xpm: 2540,
        heroDamage: 78000, towerDamage: 6400, heroHealing: null, lastHits: 795, denies: null,
      },
      averages: { gpm: 406, xpm: 508, netWorth: 15400 },
    });
    expect(radiant.observed.heroHealing).toBe(0);
    expect(radiant.observed.denies).toBe(0);
    expect(dire.totals).toMatchObject({ kills: 17, deaths: 33, assists: 48, netWorth: 71300, gpm: 1980, xpm: 2440, heroDamage: 78000, towerDamage: 4450, lastHits: 800 });
  });

  it('compares only fully observed non-zero metrics with finite deltas and ratios', () => {
    const comparisons = compareTeams(buildTeamSummaries(normalized(ranked)));
    const netWorth = comparisons.find((item) => item.metric === 'netWorth');
    const healing = comparisons.find((item) => item.metric === 'heroHealing');
    expect(netWorth).toMatchObject({ radiant: 77000, dire: 71300, leader: 'radiant', delta: 5700, complete: true });
    expect(netWorth.ratio).toBeCloseTo(77000 / 71300);
    expect(healing).toMatchObject({ radiant: null, dire: null, leader: null, delta: null, ratio: null, complete: false });
  });

  it('keeps zero kills, partial values and a 4v5 composition finite and explicitly incomplete', () => {
    const zeroComparisons = compareTeams(buildTeamSummaries(normalized(zeroKill)));
    const kills = zeroComparisons.find((item) => item.metric === 'kills');
    expect(kills.ratio).toBeNull();
    expect(kills.delta).not.toBeNaN();

    const raw = structuredClone(ranked);
    raw.players = raw.players.slice(1);
    delete raw.players[0].hero_damage;
    const summaries = buildTeamSummaries(normalized(raw));
    const comparisons = compareTeams(summaries);
    const damage = comparisons.find((item) => item.metric === 'heroDamage');
    expect(summaries[0].playerCount).toBe(4);
    expect(damage.complete).toBe(false);
    expect(damage.ratio).toBeNull();
    expect(JSON.stringify({ summaries, comparisons })).not.toMatch(/NaN|Infinity/);
  });
});
