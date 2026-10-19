import { describe, expect, it, vi } from 'vitest';
import { ApiError, fetchMatch, parseMatchInput } from '../../src/api/opendota.js';

describe('OpenDota client', () => {
  it.each([
    ['9000000001', '9000000001'],
    ['https://www.opendota.com/matches/9000000001', '9000000001'],
    ['https://www.dotabuff.com/matches/9000000001', '9000000001'],
  ])('parses supported input %s', (input, matchId) => {
    expect(parseMatchInput(input)).toEqual({ ok: true, matchId, errorKey: null });
  });

  it.each(['abc9000000001x', '9000000001 and 9000000002', '1234', 'javascript:9000000001'])('rejects ambiguous or unsupported input %s', (input) => {
    expect(parseMatchInput(input).ok).toBe(false);
  });

  it('uses the local proxy first and never adds a browser api key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ match_id: 9000000001, players: [] }), { status: 200 }));
    await fetchMatch('9000000001', { fetchImpl, isLocal: true, timeoutMs: 100 });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/matches/9000000001');
    expect(fetchImpl.mock.calls[0][0]).not.toContain('api_key');
  });

  it.each([[404, 'not-found'], [429, 'rate-limited'], [500, 'upstream-error']])('maps HTTP %i to %s', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status }));
    await expect(fetchMatch('9000000001', { fetchImpl, isLocal: false, timeoutMs: 100 })).rejects.toMatchObject({ name: 'ApiError', code });
  });

  it('rejects invalid JSON as an invalid response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{broken', { status: 200 }));
    await expect(fetchMatch('9000000001', { fetchImpl, isLocal: false, timeoutMs: 100 })).rejects.toEqual(expect.objectContaining({ code: 'invalid-response' }));
    expect(ApiError).toBeTypeOf('function');
  });
});
