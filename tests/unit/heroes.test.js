import { describe, expect, it, vi } from 'vitest';
import { getHero, isAllowedHeroImage, loadHeroConstants } from '../../src/data/heroes.js';

describe('hero catalog', () => {
  it('includes recent heroes and a neutral unknown fallback', () => {
    expect(getHero(145).name).toBe('Ringmaster');
    expect(getHero(155).name).toBe('Kez');
    expect(getHero(156).name).toBe('Largo');
    expect(getHero(999)).toMatchObject({ id: 999, name: 'Hero 999', image: null });
  });

  it('merges live constants without depending on network', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ 145: { id: 145, localized_name: 'Ringmaster Live', roles: ['Support'], img: '/apps/dota2/images/dota_react/heroes/ringmaster.png' } }), { status: 200 }));
    const catalog = await loadHeroConstants({ fetchImpl, timeoutMs: 100 });
    expect(catalog.get(145)).toMatchObject({ name: 'Ringmaster Live', roles: ['Support'] });
  });

  it('allows only approved HTTPS portrait origins', () => {
    expect(isAllowedHeroImage('https://cdn.cloudflare.steamstatic.com/apps/dota2/test.png')).toBe(true);
    expect(isAllowedHeroImage('javascript:alert(1)')).toBe(false);
    expect(isAllowedHeroImage('https://evil.example/hero.png')).toBe(false);
  });
});
