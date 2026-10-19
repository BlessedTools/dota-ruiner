// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from '../../src/data/i18n.js';
import { renderPlayerInspector } from '../../src/ui/player-inspector.js';
import { renderScoreboard } from '../../src/ui/scoreboard.js';

const item = (id) => ({ id, name: `Item ${id}`, image: `https://cdn.cloudflare.steamstatic.com/item-${id}.png` });
const player = {
  slot: 0, team: 'radiant', name: '<img src=x onerror=alert(1)>', heroName: 'Anti-Mage', heroImage: 'https://cdn.cloudflare.steamstatic.com/hero.png',
  level: 24, role: { position: 'safe-core', certainty: 'medium' }, kills: 9, deaths: 1, assists: 10,
  gpm: 815, xpm: 790, netWorth: 30054, lastHits: 407, denies: 12, heroDamage: 25801, towerDamage: 13552, heroHealing: 0,
  obsPlaced: null, senPlaced: null, campsStacked: null, stuns: null, ruinScore: 4, impactScore: 96,
  items: [1, 2, 3, 4, 5, 6].map(item), backpackItems: [item(7), null, null], neutralItemData: item(8), aghanimsScepter: true, aghanimsShard: true,
  insights: [], ruin: { components: [{ id: 'deaths', available: true, points: 1, maxPoints: 25, source: 'opendota.benchmarks.deaths_per_min', evidence: [{ deaths: 1, percentile: 0.96 }] }] },
  impact: { components: [{ id: 'economy', available: true, points: 19, maxPoints: 20, source: 'opendota.benchmarks.economy', evidence: [{ gpm: 815, percentile: 0.98 }] }] },
};

beforeEach(() => { document.body.replaceChildren(); });

describe('player inspector', () => {
  it('shows all primary metrics, six item slots, neutral item and five keyboard tabs', () => {
    const inspector = renderPlayerInspector(player, createI18n('ru'));
    document.body.append(inspector);
    expect(inspector.textContent).toContain('9 / 1 / 10');
    expect(inspector.textContent).toContain('815 GPM');
    expect(inspector.textContent).toContain('790 XPM');
    expect(inspector.textContent).toContain('25 801');
    expect(inspector.querySelectorAll('.inspector-item--main')).toHaveLength(6);
    expect(inspector.querySelector('.inspector-item--neutral').getAttribute('alt')).toBe('Item 8');
    expect(inspector.querySelectorAll('[role="tab"]')).toHaveLength(5);
    expect([...inspector.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual(['Обзор', 'Экономика', 'Бой', 'Поддержка', 'Оценка']);
  });

  it('explains unavailable support fields and switches tabs with click and arrow keys', () => {
    const inspector = renderPlayerInspector(player, createI18n('ru'));
    document.body.append(inspector);
    const support = [...inspector.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === 'Поддержка');
    support.click();
    expect(inspector.querySelector('[role="tabpanel"]:not([hidden])').textContent).toContain('Данные поддержки не получены OpenDota');
    support.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement.textContent).toBe('Оценка');
  });

  it('renders hostile persona names as text and expands one in-flow inspector from native row buttons', () => {
    const onSelect = vi.fn();
    const scoreboard = renderScoreboard({ teams: [
      { id: 'radiant', label: 'Radiant', players: [player] },
      { id: 'dire', label: 'Dire', players: [{ ...player, slot: 128, team: 'dire', name: 'Second' }] },
    ] }, createI18n('ru'), onSelect);
    document.body.append(scoreboard);
    const rows = scoreboard.querySelectorAll('.scoreboard-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('<img src=x onerror=alert(1)>');
    expect(scoreboard.querySelector('img[src="x"]')).toBeNull();
    rows[0].click();
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    expect(rows[1].getAttribute('aria-expanded')).toBe('false');
    expect(scoreboard.querySelector('[data-player-inspector]')).not.toBeNull();
    expect(onSelect).toHaveBeenCalledWith(player);
  });
});
