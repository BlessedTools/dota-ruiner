import { BENCHMARKS, MODEL_VERSIONS, SCORE_WEIGHTS } from '../data/scoring-config.js';
import { component, normalizeScore } from './score-utils.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const ratioDeficit = (observed, expected) => Math.max(0, (expected - observed) / expected);

function profileFor(match) {
  if (match.mode === 'turbo') return 'turbo';
  if (match.mode === 'ranked' || match.mode === 'standard') return 'standard';
  return 'generic';
}

export function calculateRuinScore({ player, team, match, role }) {
  const weights = SCORE_WEIGHTS.ruin;
  const profile = profileFor(match);
  const expected = BENCHMARKS[profile][role?.position || 'unknown'] || BENCHMARKS[profile].unknown;
  const minutes = match.duration / 60;
  const teamKills = team.reduce((sum, item) => sum + (finite(item.kills) ? item.kills : 0), 0);
  const averageDeaths = team.filter((item) => finite(item.deaths)).reduce((sum, item) => sum + item.deaths, 0) / Math.max(1, team.filter((item) => finite(item.deaths)).length);
  const deathAvailable = finite(player.deaths);
  const deathRate = deathAvailable ? player.deaths / minutes : null;
  const deathPressure = deathAvailable ? Math.max(deathRate / 0.22, averageDeaths ? player.deaths / averageDeaths : 0) : 0;

  const economyAvailable = finite(player.gpm) || finite(player.lastHits);
  const gpmDeficit = finite(player.gpm) ? ratioDeficit(player.gpm, expected.gpm) : null;
  const lhpm = finite(player.lastHits) ? player.lastHits / minutes : null;
  const lhDeficit = finite(lhpm) ? ratioDeficit(lhpm, expected.lhpm) : null;
  const economyRatio = [gpmDeficit, lhDeficit].filter(finite).reduce((sum, value) => sum + value, 0) / Math.max(1, [gpmDeficit, lhDeficit].filter(finite).length);

  const dpm = finite(player.heroDamage) ? player.heroDamage / minutes : null;
  const damageAvailable = finite(dpm);
  const participationAvailable = teamKills > 0 && finite(player.kills) && finite(player.assists);
  const participation = participationAvailable ? (player.kills + player.assists) / teamKills : null;
  const isSupport = role?.position === 'soft-support' || role?.position === 'hard-support';
  const supportObserved = [player.obsPlaced, player.senPlaced, player.campsStacked].some(finite);
  const coreObserved = finite(player.towerDamage);
  const dutiesAvailable = isSupport ? supportObserved : coreObserved;
  const wardRate = supportObserved ? ((player.obsPlaced || 0) + (player.senPlaced || 0) * 0.5) / Math.max(1, minutes / 10) : null;
  const dutiesRatio = isSupport ? Math.max(0, (4 - wardRate) / 4) : Math.max(0, (1200 - player.towerDamage) / 1200);
  const macroAvailable = finite(player.buybackCount);
  const macroRatio = macroAvailable ? Math.min(1, player.buybackCount / 2) : 0;
  const abandonAvailable = finite(player.leaverStatus) || finite(player.abandons);
  const abandoned = (player.leaverStatus || 0) > 1 || (player.abandons || 0) > 0;

  const components = [
    component('deaths', weights.deaths, deathAvailable, weights.deaths * Math.min(1, deathPressure / 1.8), player.deaths, 'role/team adjusted', deathAvailable ? [`${player.deaths} deaths`, `${deathRate.toFixed(2)}/min`] : []),
    component('economy', weights.economy, economyAvailable, weights.economy * economyRatio, { gpm: player.gpm, lhpm }, expected, economyAvailable ? [`GPM ${player.gpm ?? 'n/a'}`, `LH/min ${lhpm?.toFixed(1) ?? 'n/a'}`] : []),
    component('damage', weights.damage, damageAvailable, weights.damage * ratioDeficit(dpm, expected.dpm), dpm, expected.dpm, damageAvailable ? [`${Math.round(dpm)} DPM`] : []),
    component('participation', weights.participation, participationAvailable, weights.participation * Math.max(0, (0.55 - participation) / 0.55), participation, 0.55, participationAvailable ? [`${Math.round(participation * 100)}% participation`] : []),
    component('role-duties', weights['role-duties'], dutiesAvailable, weights['role-duties'] * dutiesRatio, isSupport ? wardRate : player.towerDamage, isSupport ? 4 : 1200, dutiesAvailable ? [isSupport ? `${wardRate.toFixed(1)} vision actions/10m` : `${player.towerDamage} tower damage`] : []),
    component('macro', weights.macro, macroAvailable, weights.macro * macroRatio, player.buybackCount, 0, macroAvailable ? [`${player.buybackCount} buybacks`] : []),
    component('abandon', weights.abandon, abandonAvailable, abandoned ? weights.abandon : 0, abandoned, false, abandonAvailable ? [abandoned ? 'confirmed abandon/leaver' : 'no abandon'] : []),
  ];
  const normalized = normalizeScore(components);
  return { ...normalized, components, flags: abandoned ? ['abandon'] : [], role, profile, modelVersion: MODEL_VERSIONS.ruin };
}
