import { describe, expect, it, vi } from 'vitest';
import { buildShareCardLines, exportShareCard } from '../../src/ui/share-card.js';

const analysis = { source: 'demo', matchId: 7890123456, dataCoverage: 76, modelVersions: { ruin: 'ruin-v2.0.0', impact: 'impact-v2.0.0' }, leaders: { ruin: { name: '<script>'.repeat(30), heroName: 'Axe', score: 64, recommendations: { weaknesses: [{ evidence: ['10 deaths'] }] } }, impact: { heroName: 'Invoker', score: 81 } } };

describe('share card export', () => {
  it('includes demo, coverage, model and disclaimer while limiting user text', () => {
    const lines = buildShareCardLines(analysis, 'en');
    expect(lines.join(' ')).toContain('DEMO');
    expect(lines.join(' ')).toContain('76%');
    expect(lines.join(' ')).toContain('ruin-v2.0.0');
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
