const METRICS = Object.freeze([
  'kills', 'deaths', 'assists', 'netWorth', 'gpm', 'xpm',
  'heroDamage', 'towerDamage', 'heroHealing', 'lastHits', 'denies',
]);

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function aggregateTeam(id, players) {
  const totals = {};
  const averages = {};
  const observed = {};
  for (const metric of METRICS) {
    const values = players.map((player) => player[metric]).filter(finite);
    observed[metric] = values.length;
    totals[metric] = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    averages[metric] = values.length ? totals[metric] / values.length : null;
  }
  return { id, playerCount: players.length, totals, averages, observed };
}

export function buildTeamSummaries(match) {
  const players = Array.isArray(match?.players) ? match.players : [];
  return ['radiant', 'dire'].map((id) => aggregateTeam(id, players.filter((player) => player.team === id)));
}

export function compareTeams(summaries) {
  const radiant = summaries?.find((team) => team.id === 'radiant');
  const dire = summaries?.find((team) => team.id === 'dire');
  return METRICS.map((metric) => {
    const radiantValue = radiant?.totals?.[metric] ?? null;
    const direValue = dire?.totals?.[metric] ?? null;
    const complete = Boolean(
      radiant?.playerCount
      && dire?.playerCount
      && radiant.observed[metric] === radiant.playerCount
      && dire.observed[metric] === dire.playerCount,
    );
    const comparable = complete && finite(radiantValue) && finite(direValue);
    const leader = !comparable || radiantValue === direValue ? null : radiantValue > direValue ? 'radiant' : 'dire';
    const delta = comparable ? Math.abs(radiantValue - direValue) : null;
    const lower = comparable ? Math.min(radiantValue, direValue) : null;
    const ratio = comparable && lower > 0 ? Math.max(radiantValue, direValue) / lower : null;
    return { metric, radiant: radiantValue, dire: direValue, leader, delta, ratio, complete };
  });
}
