const observed = (value) => value !== null && value !== undefined;

function coverage(players, predicate, reasons) {
  const count = players.filter(predicate).length;
  const total = players.length;
  if (count === total && total > 0) return { status: 'available', reason: reasons.all, observed: count, total };
  if (count > 0) return { status: 'partial', reason: reasons.some, observed: count, total };
  return { status: 'missing', reason: reasons.none, observed: 0, total };
}

function withoutCounts(category) {
  const { observed: count, total, ...summary } = category;
  return count === total || count === 0 ? summary : category;
}

export function buildDataAvailability(match) {
  const players = Array.isArray(match?.players) ? match.players : [];
  const categories = {
    summary: players.length > 1
      ? { status: 'available', reason: 'summary-observed' }
      : { status: 'missing', reason: 'summary-missing' },
    benchmarks: withoutCounts(coverage(players, (player) => player.benchmarks && Object.keys(player.benchmarks).length > 0, {
      all: 'benchmarks-all-players', some: 'benchmarks-some-players', none: 'benchmarks-missing',
    })),
    economyTimeline: withoutCounts(coverage(players, (player) => Array.isArray(player.networth_t), {
      all: 'networth-all-players', some: 'networth-some-players', none: 'economy-timeline-missing',
    })),
    combatTimeline: withoutCounts(coverage(players, (player) => Array.isArray(player.heroDamage_t), {
      all: 'combat-timeline-all-players', some: 'combat-timeline-some-players', none: 'combat-timeline-missing',
    })),
    teamfights: match?.teamfights?.length
      ? { status: 'available', reason: 'teamfights-observed' }
      : { status: 'missing', reason: 'teamfights-missing' },
    objectives: match?.objectives?.length
      ? { status: 'available', reason: 'objectives-observed' }
      : { status: 'missing', reason: 'objectives-missing' },
    support: withoutCounts(coverage(players, (player) => [player.obsPlaced, player.senPlaced, player.campsStacked].some(observed), {
      all: 'support-all-players', some: 'support-some-players', none: 'support-missing',
    })),
    purchases: withoutCounts(coverage(players, (player) => (player.purchase && Object.keys(player.purchase).length > 0) || player.purchaseLog?.length > 0, {
      all: 'purchases-all-players', some: 'purchases-some-players', none: 'purchases-missing',
    })),
  };

  const statuses = Object.values(categories).map((category) => category.status);
  const overall = !match?.parsed
    ? 'basic'
    : statuses.every((status) => status === 'available') ? 'complete' : 'partial';
  return { overall, categories };
}
