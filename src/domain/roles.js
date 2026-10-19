function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function inferRole(player, team = [], hero = null) {
  const evidence = [];
  if (player?.laneRole === 2) return { position: 'mid', certainty: 'high', evidence: ['lane-role:mid'] };
  if (player?.laneRole === 3) return { position: 'offlane', certainty: 'high', evidence: ['lane-role:offlane'] };
  if (player?.isRoaming === true) return { position: 'soft-support', certainty: 'high', evidence: ['is-roaming'] };
  if (player?.laneRole === 1 && hero?.roles?.includes('Carry')) return { position: 'safe-core', certainty: 'high', evidence: ['lane-role:safe', 'hero-role:carry'] };

  const wardEvidence = (finite(player?.obsPlaced) && player.obsPlaced >= 8) || (finite(player?.senPlaced) && player.senPlaced >= 6);
  if (wardEvidence && finite(player.gpm) && player.gpm < 360 && finite(player.lastHits) && player.lastHits < 80) {
    return { position: 'hard-support', certainty: 'high', evidence: ['support-activity', 'low-farm'] };
  }

  const supportItems = ['ward_observer', 'ward_sentry', 'smoke_of_deceit', 'dust', 'gem'];
  const supportPurchases = supportItems.reduce((sum, item) => sum + (finite(player?.purchase?.[item]) ? player.purchase[item] : 0), 0);
  if (supportPurchases >= 4 && finite(player.gpm) && player.gpm < 400 && finite(player.lastHits) && player.lastHits < 100) {
    return { position: 'hard-support', certainty: 'medium', evidence: ['support-item-purchases', 'low-farm'] };
  }

  const roles = hero?.roles || [];
  if (roles.length === 1 && roles[0] === 'Support') return { position: 'soft-support', certainty: 'medium', evidence: ['hero-role:support'] };
  if (roles.includes('Carry') && !roles.includes('Support') && finite(player?.gpm)) return { position: 'safe-core', certainty: 'medium', evidence: ['hero-role:carry'] };

  const comparable = team.filter((item) => finite(item.gpm)).sort((a, b) => b.gpm - a.gpm);
  const rank = comparable.indexOf(player);
  if (rank >= 0 && comparable.length >= 4) {
    evidence.push(`team-gpm-rank:${rank + 1}`);
    if (rank === 0) return { position: 'safe-core', certainty: 'low', evidence };
    if (rank === 1) return { position: 'mid', certainty: 'low', evidence };
    if (rank === 2) return { position: 'offlane', certainty: 'low', evidence };
    if (rank === 3) return { position: 'soft-support', certainty: 'low', evidence };
    return { position: 'hard-support', certainty: 'low', evidence };
  }
  return { position: 'unknown', certainty: 'unknown', evidence: ['insufficient-role-evidence'] };
}
