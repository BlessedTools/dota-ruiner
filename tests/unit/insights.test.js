import { describe, expect, it } from 'vitest';
import { buildPlayerInsights, INSIGHT_THRESHOLDS } from '../../src/domain/insights.js';

const benchmark = (percentile, raw = percentile) => ({ percentile, raw });

describe('buildPlayerInsights', () => {
  it('emits structured observed insights for economy, combat, survival, objectives, healing, vision, throw and abandon', () => {
    const player = {
      gpm: 275,
      deaths: 9,
      heroDamage: 12000,
      towerDamage: 0,
      heroHealing: 3400,
      obsPlaced: 12,
      senPlaced: 8,
      campsStacked: 4,
      leaverStatus: 2,
      benchmarks: {
        gold_per_min: benchmark(0.18, 275),
        last_hits_per_min: benchmark(0.2, 2.4),
        hero_damage_per_min: benchmark(0.22, 340),
        deaths_per_min: benchmark(0.12, 0.25),
        tower_damage: benchmark(0.05, 0),
        hero_healing_per_min: benchmark(0.91, 96),
      },
    };
    const ruin = { components: [{ id: 'throw', available: true, points: 10, maxPoints: 15, evidence: [{ lateDeaths: 2, observedLeadDeaths: 1 }] }] };
    const insights = buildPlayerInsights({ player, role: { position: 'hard-support' }, ruin });
    const ids = insights.map((insight) => insight.id);
    expect(ids).toEqual(expect.arrayContaining([
      'economy-low', 'combat-low', 'survival-low', 'objectives-low',
      'healing-high', 'vision-observed', 'late-throw-observed', 'abandon-confirmed',
    ]));
    for (const insight of insights) {
      expect(insight).toEqual(expect.objectContaining({
        id: expect.any(String),
        tone: expect.stringMatching(/^(positive|negative|neutral)$/),
        metric: expect.any(String),
        evidence: expect.any(Object),
        availability: 'observed',
      }));
    }
    expect(INSIGHT_THRESHOLDS).toEqual(expect.objectContaining({ lowPercentile: 0.25, highPercentile: 0.75 }));
  });

  it('emits strong percentile facts and omits categories whose required fields are missing', () => {
    const insights = buildPlayerInsights({
      player: {
        gpm: 815,
        heroDamage: 25801,
        deaths: 1,
        towerDamage: 13552,
        benchmarks: {
          gold_per_min: benchmark(0.98, 815),
          hero_damage_per_min: benchmark(0.81, 805),
          deaths_per_min: benchmark(0.96, 0.03),
          tower_damage: benchmark(0.99, 13552),
        },
      },
      role: { position: 'safe-core' },
      ruin: { components: [] },
    });
    expect(insights.map((item) => item.id)).toEqual(expect.arrayContaining(['economy-high', 'combat-high', 'survival-high', 'objectives-high']));
    expect(insights.some((item) => item.metric === 'vision')).toBe(false);
    expect(insights.some((item) => item.metric === 'healing')).toBe(false);
  });

  it('does not turn missing or non-finite values into claims', () => {
    const insights = buildPlayerInsights({ player: { gpm: null, heroDamage: Number.NaN, benchmarks: null }, role: null, ruin: null });
    expect(insights).toEqual([]);
  });
});
