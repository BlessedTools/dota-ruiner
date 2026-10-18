import { describe, expect, it } from 'vitest';
import { assessConclusionQuality } from '../../src/domain/confidence.js';

describe('conclusion quality', () => {
  it('suppresses verdicts below 50% coverage', () => {
    expect(assessConclusionQuality({ dataCoverage: 49, roleCertainty: 'high', leadGap: 40 })).toEqual({ quality: 'insufficient', showVerdict: false, ambiguous: false });
  });

  it('uses categorical quality and reports close leaders as ambiguous', () => {
    expect(assessConclusionQuality({ dataCoverage: 92, roleCertainty: 'high', leadGap: 2 })).toEqual({ quality: 'medium', showVerdict: true, ambiguous: true });
    expect(assessConclusionQuality({ dataCoverage: 90, roleCertainty: 'high', leadGap: 14 }).quality).toBe('high');
  });
});
