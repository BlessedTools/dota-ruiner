const STORAGE_KEY = 'dota-ruiner:history:v3';
const LEGACY_STORAGE_KEY = 'dota-ruiner:history:v2';
const SCHEMA_VERSION = 3;
const MAX_ENTRIES = 15;
const MAX_BYTES = 2_500_000;

function trimText(value, max = 160) {
  return typeof value === 'string' ? value.slice(0, max) : value ?? null;
}

function compactScore(score) {
  if (!score) return null;
  return {
    components: (score.components || []).map(({ id, available }) => ({ id, available: Boolean(available) })),
  };
}

function compactPlayer(player) {
  return {
    slot: player.slot,
    team: player.team,
    name: trimText(player.name, 64),
    heroName: trimText(player.heroName, 64),
    heroId: player.heroId,
    heroImage: trimText(player.heroImage),
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    gpm: player.gpm,
    netWorth: player.netWorth,
    role: player.role,
    ruinScore: player.ruinScore,
    impactScore: player.impactScore,
    ruin: compactScore(player.ruin),
    impact: compactScore(player.impact),
    recommendations: player.recommendations,
  };
}

function downsample(values, max = 60) {
  if (!Array.isArray(values)) return null;
  if (values.length <= max) return values.slice();
  const step = Math.ceil(values.length / max);
  return values.filter((_, index) => index % step === 0 || index === values.length - 1);
}

function plain(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

function compactNarrative(narrative) {
  if (!narrative) return null;
  return {
    lead: trimText(narrative.lead, 240),
    paragraphs: (narrative.paragraphs || []).slice(0, 8).map((item) => trimText(item, 320)),
    limitations: (narrative.limitations || []).slice(0, 8).map((item) => trimText(item, 240)),
  };
}

function migrateV2(item) {
  return {
    ...item,
    schemaVersion: SCHEMA_VERSION,
    cacheState: 'cached',
    metadata: {},
    summaries: null,
    comparisons: [],
    narrative: null,
    availability: { status: 'missing', reason: 'legacy-schema-v2' },
  };
}

export function toHistorySnapshot(analysis) {
  return {
    schemaVersion: SCHEMA_VERSION,
    source: 'opendota',
    cacheState: 'cached',
    matchId: analysis.matchId,
    savedAt: Date.now(),
    startTime: analysis.startTime,
    duration: analysis.duration,
    mode: analysis.mode,
    radiantWin: analysis.radiantWin,
    radiantScore: analysis.radiantScore,
    direScore: analysis.direScore,
    dataCoverage: analysis.dataCoverage,
    quality: analysis.quality,
    modelVersions: { ...analysis.modelVersions },
    warnings: [...(analysis.warnings || [])],
    metadata: plain(analysis.metadata, {}),
    summaries: plain(analysis.summaries),
    comparisons: plain(analysis.comparisons, []),
    availability: plain(analysis.availability, { status: 'missing', reason: 'not-recorded' }),
    narrative: compactNarrative(analysis.narrative),
    leaders: {
      ruin: analysis.leaders?.ruin ? compactPlayer(analysis.leaders.ruin) : null,
      impact: analysis.leaders?.impact ? compactPlayer(analysis.leaders.impact) : null,
    },
    teams: (analysis.teams || []).map((team) => ({ id: team.id, label: team.label, players: team.players.map(compactPlayer) })),
    timelines: (analysis.match?.players || []).map((player) => ({
      slot: player.slot,
      heroId: player.heroId,
      networth_t: downsample(player.networth_t),
      gold_t: downsample(player.gold_t),
      xp_t: downsample(player.xp_t),
      heroDamage_t: downsample(player.heroDamage_t),
    })).filter((player) => player.networth_t || player.gold_t || player.xp_t || player.heroDamage_t),
  };
}

export function createHistoryStore(storage = globalThis.localStorage) {
  function read() {
    try {
      const current = storage?.getItem?.(STORAGE_KEY);
      const legacy = current ? null : storage?.getItem?.(LEGACY_STORAGE_KEY);
      const data = JSON.parse(current || legacy || '[]');
      return Array.isArray(data)
        ? data.map((item) => item?.schemaVersion === 2 ? migrateV2(item) : item)
          .filter((item) => item?.schemaVersion === SCHEMA_VERSION && Number.isFinite(item.matchId)).slice(0, MAX_ENTRIES)
        : [];
    } catch {
      return [];
    }
  }

  function write(entries) {
    try {
      const next = entries.slice(0, MAX_ENTRIES);
      while (next.length && JSON.stringify(next).length > MAX_BYTES) next.pop();
      storage?.setItem?.(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  return {
    list: read,
    clear() { return write([]); },
    save(analysis) {
      if (!analysis || analysis.source !== 'opendota') return false;
      const snapshot = toHistorySnapshot(analysis);
      return write([snapshot, ...read().filter((item) => item.matchId !== snapshot.matchId)].slice(0, MAX_ENTRIES));
    },
    get(matchId) { return read().find((item) => item.matchId === Number(matchId)) || null; },
  };
}
