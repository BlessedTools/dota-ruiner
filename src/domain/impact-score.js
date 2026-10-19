import { MODEL_VERSIONS, SCORE_WEIGHTS } from '../data/scoring-config.js';
import { clamp, component, normalizeScore } from './score-utils.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const percentile = (player, key) => {
  const value = player?.benchmarks?.[key]?.percentile;
  return finite(value) ? clamp(value, 0, 1) : null;
};
const average = (values) => {
  const observed = values.filter(finite);
  return observed.length ? observed.reduce((sum, value) => sum + value, 0) / observed.length : null;
};

function participationFor(player, team) {
  if (finite(player.teamfightParticipation)) return clamp(player.teamfightParticipation, 0, 1);
  const teamKills = team.reduce((sum, item) => sum + (finite(item.kills) ? item.kills : 0), 0);
  if (!teamKills || !finite(player.kills) || !finite(player.assists)) return null;
  return clamp((player.kills + player.assists) / teamKills, 0, 1);
}

function supportDuty(player, team) {
  if (![player.obsPlaced, player.senPlaced].some(finite)) return null;
  const value = (finite(player.obsPlaced) ? player.obsPlaced : 0) + (finite(player.senPlaced) ? player.senPlaced : 0);
  const total = team.reduce((sum, item) => sum + (finite(item.obsPlaced) ? item.obsPlaced : 0) + (finite(item.senPlaced) ? item.senPlaced : 0), 0);
  return total > 0 ? clamp(value / total * 2, 0, 1) : null;
}

export function calculateImpactScore({ player, team, match, role }) {
  const weights = SCORE_WEIGHTS.impact;
  const participation = participationFor(player, team);
  const healingPct = player?.benchmarks?.hero_healing_per_min?.raw > 0 ? percentile(player, 'hero_healing_per_min') : null;
  const contributionPct = average([
    percentile(player, 'hero_damage_per_min'),
    percentile(player, 'kills_per_min'),
    percentile(player, 'assists_per_min'),
    healingPct,
  ]);
  const economyPct = average([percentile(player, 'gold_per_min'), percentile(player, 'xp_per_min')]);
  const objectivePct = percentile(player, 'tower_damage');
  const roleCertain = role?.certainty !== 'low' && role?.position !== 'unknown';
  const isSupport = roleCertain && (role?.position === 'soft-support' || role?.position === 'hard-support');
  const dutiesPct = !roleCertain ? null : isSupport ? supportDuty(player, team) : percentile(player, 'last_hits_per_min');
  const deathPct = percentile(player, 'deaths_per_min');

  const components = [
    component('participation', weights.participation, finite(participation), weights.participation * participation, participation, 'match.teamfight_participation', finite(participation) ? [{ participation }] : []),
    component('contribution', weights.contribution, finite(contributionPct), weights.contribution * contributionPct, contributionPct, 'opendota.benchmarks.contribution', finite(contributionPct) ? [{ percentile: contributionPct, heroDamage: player.heroDamage ?? null, heroHealing: player.heroHealing ?? null }] : []),
    component('economy', weights.economy, finite(economyPct), weights.economy * economyPct, economyPct, 'opendota.benchmarks.economy', finite(economyPct) ? [{ percentile: economyPct, gpm: player.gpm ?? null, xpm: player.xpm ?? null }] : []),
    component('objectives', weights.objectives, finite(objectivePct), weights.objectives * objectivePct, objectivePct, 'opendota.benchmarks.tower_damage', finite(objectivePct) ? [{ percentile: objectivePct, towerDamage: player.towerDamage ?? null }] : []),
    component('role-duties', weights['role-duties'], finite(dutiesPct), weights['role-duties'] * dutiesPct, dutiesPct, isSupport ? 'match.team_vision_share' : 'opendota.benchmarks.last_hits_per_min', finite(dutiesPct) ? [isSupport ? { share: dutiesPct / 2, obsPlaced: player.obsPlaced ?? null, senPlaced: player.senPlaced ?? null } : { percentile: dutiesPct, lastHits: player.lastHits ?? null }] : []),
    component('survival', weights.survival, finite(deathPct), weights.survival * deathPct, deathPct, 'opendota.benchmarks.deaths_per_min', finite(deathPct) ? [{ percentile: deathPct, deaths: player.deaths ?? null }] : []),
  ];
  const normalized = normalizeScore(components);
  const profile = match.mode === 'turbo' ? 'turbo' : match.mode === 'ranked' || match.mode === 'standard' ? 'standard' : 'generic';
  return { ...normalized, components, flags: [], role, profile, modelVersion: MODEL_VERSIONS.impact };
}
