import { describe, expect, it } from 'vitest';
import ranked from '../fixtures/ranked.json';
import unparsedRich from '../fixtures/unparsed-rich.json';
import zeroKill from '../fixtures/zero-kill.json';
import { normalizeMatch } from '../../src/domain/normalize-match.js';
import { buildDataAvailability } from '../../src/domain/data-availability.js';

const normalized = (raw) => normalizeMatch(structuredClone(raw)).match;

describe('buildDataAvailability', () => {
  it('describes each category for a benchmark match with real economy timelines', () => {
    const availability = buildDataAvailability(normalized(ranked));
    expect(availability.overall).toBe('partial');
    expect(availability.categories).toMatchObject({
      summary: { status: 'available', reason: 'summary-observed' },
      benchmarks: { status: 'available', reason: 'benchmarks-all-players' },
      economyTimeline: { status: 'available', reason: 'networth-all-players' },
      combatTimeline: { status: 'missing', reason: 'combat-timeline-missing' },
      teamfights: { status: 'missing', reason: 'teamfights-missing' },
      objectives: { status: 'missing', reason: 'objectives-missing' },
      support: { status: 'partial', reason: 'support-some-players' },
      purchases: { status: 'missing', reason: 'purchases-missing' },
    });
  });

  it('keeps an unparsed match useful without claiming parsed categories', () => {
    const availability = buildDataAvailability(normalized(unparsedRich));
    expect(availability.overall).toBe('basic');
    expect(availability.categories.summary.status).toBe('available');
    expect(availability.categories.benchmarks.status).toBe('available');
    expect(availability.categories.economyTimeline.status).toBe('missing');
    expect(availability.categories.teamfights.status).toBe('missing');
    expect(availability.categories.objectives.status).toBe('missing');
  });

  it('marks mixed-player benchmark and timeline coverage as partial', () => {
    const raw = structuredClone(ranked);
    delete raw.players[0].benchmarks;
    delete raw.players[0].networth_t;
    const availability = buildDataAvailability(normalized(raw));
    expect(availability.categories.benchmarks).toEqual({ status: 'partial', reason: 'benchmarks-some-players', observed: 9, total: 10 });
    expect(availability.categories.economyTimeline).toEqual({ status: 'partial', reason: 'networth-some-players', observed: 9, total: 10 });
  });

  it('does not confuse zero kills or unusual player count with missing summary data', () => {
    const zero = buildDataAvailability(normalized(zeroKill));
    expect(zero.categories.summary.status).toBe('available');

    const unusualRaw = structuredClone(ranked);
    unusualRaw.players = unusualRaw.players.slice(0, 9);
    const unusual = buildDataAvailability(normalized(unusualRaw));
    expect(unusual.categories.summary.status).toBe('available');
    expect(unusual.categories.summary.reason).toBe('summary-observed');
  });
});
