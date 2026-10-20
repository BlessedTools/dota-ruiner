const demo = {
  source: 'demo',
  match_id: 7890123456,
  duration: 2520,
  start_time: 1760846400,
  radiant_win: true,
  radiant_score: 38,
  dire_score: 23,
  game_mode: 22,
  lobby_type: 7,
  version: 21,
  players: [
    { player_slot: 0, hero_id: 6, personaname: 'Demo Carry', kills: 9, deaths: 2, assists: 11, last_hits: 412, gold_per_min: 612, xp_per_min: 688, level: 25, hero_damage: 32134, tower_damage: 4230, obs_placed: 0, sen_placed: 0, camps_stacked: 0, gold_t: [0, 680, 1510, 2580, 4150, 6530, 9220], xp_t: [0, 520, 1260, 2410, 3960, 5850, 7810] },
    { player_slot: 1, hero_id: 74, personaname: 'Demo Mid', kills: 11, deaths: 4, assists: 9, last_hits: 298, gold_per_min: 578, xp_per_min: 652, level: 24, hero_damage: 38450, tower_damage: 1800, gold_t: [0, 620, 1430, 2390, 3820, 5890, 8610], xp_t: [0, 590, 1390, 2670, 4240, 6190, 8020] },
    { player_slot: 2, hero_id: 2, kills: 4, deaths: 5, assists: 14, last_hits: 201, gold_per_min: 462, xp_per_min: 510, level: 21, hero_damage: 18220, tower_damage: 1100, gold_t: [0, 550, 1190, 1980, 3150, 4710, 6820], xp_t: [0, 480, 1120, 2130, 3390, 4870, 6360] },
    { player_slot: 3, hero_id: 5, kills: 1, deaths: 6, assists: 18, last_hits: 34, gold_per_min: 338, xp_per_min: 412, level: 19, hero_damage: 9230, tower_damage: 120, hero_healing: 2890, obs_placed: 18, sen_placed: 9, camps_stacked: 4 },
    { player_slot: 4, hero_id: 31, kills: 2, deaths: 4, assists: 19, last_hits: 18, gold_per_min: 352, xp_per_min: 398, level: 18, hero_damage: 10120, tower_damage: 80, hero_healing: 3200, obs_placed: 14, sen_placed: 7, camps_stacked: 3 },
    { player_slot: 128, hero_id: 14, personaname: 'Demo Ruiner', kills: 2, deaths: 12, assists: 3, last_hits: 88, gold_per_min: 268, xp_per_min: 298, level: 16, hero_damage: 8230, tower_damage: 210, obs_placed: 1, sen_placed: 1, camps_stacked: 0, buyback_count: 2 },
    { player_slot: 129, hero_id: 42, kills: 8, deaths: 7, assists: 5, last_hits: 342, gold_per_min: 545, xp_per_min: 598, level: 22, hero_damage: 24800, tower_damage: 3200 },
    { player_slot: 130, hero_id: 11, kills: 6, deaths: 6, assists: 7, last_hits: 276, gold_per_min: 512, xp_per_min: 565, level: 21, hero_damage: 26100, tower_damage: 2100 },
    { player_slot: 131, hero_id: 26, kills: 1, deaths: 5, assists: 11, last_hits: 22, gold_per_min: 342, xp_per_min: 405, level: 18, hero_damage: 7890, tower_damage: 60, obs_placed: 11, sen_placed: 6, camps_stacked: 2 },
    { player_slot: 132, hero_id: 43, kills: 3, deaths: 8, assists: 9, last_hits: 41, gold_per_min: 328, xp_per_min: 382, level: 17, hero_damage: 10420, tower_damage: 90, hero_healing: 4400, obs_placed: 7, sen_placed: 4, camps_stacked: 1 }
  ]
};

function deepFreeze(value) {
  Object.freeze(value);
  Object.values(value).forEach((item) => {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) deepFreeze(item);
  });
  return value;
}

export const DEMO_MATCH = deepFreeze(demo);

export function createDemoAnalysisInput() {
  const copy = structuredClone(DEMO_MATCH);
  copy.players.forEach((player, index) => {
    const minutes = copy.duration / 60;
    const isStandout = index === 0 || index === 1;
    const isStruggling = index === 5;
    const base = isStandout ? 0.82 : isStruggling ? 0.12 : Math.max(0.28, 0.68 - index * 0.025);
    const deathPercentile = isStruggling ? 0.96 : Math.min(0.86, Math.max(0.12, (player.deaths || 0) / 10));
    player.position_est = (index % 5) + 1;
    player.teamfight_participation = Math.min(1, ((player.kills || 0) + (player.assists || 0)) / Math.max(1, index < 5 ? copy.radiant_score : copy.dire_score));
    player.networth_t = player.gold_t?.map((value) => value + 600) || null;
    player.net_worth = player.networth_t?.at(-1) ?? Math.round(player.gold_per_min * minutes);
    player.benchmarks = {
      gold_per_min: { raw: player.gold_per_min, pct: base },
      xp_per_min: { raw: player.xp_per_min, pct: Math.min(0.98, base + 0.03) },
      last_hits_per_min: { raw: player.last_hits / minutes, pct: base },
      hero_damage_per_min: { raw: player.hero_damage / minutes, pct: isStruggling ? 0.1 : base },
      kills_per_min: { raw: player.kills / minutes, pct: base },
      assists_per_min: { raw: player.assists / minutes, pct: Math.min(0.98, base + 0.06) },
      deaths_per_min: { raw: player.deaths / minutes, pct: deathPercentile },
      tower_damage: { raw: player.tower_damage, pct: isStruggling ? 0.08 : base },
    };
  });
  return copy;
}
