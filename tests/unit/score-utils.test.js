import { describe, expect, it } from 'vitest';
import { normalizeScore } from '../../src/domain/score-utils.js';

describe('normalizeScore', () => {
  it('renormalizes only available bounded components without mutation', () => {
    const components = [
      { id: 'a', points: 10, maxPoints: 20, available: true },
      { id: 'b', points: 99, maxPoints: 30, available: false },
      { id: 'c', points: 80, maxPoints: 50, available: true },
    ];
    const before = structuredClone(components);
    expect(normalizeScore(components)).toEqual({ score: 86, dataCoverage: 70 });
    expect(components).toEqual(before);
  });

  it('returns no score when no weighted evidence is available', () => {
    expect(normalizeScore([{ id: 'x', points: 0, maxPoints: 0, available: true }])).toEqual({ score: null, dataCoverage: 0 });
  });
});
