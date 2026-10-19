import { describe, expect, it } from 'vitest';
import ranked from '../fixtures/ranked.json';
import partial from '../fixtures/partial.json';
import turbo from '../fixtures/turbo.json';
import { normalizeMatch } from '../../src/domain/normalize-match.js';

const clone = (value) => structuredClone(value);

describe('normalizeMatch', () => {
  it('normalizes a parsed ranked match without changing observed values', () => {
    const result = normalizeMatch(clone(ranked));
    expect(result.ok).toBe(true);
    expect(result.match.mode).toBe('ranked');
    expect(result.match.players).toHaveLength(10);
    expect(result.match.players[0]).toMatchObject({ gpm: 600, xpm: 700, personaname: 'Carry', team: 'radiant' });
    expect(result.match.players[0].gold_t).toEqual([0, 600, 1300]);
  });

  it('keeps unavailable metrics null and preserves timeline gaps', () => {
    const result = normalizeMatch(clone(partial));
    expect(result.ok).toBe(true);
    expect(result.match.players[0].gpm).toBeNull();
    expect(result.match.players[0].heroDamage).toBeNull();
    expect(result.match.players[0].gold_t).toEqual([0, null, 900]);
    expect(result.warnings).toContain('unknown-hero');
    expect(result.warnings).toContain('partial-match-data');
  });

  it('identifies turbo independently from lobby type', () => {
    expect(normalizeMatch(clone(turbo)).match.mode).toBe('turbo');
  });

  it('uses a conservative generic profile and warning for unsupported custom modes', () => {
    const custom = clone(ranked);
    custom.game_mode = 99;
    custom.lobby_type = 0;
    const result = normalizeMatch(custom);
    expect(result.match.mode).toBe('generic');
    expect(result.warnings).toContain('unsupported-mode');
  });

  it.each([9, 11])('accepts a separated %i-player match with a composition warning', (count) => {
    const raw = clone(ranked);
    raw.players = count === 9 ? raw.players.slice(0, 9) : [...raw.players, { ...raw.players[0], player_slot: 5, hero_id: 11 }];
    const result = normalizeMatch(raw);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('unusual-player-count');
  });

  it('returns controlled errors for too-short and unusable matches', () => {
    const short = normalizeMatch({ ...clone(turbo), duration: 299 });
    const empty = normalizeMatch({ match_id: 1, duration: 900, players: [] });
    expect(short).toMatchObject({ ok: false, errors: ['match-too-short'] });
    expect(empty.ok).toBe(false);
    expect(empty.errors).toContain('not-enough-players');
  });
});
