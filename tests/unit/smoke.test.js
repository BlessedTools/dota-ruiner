import { describe, expect, it } from 'vitest';
import { MODEL_VERSIONS } from '../../src/data/scoring-config.js';
import ranked from '../fixtures/ranked.json';
import { normalizeMatch } from '../../src/domain/normalize-match.js';
import { buildAnalysis } from '../../src/domain/analysis.js';

describe('model version contract', () => {
  it('publishes independently versioned ruin and impact models', () => {
    expect(MODEL_VERSIONS).toEqual({
      ruin: 'ruin-v4.0.0',
      impact: 'impact-v4.0.0',
    });
  });
});

describe('analysis view model', () => {
  it('composes metadata, availability, summaries, comparisons, narrative, scores, insights and item assets', () => {
    const raw = structuredClone(ranked);
    raw.players[0].item_0 = 1;
    raw.region = 8;
    const match = normalizeMatch(raw).match;
    const constants = {
      heroes: new Map([[1, { id: 1, name: 'Anti-Mage', roles: ['Carry'], image: 'https://cdn.cloudflare.steamstatic.com/hero.png' }]]),
      items: new Map([[1, { id: 1, name: 'Blink Dagger', image: 'https://cdn.cloudflare.steamstatic.com/blink.png' }]]),
      gameModes: new Map([[22, 'All Draft']]),
      lobbies: new Map([[7, 'Ranked']]),
      regions: new Map([[8, 'Europe']]),
      patches: new Map([[61, '7.40']]),
    };
    const analysis = buildAnalysis(match, constants, 'ru', ['unparsed-or-partial']);
    expect(analysis.metadata).toMatchObject({ mode: 'All Draft', lobby: 'Ranked', region: 'Europe', patch: '7.40' });
    expect(analysis.availability.categories.summary.status).toBe('available');
    expect(analysis.summaries).toHaveLength(2);
    expect(analysis.comparisons.some((item) => item.metric === 'heroDamage')).toBe(true);
    expect(analysis.narrative.lead).toContain('Radiant');
    expect(analysis.leaders.ruin).not.toBeNull();
    expect(analysis.leaders.impact).not.toBeNull();
    expect(analysis.teams.flatMap((team) => team.players)).toHaveLength(10);
    expect(analysis.teams[0].players[0].items[0]).toMatchObject({ id: 1, name: 'Blink Dagger' });
    expect(Array.isArray(analysis.teams[0].players[0].insights)).toBe(true);
    expect(analysis.modelVersions).toEqual(MODEL_VERSIONS);
    expect(analysis.warnings).toContain('unparsed-or-partial');
  });
});
