import { MODEL_VERSIONS } from '../data/scoring-config.js';
import { getConstantHero, getConstantItem, getMatchLabel } from '../data/match-constants.js';
import { getHero } from '../data/heroes.js';
import { assessConclusionQuality } from './confidence.js';
import { buildDataAvailability } from './data-availability.js';
import { calculateImpactScore } from './impact-score.js';
import { buildPlayerInsights } from './insights.js';
import { buildMatchNarrative } from './narrative.js';
import { buildRecommendations } from './recommendations.js';
import { inferRole } from './roles.js';
import { calculateRuinScore } from './ruin-score.js';
import { buildTeamSummaries, compareTeams } from './team-summary.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function heroFor(constants, id) {
  return constants?.heroes?.has(Number(id)) ? getConstantHero(constants, id) : getHero(id);
}

function itemFor(constants, id) {
  return finite(id) && id > 0 ? getConstantItem(constants, id) : null;
}

function playerView(player, match, team, constants) {
  const hero = heroFor(constants, player.heroId);
  const role = inferRole(player, team, hero);
  const context = { player, team, match, role };
  const ruin = calculateRuinScore(context);
  const impact = calculateImpactScore(context);
  const insights = buildPlayerInsights({ player, match, role, ruin, impact });
  return {
    ...player,
    name: player.personaname,
    heroName: hero.name,
    heroImage: hero.image,
    heroRoles: hero.roles,
    role,
    items: (player.itemSlots || player.items || []).map((id) => itemFor(constants, id)),
    backpackItems: (player.backpack || []).map((id) => itemFor(constants, id)),
    neutralItemData: itemFor(constants, player.neutralItem),
    ruinScore: ruin.score,
    impactScore: impact.score,
    ruin,
    impact,
    insights,
    recommendations: buildRecommendations(ruin),
  };
}

export function buildAnalysis(match, constants = null, locale = 'ru', warnings = []) {
  const radiant = match.players.filter((player) => player.team === 'radiant');
  const dire = match.players.filter((player) => player.team === 'dire');
  const players = [
    ...radiant.map((player) => playerView(player, match, radiant, constants)),
    ...dire.map((player) => playerView(player, match, dire, constants)),
  ];
  const ruinSorted = players.filter((player) => player.ruinScore !== null).sort((a, b) => b.ruinScore - a.ruinScore || a.slot - b.slot);
  const impactSorted = players.filter((player) => player.impactScore !== null).sort((a, b) => b.impactScore - a.impactScore || a.slot - b.slot);
  const leaders = { ruin: ruinSorted[0] || null, impact: impactSorted[0] || null };
  const scoreCoverages = players.flatMap((player) => [player.ruin.dataCoverage, player.impact.dataCoverage]).filter(finite);
  const dataCoverage = scoreCoverages.length ? Math.round(scoreCoverages.reduce((sum, value) => sum + value, 0) / scoreCoverages.length) : 0;
  const quality = assessConclusionQuality({
    dataCoverage,
    roleCertainty: leaders.ruin?.role.certainty,
    leadGap: leaders.ruin && ruinSorted[1] ? leaders.ruin.ruinScore - ruinSorted[1].ruinScore : 100,
  });
  const availability = buildDataAvailability(match);
  const summaries = buildTeamSummaries(match);
  const comparisons = compareTeams(summaries);
  const narrative = buildMatchNarrative({ match, comparisons, availability, ruinLeader: leaders.ruin, impactLeader: leaders.impact }, locale);
  return {
    source: match.source,
    matchId: match.matchId,
    duration: match.duration,
    startTime: match.startTime,
    mode: match.mode,
    radiantWin: match.radiantWin,
    radiantScore: match.radiantScore,
    direScore: match.direScore,
    metadata: {
      mode: getMatchLabel(constants, 'gameModes', match.gameMode) || match.mode,
      lobby: getMatchLabel(constants, 'lobbies', match.lobbyType),
      region: getMatchLabel(constants, 'regions', match.region),
      patch: getMatchLabel(constants, 'patches', match.patch) || (match.patch == null ? null : String(match.patch)),
    },
    warnings: [...warnings],
    quality,
    dataCoverage,
    availability,
    summaries,
    comparisons,
    narrative,
    modelVersions: MODEL_VERSIONS,
    leaders,
    teams: [
      { id: 'radiant', label: 'Radiant', players: players.filter((player) => player.team === 'radiant') },
      { id: 'dire', label: 'Dire', players: players.filter((player) => player.team === 'dire') },
    ],
    match,
  };
}
