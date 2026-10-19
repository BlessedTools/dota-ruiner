import { describe, expect, it } from 'vitest';
import { MODEL_VERSIONS } from '../../src/data/scoring-config.js';

describe('model version contract', () => {
  it('publishes independently versioned ruin and impact models', () => {
    expect(MODEL_VERSIONS).toEqual({
      ruin: 'ruin-v2.0.0',
      impact: 'impact-v2.0.0',
    });
  });
});
