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

function visionShare(player, team) {
  if (![player.obsPlaced, player.senPlaced].some(finite)) return null;
  const value = (finite(player.obsPlaced) ? player.obsPlaced : 0) + (finite(player.senPlaced) ? player.senPlaced : 0);
  const total = team.reduce((sum, item) => sum + (finite(item.obsPlaced) ? item.obsPlaced : 0) + (finite(item.senPlaced) ? item.senPlaced : 0), 0);
  return total > 0 ? value / total : null;
}

function networthAt(team, minute) {
  const values = team.map((player) => player.networth_t?.[minute]);
  return values.every(finite) ? values.reduce((sum, value) => sum + value, 0) : null;
}

function throwEvidence(player, match) {
  if (!Array.isArray(player.deathsLog)) return { available: false, ratio: 0, evidence: [] };
  const own = match.players.filter((item) => item.team === player.team);
  const enemy = match.players.filter((item) => item.team !== player.team);
  if (![...own, ...enemy].every((item) => Array.isArray(item.networth_t))) return { available: false, ratio: 0, evidence: [] };
  const late = player.deathsLog.filter((event) => event.time >= 1800);
  const throws = late.filter((event) => {
    const minute = Math.floor(event.time / 60);
    const ownWorth = networthAt(own, minute);
    const enemyWorth = networthAt(enemy, minute);
    return finite(ownWorth) && finite(enemyWorth) && ownWorth > enemyWorth;
  });
  return {
    available: true,
    ratio: late.length ? throws.length / late.length : 0,
    evidence: [{ lateDeaths: late.length, observedLeadDeaths: throws.length }],
  };
}

function profileFor(match) {
  if (match.mode === 'turbo') return 'turbo';
  if (match.mode === 'ranked' || match.mode === 'standard') return 'standard';
  return 'generic';
}

export function calculateRuinScore({ player, team, match, role }) {
  const weights = SCORE_WEIGHTS.ruin;
  const deathPct = percentile(player, 'deaths_per_min');
  const economyPct = average([percentile(player, 'gold_per_min'), percentile(player, 'last_hits_per_min')]);
  const damagePct = percentile(player, 'hero_damage_per_min');
  const participation = participationFor(player, team);
  const roleCertain = role?.certainty !== 'low' && role?.position !== 'unknown';
  const isSupport = roleCertain && (role?.position === 'soft-support' || role?.position === 'hard-support');
  const dutiesObserved = !roleCertain ? null : isSupport ? visionShare(player, team) : percentile(player, 'tower_damage');
  const dutiesDeficit = finite(dutiesObserved)
    ? isSupport ? clamp(1 - dutiesObserved * 2, 0, 1) : 1 - dutiesObserved
    : null;
  const throwResult = throwEvidence(player, match);
  const abandonAvailable = finite(player.leaverStatus) || finite(player.abandons);
  const abandoned = (player.leaverStatus || 0) > 1 || (player.abandons || 0) > 0;

  const components = [
    component('deaths', weights.deaths, finite(deathPct), weights.deaths * (1 - deathPct), deathPct, 'opendota.benchmarks.deaths_per_min', finite(deathPct) ? [{ percentile: deathPct, deaths: player.deaths ?? null }] : []),
    component('economy', weights.economy, finite(economyPct), weights.economy * (1 - economyPct), economyPct, 'opendota.benchmarks.economy', finite(economyPct) ? [{ percentile: economyPct, gpm: player.gpm ?? null, lastHits: player.lastHits ?? null }] : []),
    component('damage', weights.damage, finite(damagePct), weights.damage * (1 - damagePct), damagePct, 'opendota.benchmarks.hero_damage_per_min', finite(damagePct) ? [{ percentile: damagePct, heroDamage: player.heroDamage ?? null }] : []),
    component('participation', weights.participation, finite(participation), weights.participation * (1 - participation), participation, 'match.teamfight_participation', finite(participation) ? [{ participation }] : []),
    component('role-duties', weights['role-duties'], finite(dutiesDeficit), weights['role-duties'] * dutiesDeficit, dutiesObserved, isSupport ? 'match.team_vision_share' : 'opendota.benchmarks.tower_damage', finite(dutiesObserved) ? [isSupport ? { share: dutiesObserved, obsPlaced: player.obsPlaced ?? null, senPlaced: player.senPlaced ?? null } : { percentile: dutiesObserved, towerDamage: player.towerDamage ?? null }] : []),
    component('throw', weights.throw, throwResult.available, weights.throw * throwResult.ratio, throwResult.ratio, 'match.deaths_during_networth_lead', throwResult.evidence),
    component('abandon', weights.abandon, abandonAvailable, abandoned ? weights.abandon : 0, abandoned, 'match.leaver_status', abandonAvailable ? [{ abandoned, leaverStatus: player.leaverStatus ?? null, abandons: player.abandons ?? null }] : []),
  ];
  const normalized = normalizeScore(components);
  return { ...normalized, components, flags: abandoned ? ['abandon'] : [], role, profile: profileFor(match), modelVersion: MODEL_VERSIONS.ruin };
}
