export const MODEL_VERSIONS = Object.freeze({
  ruin: 'ruin-v2.0.0',
  impact: 'impact-v2.0.0',
});

export const SCORE_WEIGHTS = Object.freeze({
  ruin: Object.freeze({ deaths: 25, economy: 20, damage: 20, participation: 15, 'role-duties': 10, macro: 10, abandon: 20 }),
  impact: Object.freeze({ participation: 25, contribution: 25, economy: 15, objectives: 15, 'role-duties': 10, survival: 10 }),
});

const standard = {
  'safe-core': { gpm: 540, lhpm: 7.2, dpm: 560 },
  mid: { gpm: 520, lhpm: 6.3, dpm: 650 },
  offlane: { gpm: 430, lhpm: 4.5, dpm: 520 },
  'soft-support': { gpm: 340, lhpm: 2.0, dpm: 360 },
  'hard-support': { gpm: 300, lhpm: 1.2, dpm: 280 },
  unknown: { gpm: 410, lhpm: 3.8, dpm: 450 },
};

export const BENCHMARKS = Object.freeze({
  standard: Object.freeze(standard),
  turbo: Object.freeze(Object.fromEntries(Object.entries(standard).map(([key, value]) => [key, { gpm: Math.round(value.gpm * 1.45), lhpm: value.lhpm * 1.2, dpm: Math.round(value.dpm * 1.35) }]))),
  generic: Object.freeze(Object.fromEntries(Object.entries(standard).map(([key, value]) => [key, { gpm: Math.round(value.gpm * 0.9), lhpm: value.lhpm * 0.9, dpm: Math.round(value.dpm * 0.9) }]))),
});
