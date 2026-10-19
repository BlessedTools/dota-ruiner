import { describe, expect, it } from 'vitest';
import { buildMatchNarrative } from '../../src/domain/narrative.js';

describe('buildMatchNarrative', () => {
  it('writes a compact Russian account from exact observed comparisons and leaders', () => {
    const narrative = buildMatchNarrative({
      match: { radiantWin: false, radiantScore: 18, direScore: 33 },
      comparisons: [
        { metric: 'heroDamage', radiant: 50000, dire: 71000, leader: 'dire', delta: 21000, ratio: 1.42, complete: true },
        { metric: 'towerDamage', radiant: 4000, dire: 6000, leader: 'dire', delta: 2000, ratio: 1.5, complete: true },
        { metric: 'heroHealing', radiant: null, dire: null, leader: null, delta: null, ratio: null, complete: false },
      ],
      availability: {
        categories: {
          economyTimeline: { status: 'missing', reason: 'economy-timeline-missing' },
          teamfights: { status: 'missing', reason: 'teamfights-missing' },
        },
      },
      ruinLeader: { name: 'Razor player', heroName: 'Razor', insights: [{ id: 'survival-low', evidence: { deaths: 9, percentile: 12 } }] },
      impactLeader: { name: 'Anti-Mage player', heroName: 'Anti-Mage', insights: [{ id: 'economy-high', evidence: { gpm: 815, percentile: 98 } }] },
    }, 'ru');

    expect(narrative.lead).toBe('Dire победили со счётом 33:18.');
    expect(narrative.paragraphs.join(' ')).toContain('на 42% больше урона героям');
    expect(narrative.paragraphs.join(' ')).toContain('Razor player');
    expect(narrative.paragraphs.join(' ')).toContain('9 смертей');
    expect(narrative.paragraphs.join(' ')).toContain('815 GPM');
    expect(narrative.limitations).toEqual(expect.arrayContaining([
      'OpenDota не предоставил поминутную экономику.',
      'OpenDota не предоставил разбор командных драк.',
    ]));
    expect(`${narrative.lead} ${narrative.paragraphs.join(' ')} ${narrative.limitations.join(' ')}`).not.toMatch(/афк|тильт|специально|уверенн\w*\s+\d+%/i);
  });

  it('stays finite and restrained with partial or null inputs', () => {
    const narrative = buildMatchNarrative({
      match: { radiantWin: null, radiantScore: null, direScore: null },
      comparisons: [{ metric: 'kills', radiant: 0, dire: 0, leader: null, delta: 0, ratio: null, complete: true }],
      availability: { categories: { objectives: { status: 'partial', reason: 'objectives-partial' } } },
      ruinLeader: null,
      impactLeader: null,
    }, 'ru');
    expect(JSON.stringify(narrative)).not.toMatch(/NaN|Infinity/);
    expect(narrative.paragraphs).toHaveLength(0);
    expect(narrative.limitations).toHaveLength(1);
  });

  it('limits the match story to three observed comparisons', () => {
    const comparisons = ['kills', 'netWorth', 'heroDamage', 'towerDamage'].map((metric, index) => ({
      metric, radiant: 100, dire: 100 + index + 1, leader: 'dire', delta: index + 1, ratio: 1.1, complete: true,
    }));
    const narrative = buildMatchNarrative({ match: {}, comparisons, availability: { categories: {} } }, 'en');
    expect(narrative.paragraphs.filter((paragraph) => paragraph.startsWith('Dire recorded'))).toHaveLength(3);
  });
});
