import { describe, expect, it } from 'vitest';
import { buildChartSeries, buildTooltipText, getAvailableChartMetrics } from '../../src/ui/chart.js';

const match = {
  players: [
    { slot: 0, heroId: 1, gold_t: [0, 100, null, 400], xp_t: [0, 80, 180], heroDamage_t: null, heroDamage: 9000 },
    { slot: 128, heroId: 2, gold_t: [0, 90, 210], xp_t: [0, 100, 240, 500], heroDamage_t: null, heroDamage: 12000 },
  ],
};

describe('observed chart series', () => {
  it('offers only metrics backed by real time-series arrays', () => {
    expect(getAvailableChartMetrics(match)).toEqual(['gold', 'xp']);
  });

  it('clips to the shared range and preserves observed gaps', () => {
    const series = buildChartSeries(match, 'gold');
    expect(series).toHaveLength(2);
    expect(series[0].points).toEqual([{ minute: 0, value: 0 }, { minute: 1, value: 100 }, { minute: 2, value: null }]);
    expect(series[1].points).toHaveLength(3);
  });

  it('never turns final hero damage into a timeline', () => {
    expect(buildChartSeries(match, 'heroDamage')).toEqual([]);
  });

  it('builds a tooltip only from observed values at the selected minute', () => {
    const series = buildChartSeries(match, 'gold');
    expect(buildTooltipText(series, 1, (id) => `Hero ${id}`)).toBe('1 min · Hero 1: 100 · Hero 2: 90');
    expect(buildTooltipText(series, 2, (id) => `Hero ${id}`)).toBe('2 min · Hero 2: 210');
  });
});
