import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchConstants, getConstantHero, getConstantItem, getMatchLabel, resetConstantsCache, safeAssetUrl,
} from '../../src/data/match-constants.js';

beforeEach(() => resetConstantsCache());

describe('match constants', () => {
  it('normalizes safe hero, item, mode, lobby, region and patch lookups with fallbacks', async () => {
    const payloads = {
      heroes: { 1: { id: 1, localized_name: 'Anti-Mage', name: 'npc_dota_hero_antimage', img: '/apps/dota2/images/dota_react/heroes/antimage.png' } },
      items: { blink: { id: 1, dname: 'Blink Dagger', img: '/apps/dota2/images/dota_react/items/blink.png' } },
      game_mode: { 22: { id: 22, name: 'All Draft' } },
      lobby_type: { 7: { id: 7, name: 'Ranked' } },
      region: { 8: 'Europe' },
      patch: [{ id: 60, name: '7.40', date: '2026-08-01T00:00:00Z' }],
    };
    const fetchImpl = vi.fn(async (url) => {
      const key = String(url).split('/').at(-1);
      return new Response(JSON.stringify(payloads[key]), { status: 200 });
    });
    const constants = await fetchConstants({ fetchImpl, timeoutMs: 100 });
    expect(getConstantHero(constants, 1)).toMatchObject({ id: 1, name: 'Anti-Mage' });
    expect(getConstantHero(constants, 1).image).toMatch(/^https:\/\/cdn\.cloudflare\.steamstatic\.com\//);
    expect(getConstantItem(constants, 1)).toMatchObject({ id: 1, name: 'Blink Dagger' });
    expect(getMatchLabel(constants, 'gameModes', 22)).toBe('All Draft');
    expect(getMatchLabel(constants, 'lobbies', 7)).toBe('Ranked');
    expect(getMatchLabel(constants, 'regions', 8)).toBe('Europe');
    expect(getMatchLabel(constants, 'patches', 60)).toBe('7.40');
    expect(getConstantHero(constants, 999)).toMatchObject({ id: 999, name: 'Hero 999', image: null });
    expect(getConstantItem(constants, 999)).toMatchObject({ id: 999, name: 'Item 999', image: null });
  });

  it('rejects untrusted image schemes and hosts', () => {
    expect(safeAssetUrl('javascript:alert(1)')).toBeNull();
    expect(safeAssetUrl('https://evil.example/hero.png')).toBeNull();
    expect(safeAssetUrl('https://cdn.cloudflare.steamstatic.com/apps/dota2/hero.png')).toContain('steamstatic.com');
  });

  it('tolerates one constants endpoint failure and caches the normalized result', async () => {
    const fetchImpl = vi.fn(async (url) => String(url).endsWith('/items')
      ? new Response('{}', { status: 500 })
      : new Response('{}', { status: 200 }));
    const first = await fetchConstants({ fetchImpl, timeoutMs: 100 });
    const second = await fetchConstants({ fetchImpl, timeoutMs: 100 });
    expect(first).toBe(second);
    expect(first.items.size).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });
});
