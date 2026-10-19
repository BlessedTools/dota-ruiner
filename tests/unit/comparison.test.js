import { describe, expect, it } from 'vitest';
import { compareAnalyses } from '../../src/ui/comparison.js';

const entry = (id, version) => ({ matchId: id, duration: 1800 + id, mode: 'ranked', dataCoverage: 80, modelVersions: { ruin: version, impact: 'impact-v2.0.0' }, leaders: { ruin: { heroName: 'Axe', score: 60 }, impact: { heroName: 'Bane', score: 70 } }, teams: [] });

describe('compareAnalyses', () => {
  it('compares same-major models and marks different majors non-comparable', () => {
    expect(compareAnalyses(entry(1, 'ruin-v2.0.0'), entry(2, 'ruin-v2.2.0')).comparable).toBe(true);
    expect(compareAnalyses(entry(1, 'ruin-v2.0.0'), entry(2, 'ruin-v3.0.0'))).toMatchObject({ comparable: false, reason: 'model-major-mismatch' });
  });

  it('returns explicit duration and coverage deltas', () => {
    const result = compareAnalyses(entry(1, 'ruin-v2.0.0'), { ...entry(2, 'ruin-v2.0.0'), dataCoverage: 70 });
    expect(result.deltas).toMatchObject({ duration: 1, dataCoverage: -10 });
  });
});
