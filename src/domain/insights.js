export const INSIGHT_THRESHOLDS = Object.freeze({
  lowPercentile: 0.25,
  highPercentile: 0.75,
});

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const pct = (player, metric) => {
  const value = player?.benchmarks?.[metric]?.percentile;
  return finite(value) ? Math.max(0, Math.min(1, value)) : null;
};

function insight(id, tone, metric, evidence) {
  return { id, tone, metric, evidence, availability: 'observed' };
}

function percentileInsight(output, metric, value, evidence) {
  if (!finite(value)) return;
  if (value <= INSIGHT_THRESHOLDS.lowPercentile) output.push(insight(`${metric}-low`, 'negative', metric, { ...evidence, percentile: Math.round(value * 100) }));
  if (value >= INSIGHT_THRESHOLDS.highPercentile) output.push(insight(`${metric}-high`, 'positive', metric, { ...evidence, percentile: Math.round(value * 100) }));
}

export function buildPlayerInsights({ player, role, ruin } = {}) {
  if (!player || typeof player !== 'object') return [];
  const output = [];
  const economyValues = [pct(player, 'gold_per_min'), pct(player, 'last_hits_per_min')].filter(finite);
  const economy = economyValues.length ? economyValues.reduce((sum, value) => sum + value, 0) / economyValues.length : null;
  percentileInsight(output, 'economy', economy, { gpm: player.gpm ?? null, lastHits: player.lastHits ?? null });
  percentileInsight(output, 'combat', pct(player, 'hero_damage_per_min'), { heroDamage: player.heroDamage ?? null });
  percentileInsight(output, 'survival', pct(player, 'deaths_per_min'), { deaths: player.deaths ?? null });
  percentileInsight(output, 'objectives', pct(player, 'tower_damage'), { towerDamage: player.towerDamage ?? null });

  if (finite(player.heroHealing) && player.heroHealing > 0) {
    percentileInsight(output, 'healing', pct(player, 'hero_healing_per_min'), { heroHealing: player.heroHealing });
  }

  const visionValues = [player.obsPlaced, player.senPlaced, player.campsStacked].filter(finite);
  if (visionValues.length) {
    const evidence = { obsPlaced: player.obsPlaced ?? null, senPlaced: player.senPlaced ?? null, campsStacked: player.campsStacked ?? null };
    const total = visionValues.reduce((sum, value) => sum + value, 0);
    output.push(insight(total > 0 ? 'vision-observed' : 'vision-zero', total > 0 ? 'positive' : 'negative', 'vision', evidence));
  }

  const throwComponent = ruin?.components?.find((component) => component.id === 'throw' && component.available && component.points > 0);
  if (throwComponent) {
    const evidence = throwComponent.evidence?.find((item) => item && typeof item === 'object') || { points: throwComponent.points };
    output.push(insight('late-throw-observed', 'negative', 'throw', evidence));
  }

  if ((player.leaverStatus ?? 0) > 1 || (player.abandons ?? 0) > 0) {
    output.push(insight('abandon-confirmed', 'negative', 'abandon', { leaverStatus: player.leaverStatus ?? null, abandons: player.abandons ?? null }));
  }
  return output;
}
