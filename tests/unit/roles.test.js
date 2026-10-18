import { describe, expect, it } from 'vitest';
import { inferRole } from '../../src/domain/roles.js';

const player = (overrides = {}) => ({ slot: 0, gpm: 400, lastHits: 180, laneRole: null, lane: null, isRoaming: null, obsPlaced: null, senPlaced: null, purchase: null, ...overrides });

describe('inferRole', () => {
  it('uses observed lane evidence before farm rank', () => {
    const strugglingCarry = player({ laneRole: 1, gpm: 210, lastHits: 120 });
    const team = [strugglingCarry, player({ slot: 1, gpm: 700 }), player({ slot: 2, gpm: 600 }), player({ slot: 3, gpm: 500 }), player({ slot: 4, gpm: 450 })];
    expect(inferRole(strugglingCarry, team, { roles: ['Carry'] })).toMatchObject({ position: 'safe-core', certainty: 'high' });
  });

  it('recognizes mid, offlane, roaming support and hard support evidence', () => {
    const team = [player({ slot: 0 }), player({ slot: 1 }), player({ slot: 2 }), player({ slot: 3 }), player({ slot: 4 })];
    expect(inferRole(player({ laneRole: 2 }), team).position).toBe('mid');
    expect(inferRole(player({ laneRole: 3 }), team).position).toBe('offlane');
    expect(inferRole(player({ isRoaming: true }), team).position).toBe('soft-support');
    expect(inferRole(player({ obsPlaced: 15, senPlaced: 10, gpm: 220, lastHits: 20 }), team).position).toBe('hard-support');
  });

  it('reports unknown when sparse evidence is contradictory', () => {
    const candidate = player({ gpm: null, lastHits: null });
    expect(inferRole(candidate, [candidate], { roles: ['Carry', 'Support'] })).toMatchObject({ position: 'unknown', certainty: 'unknown' });
  });
});
