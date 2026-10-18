import { describe, expect, it } from 'vitest';
import ranked from '../fixtures/ranked.json';
import turbo from '../fixtures/turbo.json';
import zeroKill from '../fixtures/zero-kill.json';
import abandon from '../fixtures/abandon.json';
import { normalizeMatch } from '../../src/domain/normalize-match.js';
import { calculateRuinScore } from '../../src/domain/ruin-score.js';
import { calculateImpactScore } from '../../src/domain/impact-score.js';

function context(raw, index = 0, role = { position: 'safe-core', certainty: 'medium', evidence: [] }) {
  const match = normalizeMatch(structuredClone(raw)).match;
  const player = match.players[index];
  return { player, team: match.players.filter((item) => item.team === player.team), match, role };
}

describe('versioned scoring', () => {
  it('is deterministic, bounded, and independently models ruin and impact', () => {
    const input = context(ranked, 0);
    const ruin = calculateRuinScore(input);
    const repeat = calculateRuinScore(input);
    const impact = calculateImpactScore(input);
    expect(ruin).toEqual(repeat);
    expect(ruin.modelVersion).toBe('ruin-v2.0.0');
    expect(impact.modelVersion).toBe('impact-v2.0.0');
    expect(ruin.score).toBeGreaterThanOrEqual(0);
    expect(ruin.score).toBeLessThanOrEqual(100);
    expect(impact.score).toBeGreaterThanOrEqual(0);
    expect(impact.score).toBeLessThanOrEqual(100);
    expect(impact.score).not.toBe(100 - ruin.score);
  });

  it('does not treat zero team kills as zero participation', () => {
    const result = calculateRuinScore(context(zeroKill));
    expect(result.components.find((part) => part.id === 'participation')).toMatchObject({ available: false, points: 0 });
  });

  it('does not penalize missing ward data and counts abandon once', () => {
    const missingContext = context(ranked, 4, { position: 'hard-support', certainty: 'high', evidence: [] });
    missingContext.player.obsPlaced = null;
    missingContext.player.senPlaced = null;
    missingContext.player.campsStacked = null;
    const missing = calculateRuinScore(missingContext);
    const left = calculateRuinScore(context(abandon, 0));
    expect(missing.components.find((part) => part.id === 'role-duties').available).toBe(false);
    expect(left.flags).toEqual(['abandon']);
    expect(left.components.filter((part) => part.id === 'abandon')).toHaveLength(1);
  });

  it('uses a dedicated turbo benchmark profile', () => {
    expect(calculateRuinScore(context(turbo)).profile).toBe('turbo');
    expect(calculateRuinScore(context(ranked)).profile).toBe('standard');
  });
});
