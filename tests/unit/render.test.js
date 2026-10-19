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
    expect(document.querySelector('#results').textContent).toContain('Вывод требует осторожности');
    expect(document.querySelector('#results').textContent).toContain('эвристика');
  });

  it('keeps demo labeling persistent and machine-readable', () => {
    renderAnalysis(document.querySelector('#results'), { source: 'demo', matchId: 7890123456, duration: 1800, mode: 'ranked', warnings: [], quality: { quality: 'insufficient', showVerdict: false }, dataCoverage: 30, modelVersions: {}, leaders: {}, teams: [] }, createI18n('en'));
    expect(document.querySelector('[data-demo-label]')?.textContent).toContain('DEMO');
    expect(document.querySelector('#results').textContent).toContain('Insufficient data');
  });

  it('renders a match scoreboard, safe hero portrait and observed-factor count', () => {
    const leader = {
      slot: 0, team: 'radiant', name: 'Player', heroName: 'Axe', heroImage: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png',
      kills: 8, deaths: 2, assists: 10, gpm: 600, netWorth: 20100, ruinScore: 21, impactScore: 77,
      role: { position: 'offlane', certainty: 'medium' }, recommendations: { weaknesses: [], strengths: [] },
      ruin: { components: [{ id: 'deaths', available: true }, { id: 'economy', available: false }] },
    };
    renderAnalysis(document.querySelector('#results'), {
      source: 'opendota', matchId: 9000000001, duration: 2400, mode: 'ranked', radiantWin: true, radiantScore: 30, direScore: 20,
      warnings: [], quality: { quality: 'high', showVerdict: true, ambiguous: false }, dataCoverage: 82, modelVersions: { ruin: 'ruin-v3.0.0', impact: 'impact-v3.0.0' },
      leaders: { ruin: leader, impact: leader }, teams: [{ id: 'radiant', label: 'Radiant', players: [leader] }, { id: 'dire', label: 'Dire', players: [] }],
    }, createI18n('ru'));
    expect(document.querySelector('[data-match-score]').textContent).toContain('30');
    expect(document.querySelector('[data-match-score]').textContent).toContain('20');
    expect(document.querySelector('#results').textContent).toContain('Победа Radiant');
    expect(document.querySelector('.player-card img')).toMatchObject({ alt: '' });
    expect(document.querySelector('.player-card').textContent).toContain('1/2 факторов');
  });

  it('renders the arena, category availability, cinematic duel and observed team story', () => {
    const item = { id: 1, name: 'Blink Dagger', image: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blink.png' };
    const ruinLeader = {
      slot: 0, team: 'radiant', name: 'Razor player', heroName: 'Razor', heroImage: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/razor.png',
      kills: 3, deaths: 9, assists: 2, gpm: 273, xpm: 380, netWorth: 14321, heroDamage: 12729, towerDamage: 0,
      ruinScore: 46, impactScore: 38, role: { position: 'safe-core', certainty: 'medium' }, items: [item], neutralItemData: null,
      insights: [{ id: 'survival-low', tone: 'negative', metric: 'survival', availability: 'observed', evidence: { deaths: 9, percentile: 12 } }],
      recommendations: { weaknesses: [], strengths: [] }, ruin: { components: [{ id: 'deaths', available: true }] },
    };
    const impactLeader = {
      ...ruinLeader, slot: 128, team: 'dire', name: 'Anti-Mage player', heroName: 'Anti-Mage', heroImage: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png',
      kills: 9, deaths: 1, assists: 10, gpm: 815, netWorth: 30054, heroDamage: 25801, towerDamage: 13552, ruinScore: 4, impactScore: 96,
      insights: [{ id: 'economy-high', tone: 'positive', metric: 'economy', availability: 'observed', evidence: { gpm: 815, percentile: 98 } }],
    };
    renderAnalysis(document.querySelector('#results'), {
      source: 'opendota', matchId: 9048925949, duration: 1924, startTime: 1792230121, mode: 'ranked', radiantWin: false, radiantScore: 18, direScore: 33,
      metadata: { mode: 'All Draft', lobby: 'Ranked', region: 'Europe', patch: '7.40' },
      warnings: ['unparsed-or-partial'], quality: { quality: 'high', showVerdict: true }, dataCoverage: 90,
      availability: { overall: 'basic', categories: { summary: { status: 'available', reason: 'summary-observed' }, economyTimeline: { status: 'missing', reason: 'economy-timeline-missing' } } },
      modelVersions: { ruin: 'ruin-v4.0.0', impact: 'impact-v4.0.0' }, leaders: { ruin: ruinLeader, impact: impactLeader },
      narrative: { lead: 'Dire победили со счётом 33:18.', paragraphs: ['Dire нанесли на 42% больше урона героям.'], limitations: ['OpenDota не предоставил поминутную экономику.'] },
      comparisons: [{ metric: 'heroDamage', radiant: 50000, dire: 71000, leader: 'dire', delta: 21000, ratio: 1.42, complete: true }],
      teams: [{ id: 'radiant', label: 'Radiant', players: [ruinLeader] }, { id: 'dire', label: 'Dire', players: [impactLeader] }],
    }, createI18n('ru'));

    expect(document.querySelector('[data-match-arena]').textContent).toContain('Победа Dire');
    expect(document.querySelector('[data-match-arena]').textContent).toContain('7.40');
    expect(document.querySelector('[data-availability]').textContent).toContain('Поминутная экономика');
    expect(document.querySelector('[data-duel]').textContent).toContain('Ruin 46');
    expect(document.querySelector('[data-duel]').textContent).toContain('Impact 96');
    expect(document.querySelector('[data-duel]').textContent).toContain('9 смертей');
    expect(document.querySelector('[data-duel]').textContent).toContain('815 GPM');
    expect(document.querySelector('[data-duel]').textContent).toContain('ruin-v4.0.0');
    expect(document.querySelector('.duel__hero-art').getAttribute('loading')).toBe('eager');
    expect(document.querySelector('.duel__item').getAttribute('aria-label')).toBe('Blink Dagger');
    expect(document.querySelector('[data-team-comparison="heroDamage"]').textContent).toContain('71 000');
    expect(document.querySelector('[data-match-story]').textContent).toContain('OpenDota не предоставил поминутную экономику.');
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
