export const MODEL_VERSIONS = Object.freeze({
  ruin: 'ruin-v4.0.0',
  impact: 'impact-v4.0.0',
});

export const SCORE_WEIGHTS = Object.freeze({
  ruin: Object.freeze({ deaths: 25, economy: 20, damage: 15, participation: 15, 'role-duties': 10, throw: 15, abandon: 20 }),
  impact: Object.freeze({ participation: 20, contribution: 25, economy: 20, objectives: 15, 'role-duties': 10, survival: 10 }),
});
