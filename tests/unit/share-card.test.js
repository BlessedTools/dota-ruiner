import { describe, expect, it, vi } from 'vitest';
import { buildShareCardLines, exportShareCard } from '../../src/ui/share-card.js';

const analysis = { source: 'demo', matchId: 7890123456, duration: 2520, radiantWin: true, radiantScore: 38, direScore: 23, dataCoverage: 76, modelVersions: { ruin: 'ruin-v4.0.0', impact: 'impact-v4.0.0' }, narrative: { lead: 'Radiant победили 38:23; вывод построен по наблюдаемым данным.' }, leaders: { ruin: { name: '<script>'.repeat(30), heroName: 'Axe', ruinScore: 64, recommendations: { weaknesses: [{ evidence: ['10 deaths'] }] } }, impact: { name: 'Demo Mid', heroName: 'Invoker', impactScore: 81 } } };

describe('share card export', () => {
  it('includes demo, coverage, model and disclaimer while limiting user text', () => {
    const lines = buildShareCardLines(analysis, 'en');
    expect(lines.join(' ')).toContain('DEMO');
    expect(lines.join(' ')).toContain('76%');
    expect(lines.join(' ')).toContain('ruin-v4.0.0');
    expect(lines.join(' ')).toContain('impact-v4.0.0');
    expect(lines.join(' ')).toContain('Radiant 38:23');
    expect(lines.join(' ')).toContain('Invoker');
    expect(lines.join(' ')).toContain('observed data');
    expect(lines.join(' ')).toContain('64');
    expect(lines.join(' ')).toContain('81');
    expect(lines.join(' ')).toContain('heuristic');
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(96);
  });

  it('produces a deterministic PNG blob', async () => {
    const ctx = { fillRect: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 10 }), set fillStyle(_v) {}, set font(_v) {}, set textBaseline(_v) {} };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (callback) => callback(new Blob(['png'], { type: 'image/png' })) };
    const result = await exportShareCard(analysis, { locale: 'en', canvasFactory: () => canvas, share: null });
    expect(result).toMatchObject({ kind: 'blob', filename: 'dota-ruiner-demo.png' });
    expect(canvas).toMatchObject({ width: 1200, height: 630 });
  });
});
