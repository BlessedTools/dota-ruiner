// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createI18n } from '../../src/data/i18n.js';
import { renderAnalysis } from '../../src/ui/render.js';
import { renderError, renderLoading } from '../../src/ui/states.js';

beforeEach(() => {
  document.body.innerHTML = '<main id="main"><section id="status" aria-live="polite"></section><section id="results"></section></main>';
});

describe('safe accessible rendering', () => {
  it('renders hostile names as text with evidence and uncertainty', () => {
    const hostile = '<img src=x onerror=alert(1)>';
    renderAnalysis(document.querySelector('#results'), {
      source: 'opendota', matchId: 9000000001, duration: 1800, mode: 'ranked', warnings: ['partial-match-data'], quality: { quality: 'medium', showVerdict: true, ambiguous: false },
      dataCoverage: 72, modelVersions: { ruin: 'ruin-v2.0.0', impact: 'impact-v2.0.0' },
      leaders: { ruin: { name: hostile, heroName: 'Axe', score: 60, role: { position: 'unknown', certainty: 'unknown' }, recommendations: { weaknesses: [], strengths: [] } }, impact: null },
      teams: [],
    }, createI18n('ru'));
    expect(document.querySelector('#results').textContent).toContain(hostile);
    expect(document.querySelector('#results img')).toBeNull();
    expect(document.querySelector('#results').textContent).toContain('72%');
    expect(document.querySelector('#results').textContent).toContain('эвристика');
  });

  it('keeps demo labeling persistent and machine-readable', () => {
    renderAnalysis(document.querySelector('#results'), { source: 'demo', matchId: 7890123456, duration: 1800, mode: 'ranked', warnings: [], quality: { quality: 'insufficient', showVerdict: false }, dataCoverage: 30, modelVersions: {}, leaders: {}, teams: [] }, createI18n('en'));
    expect(document.querySelector('[data-demo-label]')?.textContent).toContain('DEMO');
    expect(document.querySelector('#results').textContent).toContain('Insufficient data');
  });

  it('announces loading and errors without replacing the live region', () => {
    const status = document.querySelector('#status');
    renderLoading(status, createI18n('en'));
    expect(status.getAttribute('aria-busy')).toBe('true');
    renderError(status, 'not-found', createI18n('en'));
    expect(status.getAttribute('role')).toBe('alert');
    expect(status.textContent).toContain('not found');
  });
});
