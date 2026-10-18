import { describe, expect, it } from 'vitest';
import { DEMO_MATCH, createDemoAnalysisInput } from '../../src/data/demo-match.js';

describe('demo match isolation', () => {
  it('always creates visibly separate immutable demo data', () => {
    const first = createDemoAnalysisInput('9999999999');
    const second = createDemoAnalysisInput();
    expect(first.source).toBe('demo');
    expect(first.match_id).toBe(DEMO_MATCH.match_id);
    expect(first.match_id).not.toBe(9999999999);
    first.players[0].kills = 999;
    expect(second.players[0].kills).not.toBe(999);
    expect(Object.isFrozen(DEMO_MATCH)).toBe(true);
  });
});
