const METRIC_FIELDS = Object.freeze({
  networth: 'networth_t',
  gold: 'gold_t',
  xp: 'xp_t',
  heroDamage: 'heroDamage_t',
});

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function points(values) {
  if (!Array.isArray(values) || values.filter(finite).length < 2) return [];
  return values.map((value, minute) => ({ minute, value: finite(value) ? value : null }));
}

function teamTotals(players, field, team) {
  const members = players.filter((player) => player.team === team && Array.isArray(player[field]));
  const length = Math.max(0, ...members.map((player) => player[field].length));
  const totals = [];
  for (let minute = 0; minute < length; minute += 1) {
    const observed = members.map((player) => player[field][minute]).filter(finite);
    if (!observed.length) continue;
    totals.push({
      minute,
      value: observed.reduce((sum, value) => sum + value, 0),
      observedPlayers: observed.length,
    });
  }
  return totals;
}

function buildMetric(players, key, field) {
  const lines = players
    .map((player) => ({
      slot: player.slot,
      team: player.team,
      heroId: player.heroId,
      points: points(player[field]),
    }))
    .filter((line) => line.points.length);
  if (!lines.length) return null;
  return {
    key,
    field,
    source: `OpenDota · players[].${field}`,
    players: lines,
    teams: {
      radiant: teamTotals(players, field, 'radiant'),
      dire: teamTotals(players, field, 'dire'),
    },
  };
}

function advantage(values, field) {
  const observed = points(values);
  return observed.length ? { points: observed, source: `OpenDota · ${field}` } : null;
}

function observedEvents(match) {
  const events = [];
  for (const player of match?.players || []) {
    for (const death of player.deathsLog || []) {
      events.push({ type: 'death', time: death.time, slot: player.slot, heroId: player.heroId, ...death, source: 'OpenDota · players[].deaths_log' });
    }
    for (const buyback of player.buybackLog || []) {
      events.push({ type: 'buyback', time: buyback.time, slot: player.slot, heroId: player.heroId, ...buyback, source: 'OpenDota · players[].buyback_log' });
    }
  }
  for (const objective of match?.objectives || []) {
    const { type: objectiveType, ...details } = objective;
    events.push({ type: 'objective', objectiveType, ...details, source: 'OpenDota · objectives' });
  }
  for (const fight of match?.teamfights || []) {
    events.push({ type: 'teamfight', time: fight.start, ...fight, source: 'OpenDota · teamfights' });
  }
  return events
    .filter((event) => finite(event.time))
    .sort((left, right) => left.time - right.time || left.type.localeCompare(right.type));
}

export function buildTimeline(match) {
  const players = Array.isArray(match?.players) ? match.players : [];
  const metrics = Object.entries(METRIC_FIELDS)
    .map(([key, field]) => buildMetric(players, key, field))
    .filter(Boolean);
  return {
    metrics,
    advantages: {
      gold: advantage(match?.radiantGoldAdv, 'radiant_gold_adv'),
      xp: advantage(match?.radiantXpAdv, 'radiant_xp_adv'),
    },
    events: observedEvents(match),
    source: metrics.length || match?.objectives?.length || match?.teamfights?.length
      ? 'OpenDota · parsed match data'
      : null,
  };
}
