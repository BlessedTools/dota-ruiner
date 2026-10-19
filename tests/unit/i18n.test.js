import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES, createI18n } from '../../src/data/i18n.js';

describe('i18n', () => {
  it('keeps RU and EN catalogs complete for public keys', () => {
    const ru = createI18n('ru');
    const en = createI18n('en');
    for (const key of ['app.title', 'form.matchId', 'actions.analyze', 'states.loading', 'disclaimer', 'demo.label', 'quality.insufficient', 'availability.benchmarks', 'metrics.heroDamage', 'insights.survival-low']) {
      expect(ru.t(key)).not.toBe(key);
      expect(en.t(key)).not.toBe(key);
    }
    expect(SUPPORTED_LOCALES).toEqual(['ru', 'en']);
  });

  it('persists locale and formats values with Intl', () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const i18n = createI18n('en', storage);
    i18n.setLocale('ru');
    expect(values.get('dota-ruiner:locale')).toBe('ru');
    expect(i18n.number(12345)).toMatch(/12[\s ]345/);
  });
});
