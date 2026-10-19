const STANDARD_GAME_MODES = new Set([1, 2, 3, 4, 5, 12, 16, 19, 22]);

export function isFiniteMetric(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function metric(...values) {
  const value = values.find(isFiniteMetric);
  return value ?? null;
}

function series(value, maxLength = 512) {
  if (!Array.isArray(value)) return null;
  const normalized = value.slice(0, maxLength).map((item) => (isFiniteMetric(item) ? item : null));
  return normalized.some(isFiniteMetric) ? normalized : null;
}

function safeString(value, maxLength = 96) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function boundedEvents(value, mapper, limit = 256) {
  if (!Array.isArray(value)) return null;
  return value.slice(0, limit).map(mapper).filter(Boolean);
}

const BENCHMARK_KEYS = new Set([
  'gold_per_min', 'xp_per_min', 'kills_per_min', 'deaths_per_min',
  'assists_per_min', 'last_hits_per_min', 'denies_per_min',
  'hero_damage_per_min', 'hero_healing_per_min', 'tower_damage',
]);

function benchmarks(value) {
  if (!value || typeof value !== 'object') return null;
  const normalized = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!BENCHMARK_KEYS.has(key) || !entry || typeof entry !== 'object') continue;
    const raw = metric(entry.raw);
    const percentile = metric(entry.pct, entry.percentile);
    if (raw === null || percentile === null || percentile < 0 || percentile > 1) continue;
    normalized[key] = { raw, percentile };
  }
  return Object.keys(normalized).length ? normalized : null;
}

function deathEvents(value) {
  return boundedEvents(value, (event) => {
    if (!event || typeof event !== 'object' || !isFiniteMetric(event.time)) return null;
    return {
      time: event.time,
      goldFed: metric(event.gold_fed),
      goldLost: metric(event.gold_lost),
      timeDead: metric(event.time_dead),
    };
  });
}

function keyedEvents(value) {
  return boundedEvents(value, (event) => {
    if (!event || typeof event !== 'object' || !isFiniteMetric(event.time)) return null;
    const key = safeString(event.key);
    return key ? { time: event.time, key } : null;
  });
}

function buybackEvents(value) {
  return boundedEvents(value, (event) => {
    if (!event || typeof event !== 'object' || !isFiniteMetric(event.time)) return null;
    return { time: event.time, slot: metric(event.slot), playerSlot: metric(event.player_slot) };
  });
}

function mapEvents(value) {
  return boundedEvents(value, (event) => {
    if (!event || typeof event !== 'object' || !isFiniteMetric(event.time)) return null;
    return { time: event.time, type: safeString(event.type), x: metric(event.x), y: metric(event.y) };
  });
}

function runeEvents(value) {
  return boundedEvents(value, (event) => {
    if (!event || typeof event !== 'object' || !isFiniteMetric(event.time)) return null;
    return { time: event.time, key: metric(event.key) };
  });
}

function objectives(value) {
  return boundedEvents(value, (event) => {
    if (!event || typeof event !== 'object' || !isFiniteMetric(event.time)) return null;
    return { time: event.time, type: safeString(event.type), slot: metric(event.slot), key: safeString(event.key, 128) };
  });
}

function teamfights(value) {
  return boundedEvents(value, (fight) => {
    if (!fight || typeof fight !== 'object' || !isFiniteMetric(fight.start)) return null;
    return {
      start: fight.start,
      end: metric(fight.end),
      lastDeath: metric(fight.last_death),
      players: Array.isArray(fight.players) ? fight.players.slice(0, 10).map((player) => ({
        deaths: metric(player?.deaths),
        damage: metric(player?.damage),
        healing: metric(player?.healing),
        goldDelta: metric(player?.gold_delta),
        xpDelta: metric(player?.xp_delta),
      })) : [],
    };
  });
}

function unique(values) {
  return [...new Set(values)];
}

function normalizePlayer(player, index, warnings, duration) {
  if (!player || typeof player !== 'object' || !isFiniteMetric(player.player_slot)) return null;
  const team = player.player_slot < 128 ? 'radiant' : 'dire';
  const heroId = metric(player.hero_id);
  if (heroId === null || heroId <= 0 || heroId > 200) warnings.push('unknown-hero');

  const timelineLimit = Math.max(2, Math.ceil(duration / 60) + 2);
  const itemSlots = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5].map((item) => metric(item));
  const normalized = {
    slot: player.player_slot,
    team,
    accountId: metric(player.account_id),
    heroId,
    personaname: typeof player.personaname === 'string' && player.personaname.trim()
      ? player.personaname.trim().slice(0, 64)
      : null,
    kills: metric(player.kills),
    deaths: metric(player.deaths),
    assists: metric(player.assists),
    gpm: metric(player.gold_per_min, player.gpm),
    xpm: metric(player.xp_per_min, player.xpm),
    kda: metric(player.kda),
    goldSpent: metric(player.gold_spent),
    lastHits: metric(player.last_hits),
    denies: metric(player.denies),
    level: metric(player.level),
    heroDamage: metric(player.hero_damage),
    towerDamage: metric(player.tower_damage),
    heroHealing: metric(player.hero_healing),
    obsPlaced: metric(player.obs_placed),
    senPlaced: metric(player.sen_placed),
    campsStacked: metric(player.camps_stacked),
    stuns: metric(player.stuns),
    buybackCount: metric(player.buyback_count),
    leaverStatus: metric(player.leaver_status),
    abandons: metric(player.abandons),
    laneRole: metric(player.lane_role),
    lane: metric(player.lane),
    positionEstimate: metric(player.position_est),
    isRoaming: typeof player.is_roaming === 'boolean' ? player.is_roaming : null,
    teamfightParticipation: metric(player.teamfight_participation),
    netWorth: metric(player.net_worth),
    gold_t: series(player.gold_t, timelineLimit),
    networth_t: series(player.networth_t, timelineLimit),
    xp_t: series(player.xp_t, timelineLimit),
    heroDamage_t: series(player.hero_damage_t, timelineLimit),
    deathsLog: deathEvents(player.deaths_log),
    killsLog: keyedEvents(player.kills_log),
    buybackLog: buybackEvents(player.buyback_log),
    purchaseLog: keyedEvents(player.purchase_log),
    obsLog: mapEvents(player.obs_log),
    senLog: mapEvents(player.sen_log),
    runesLog: runeEvents(player.runes_log),
    benchmarks: benchmarks(player.benchmarks),
    itemSlots,
    items: itemSlots,
    backpack: [player.backpack_0, player.backpack_1, player.backpack_2].map((item) => metric(item)),
    neutralItem: metric(player.item_neutral),
    neutralItem2: metric(player.item_neutral2),
    aghanimsScepter: Boolean(player.aghanims_scepter),
    aghanimsShard: Boolean(player.aghanims_shard),
    purchase: player.purchase && typeof player.purchase === 'object' ? { ...player.purchase } : null,
    index,
  };

  if ([normalized.kills, normalized.deaths, normalized.assists, normalized.gpm, normalized.heroDamage].some((value) => value === null)) {
    warnings.push('partial-match-data');
  }
  return normalized;
}

export function normalizeMatch(raw, options = {}) {
  const errors = [];
  const warnings = [];
  if (!raw || typeof raw !== 'object') return { ok: false, match: null, warnings, errors: ['invalid-response'] };
  if (!isFiniteMetric(raw.duration) || raw.duration < 300) errors.push('match-too-short');
  if (!Array.isArray(raw.players) || raw.players.length < 2) errors.push('not-enough-players');
  if (errors.length) return { ok: false, match: null, warnings, errors: unique(errors) };

  const players = raw.players.map((player, index) => normalizePlayer(player, index, warnings, raw.duration)).filter(Boolean);
  const radiant = players.filter((player) => player.team === 'radiant');
  const dire = players.filter((player) => player.team === 'dire');
  if (players.length < 2) errors.push('not-enough-players');
  if (!radiant.length || !dire.length) errors.push('teams-not-separated');
  if (players.length !== 10 || radiant.length !== 5 || dire.length !== 5) warnings.push('unusual-player-count');
  if (!raw.version) warnings.push('unparsed-or-partial');
  if (errors.length) return { ok: false, match: null, warnings: unique(warnings), errors: unique(errors) };

  let mode;
  if (raw.game_mode === 23) mode = 'turbo';
  else if (raw.lobby_type === 7) mode = 'ranked';
  else if (STANDARD_GAME_MODES.has(raw.game_mode)) mode = 'standard';
  else {
    mode = 'generic';
    warnings.push('unsupported-mode');
  }
  const match = {
    source: options.source === 'demo' || raw.source === 'demo' ? 'demo' : 'opendota',
    matchId: metric(raw.match_id),
    duration: raw.duration,
    startTime: metric(raw.start_time),
    patch: metric(raw.patch),
    region: metric(raw.region),
    cluster: metric(raw.cluster),
    skill: metric(raw.skill),
    avgRankTier: metric(raw.avg_rank_tier),
    gameMode: metric(raw.game_mode),
    lobbyType: metric(raw.lobby_type),
    mode,
    radiantWin: typeof raw.radiant_win === 'boolean' ? raw.radiant_win : null,
    radiantScore: metric(raw.radiant_score),
    direScore: metric(raw.dire_score),
    radiantGoldAdv: series(raw.radiant_gold_adv, Math.ceil(raw.duration / 60) + 2),
    radiantXpAdv: series(raw.radiant_xp_adv, Math.ceil(raw.duration / 60) + 2),
    objectives: objectives(raw.objectives) || [],
    teamfights: teamfights(raw.teamfights) || [],
    parsed: Boolean(raw.version),
    players,
  };
  return { ok: true, match, warnings: unique(warnings), errors: [] };
}
