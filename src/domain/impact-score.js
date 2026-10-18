import { BENCHMARKS, MODEL_VERSIONS, SCORE_WEIGHTS } from '../data/scoring-config.js';
import { component, normalizeScore } from './score-utils.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

export function calculateImpactScore({ player, team, match, role }) {
  const weights = SCORE_WEIGHTS.impact;
  const profile = match.mode === 'turbo' ? 'turbo' : match.mode === 'ranked' || match.mode === 'standard' ? 'standard' : 'generic';
  const expected = BENCHMARKS[profile][role?.position || 'unknown'] || BENCHMARKS[profile].unknown;
  const minutes = match.duration / 60;
  const teamKills = team.reduce((sum, item) => sum + (finite(item.kills) ? item.kills : 0), 0);
  const participationAvailable = teamKills > 0 && finite(player.kills) && finite(player.assists);
  const participation = participationAvailable ? (player.kills + player.assists) / teamKills : null;
  const dpm = finite(player.heroDamage) ? player.heroDamage / minutes : null;
  const utility = [player.stuns, player.heroHealing].filter(finite).reduce((sum, value) => sum + value, 0);
  const contributionAvailable = finite(dpm) || [player.stuns, player.heroHealing].some(finite);
  const contributionRatio = Math.min(1, ((dpm || 0) / expected.dpm) * 0.8 + Math.min(0.2, utility / 10000));
  const economyAvailable = finite(player.gpm);
  const economyRatio = economyAvailable ? Math.min(1, player.gpm / expected.gpm) : 0;
  const objectivesAvailable = finite(player.towerDamage);
  const objectiveRatio = objectivesAvailable ? Math.min(1, player.towerDamage / 2500) : 0;
  const isSupport = role?.position === 'soft-support' || role?.position === 'hard-support';
  const dutiesObserved = isSupport
    ? [player.obsPlaced, player.senPlaced, player.campsStacked, player.heroHealing].some(finite)
    : finite(player.lastHits) || finite(player.towerDamage);
  const dutiesRatio = isSupport
    ? Math.min(1, ((player.obsPlaced || 0) + (player.senPlaced || 0) * 0.5 + (player.campsStacked || 0) + (player.heroHealing || 0) / 1000) / 20)
    : Math.min(1, ((player.lastHits || 0) / Math.max(1, minutes * expected.lhpm) + objectiveRatio) / 2);
  const survivalAvailable = finite(player.deaths);
  const survivalRatio = survivalAvailable ? Math.max(0, 1 - (player.deaths / minutes) / 0.3) : 0;

  const components = [
    component('participation', weights.participation, participationAvailable, weights.participation * Math.min(1, participation / 0.65), participation, 0.65, participationAvailable ? [`${Math.round(participation * 100)}% participation`] : []),
    component('contribution', weights.contribution, contributionAvailable, weights.contribution * contributionRatio, { dpm, utility }, expected.dpm, contributionAvailable ? [`${Math.round(dpm || 0)} DPM`] : []),
    component('economy', weights.economy, economyAvailable, weights.economy * economyRatio, player.gpm, expected.gpm, economyAvailable ? [`${player.gpm} GPM`] : []),
    component('objectives', weights.objectives, objectivesAvailable, weights.objectives * objectiveRatio, player.towerDamage, 2500, objectivesAvailable ? [`${player.towerDamage} tower damage`] : []),
    component('role-duties', weights['role-duties'], dutiesObserved, weights['role-duties'] * dutiesRatio, null, null, dutiesObserved ? ['role contribution observed'] : []),
    component('survival', weights.survival, survivalAvailable, weights.survival * survivalRatio, player.deaths, 'duration adjusted', survivalAvailable ? [`${player.deaths} deaths`] : []),
  ];
  const normalized = normalizeScore(components);
  return { ...normalized, components, flags: [], role, profile, modelVersion: MODEL_VERSIONS.impact };
}
