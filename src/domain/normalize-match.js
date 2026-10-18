const KNOWN_GAME_MODES = Object.freeze({ 23: 'turbo' });

export function isFiniteMetric(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function metric(...values) {
  const value = values.find(isFiniteMetric);
  return value ?? null;
}

function series(value) {
  if (!Array.isArray(value)) return null;
  const normalized = value.map((item) => (isFiniteMetric(item) ? item : null));
  return normalized.some(isFiniteMetric) ? normalized : null;
}

function unique(values) {
  return [...new Set(values)];
}

function normalizePlayer(player, index, warnings) {
  if (!player || typeof player !== 'object' || !isFiniteMetric(player.player_slot)) return null;
  const team = player.player_slot < 128 ? 'radiant' : 'dire';
  const heroId = metric(player.hero_id);
  if (heroId === null || heroId <= 0 || heroId > 200) warnings.push('unknown-hero');

  const normalized = {
    slot: player.player_slot,
    team,
    heroId,
    personaname: typeof player.personaname === 'string' && player.personaname.trim()
      ? player.personaname.trim().slice(0, 64)
      : null,
    kills: metric(player.kills),
    deaths: metric(player.deaths),
    assists: metric(player.assists),
    gpm: metric(player.gold_per_min, player.gpm),
    xpm: metric(player.xp_per_min, player.xpm),
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
    isRoaming: typeof player.is_roaming === 'boolean' ? player.is_roaming : null,
    gold_t: series(player.gold_t),
    xp_t: series(player.xp_t),
    heroDamage_t: series(player.hero_damage_t),
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

  const players = raw.players.map((player, index) => normalizePlayer(player, index, warnings)).filter(Boolean);
  const radiant = players.filter((player) => player.team === 'radiant');
  const dire = players.filter((player) => player.team === 'dire');
  if (players.length < 2) errors.push('not-enough-players');
  if (!radiant.length || !dire.length) errors.push('teams-not-separated');
  if (players.length !== 10 || radiant.length !== 5 || dire.length !== 5) warnings.push('unusual-player-count');
  if (!raw.version) warnings.push('unparsed-or-partial');
  if (errors.length) return { ok: false, match: null, warnings: unique(warnings), errors: unique(errors) };

  const mode = KNOWN_GAME_MODES[raw.game_mode] || (raw.lobby_type === 7 ? 'ranked' : 'standard');
  const match = {
    source: options.source === 'demo' || raw.source === 'demo' ? 'demo' : 'opendota',
    matchId: metric(raw.match_id),
    duration: raw.duration,
    startTime: metric(raw.start_time),
    patch: metric(raw.patch),
    gameMode: metric(raw.game_mode),
    lobbyType: metric(raw.lobby_type),
    mode,
    radiantWin: typeof raw.radiant_win === 'boolean' ? raw.radiant_win : null,
    radiantScore: metric(raw.radiant_score),
    direScore: metric(raw.dire_score),
    parsed: Boolean(raw.version),
    players,
  };
  return { ok: true, match, warnings: unique(warnings), errors: [] };
}
