import { describe, expect, it } from 'vitest';
import { buildRecommendations } from '../../src/domain/recommendations.js';

describe('buildRecommendations', () => {
  it('builds evidence-backed weaknesses and strengths only from available components', () => {
    const result = buildRecommendations({ components: [
      { id: 'deaths', available: true, points: 20, maxPoints: 25, source: 'opendota.benchmarks.deaths_per_min', evidence: [{ deaths: 10 }] },
      { id: 'damage', available: true, points: 1, maxPoints: 20, source: 'opendota.benchmarks.hero_damage_per_min', evidence: [{ dpm: 700 }] },
      { id: 'vision', available: false, points: 0, maxPoints: 10, evidence: [] },
    ] });
    expect(result.weaknesses.map((item) => item.id)).toEqual(['deaths']);
    expect(result.strengths.map((item) => item.id)).toEqual(['damage']);
    expect(result.weaknesses.concat(result.strengths).some((item) => item.id === 'vision')).toBe(false);
  });
});
