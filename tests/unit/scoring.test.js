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
    input.player.benchmarks = {
      gold_per_min: { raw: 600, percentile: 0.76 },
      xp_per_min: { raw: 700, percentile: 0.7 },
      last_hits_per_min: { raw: 8, percentile: 0.8 },
      hero_damage_per_min: { raw: 625, percentile: 0.61 },
      deaths_per_min: { raw: 0.05, percentile: 0.17 },
      tower_damage: { raw: 4000, percentile: 0.65 },
    };
    const ruin = calculateRuinScore(input);
    const repeat = calculateRuinScore(input);
    const impact = calculateImpactScore(input);
    expect(ruin).toEqual(repeat);
    expect(ruin.modelVersion).toBe('ruin-v4.0.0');
    expect(impact.modelVersion).toBe('impact-v4.0.0');
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
    const custom = structuredClone(ranked);
    custom.game_mode = 99;
    custom.lobby_type = 0;
    expect(calculateRuinScore(context(custom)).profile).toBe('generic');
  });

  it('uses observed OpenDota percentiles instead of hardcoded economy and damage thresholds', () => {
    const strong = context(ranked, 0);
    strong.player.benchmarks = {
      gold_per_min: { raw: 600, percentile: 0.9 },
      last_hits_per_min: { raw: 8, percentile: 0.85 },
      hero_damage_per_min: { raw: 625, percentile: 0.8 },
      deaths_per_min: { raw: 0.05, percentile: 0.9 },
      tower_damage: { raw: 4000, percentile: 0.8 },
    };
    strong.player.teamfightParticipation = 0.6;
    const weak = structuredClone(strong);
    weak.player.benchmarks.gold_per_min.percentile = 0.1;
    weak.player.benchmarks.last_hits_per_min.percentile = 0.15;
    weak.player.benchmarks.hero_damage_per_min.percentile = 0.2;
    weak.player.benchmarks.deaths_per_min.percentile = 0.1;
    weak.player.benchmarks.tower_damage.percentile = 0.1;
    weak.player.teamfightParticipation = 0.2;

    expect(calculateRuinScore(weak).score).toBeGreaterThan(calculateRuinScore(strong).score);
    expect(calculateImpactScore(strong).score).toBeGreaterThan(calculateImpactScore(weak).score);
    expect(calculateRuinScore(strong).components.find((part) => part.id === 'economy').source).toBe('opendota.benchmarks.economy');
  });

  it('marks percentile-dependent factors unavailable when OpenDota did not provide benchmarks', () => {
    const input = context(ranked, 0);
    input.player.benchmarks = null;
    const ruin = calculateRuinScore(input);
    expect(ruin.components.find((part) => part.id === 'economy')).toMatchObject({ available: false, points: 0 });
    expect(ruin.components.find((part) => part.id === 'damage')).toMatchObject({ available: false, points: 0 });
  });

  it('treats OpenDota death percentile as quality-oriented', () => {
    const lowDeaths = context(ranked, 0);
    const highDeaths = structuredClone(lowDeaths);
    lowDeaths.player.benchmarks = { deaths_per_min: { raw: 0.06, percentile: 0.98 } };
    highDeaths.player.benchmarks = { deaths_per_min: { raw: 0.5, percentile: 0.04 } };
    expect(calculateRuinScore(lowDeaths).components.find((part) => part.id === 'deaths').points)
      .toBeLessThan(calculateRuinScore(highDeaths).components.find((part) => part.id === 'deaths').points);
    expect(calculateImpactScore(lowDeaths).components.find((part) => part.id === 'survival').points)
      .toBeGreaterThan(calculateImpactScore(highDeaths).components.find((part) => part.id === 'survival').points);
  });

  it('exposes structured evidence and stable source identifiers for every component', () => {
    const input = context(ranked, 0);
    const result = calculateRuinScore(input);
    for (const part of result.components) {
      expect(part.source).toEqual(expect.any(String));
      expect(Array.isArray(part.evidence)).toBe(true);
      expect(part.evidence.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))).toBe(true);
    }
    expect(result.components.find((part) => part.id === 'deaths').evidence[0]).toEqual(expect.objectContaining({ deaths: 2, percentile: 0.88 }));
    expect(calculateImpactScore(input).components.find((part) => part.id === 'economy').evidence[0]).toEqual(expect.objectContaining({ gpm: 600, xpm: 700 }));
  });

  it('does not apply role duties when the inferred role is uncertain', () => {
    const input = context(ranked, 4, { position: 'hard-support', certainty: 'low', evidence: [] });
    expect(calculateRuinScore(input).components.find((part) => part.id === 'role-duties').available).toBe(false);
    expect(calculateImpactScore(input).components.find((part) => part.id === 'role-duties').available).toBe(false);
  });

  it('does not let narrative-only insights change either score', () => {
    const input = context(ranked, 0);
    const ruin = calculateRuinScore(input);
    const impact = calculateImpactScore(input);
    expect(calculateRuinScore({ ...input, insights: [{ id: 'arbitrary', tone: 'negative' }] })).toEqual(ruin);
    expect(calculateImpactScore({ ...input, insights: [{ id: 'arbitrary', tone: 'positive' }] })).toEqual(impact);
  });
});
