const METRICS_RU = Object.freeze({
  kills: 'убийств', netWorth: 'итогового net worth', gpm: 'суммарного GPM', xpm: 'суммарного XPM',
  heroDamage: 'урона героям', towerDamage: 'урона строениям', lastHits: 'добитых крипов', denies: 'денайев',
});
const METRICS_EN = Object.freeze({
  kills: 'kills', netWorth: 'final net worth', gpm: 'combined GPM', xpm: 'combined XPM',
  heroDamage: 'hero damage', towerDamage: 'tower damage', lastHits: 'last hits', denies: 'denies',
});
const LIMITS = Object.freeze({
  ru: {
    'economy-timeline-missing': 'OpenDota не предоставил поминутную экономику.',
    'combat-timeline-missing': 'OpenDota не предоставил поминутный урон.',
    'teamfights-missing': 'OpenDota не предоставил разбор командных драк.',
    'objectives-missing': 'OpenDota не предоставил журнал объектов.',
    'objectives-partial': 'Журнал объектов OpenDota доступен частично.',
    'support-missing': 'Данные о вижене и стаках отсутствуют.',
    'purchases-missing': 'Журнал покупок и байбэков отсутствует.',
  },
  en: {
    'economy-timeline-missing': 'OpenDota did not provide minute-by-minute economy data.',
    'combat-timeline-missing': 'OpenDota did not provide minute-by-minute damage data.',
    'teamfights-missing': 'OpenDota did not provide teamfight analysis.',
    'objectives-missing': 'OpenDota did not provide the objective log.',
    'objectives-partial': 'The OpenDota objective log is partial.',
    'support-missing': 'Vision and stacking data are unavailable.',
    'purchases-missing': 'Purchase and buyback logs are unavailable.',
  },
});

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const format = (value, locale) => new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(value);

function resultLead(match, locale) {
  const winner = match?.radiantWin === true ? 'Radiant' : match?.radiantWin === false ? 'Dire' : null;
  if (!winner || !finite(match.radiantScore) || !finite(match.direScore)) return locale === 'ru' ? 'Результат матча доступен частично.' : 'The match result is partially available.';
  const score = winner === 'Radiant' ? `${match.radiantScore}:${match.direScore}` : `${match.direScore}:${match.radiantScore}`;
  return locale === 'ru' ? `${winner} победили со счётом ${score}.` : `${winner} won ${score}.`;
}

function comparisonSentence(comparison, locale) {
  if (!comparison?.complete || !comparison.leader || !finite(comparison.ratio) || comparison.ratio <= 1) return null;
  const label = (locale === 'ru' ? METRICS_RU : METRICS_EN)[comparison.metric];
  if (!label || !finite(comparison.radiant) || !finite(comparison.dire)) return null;
  const team = comparison.leader === 'radiant' ? 'Radiant' : 'Dire';
  const percent = Math.round((comparison.ratio - 1) * 100);
  const leaderValue = comparison.leader === 'radiant' ? comparison.radiant : comparison.dire;
  const otherValue = comparison.leader === 'radiant' ? comparison.dire : comparison.radiant;
  return locale === 'ru'
    ? `${team} набрали на ${percent}% больше ${label} (${format(leaderValue, locale)} против ${format(otherValue, locale)}).`
    : `${team} recorded ${percent}% more ${label} (${format(leaderValue, locale)} versus ${format(otherValue, locale)}).`;
}

function leaderSentence(player, kind, locale) {
  if (!player) return null;
  const name = player.name || player.heroName;
  const survival = player.insights?.find((item) => item.id === 'survival-low');
  const economy = player.insights?.find((item) => item.id === 'economy-high');
  if (kind === 'ruin' && survival) {
    return locale === 'ru'
      ? `${name}: ${survival.evidence.deaths} смертей и ${survival.evidence.percentile}-й перцентиль выживаемости — главный наблюдаемый отрицательный фактор.`
      : `${name}: ${survival.evidence.deaths} deaths and the ${survival.evidence.percentile}th survival percentile were the clearest observed negative factor.`;
  }
  if (kind === 'impact' && economy) {
    return locale === 'ru'
      ? `${name}: ${economy.evidence.gpm} GPM и ${economy.evidence.percentile}-й экономический перцентиль — главный наблюдаемый положительный фактор.`
      : `${name}: ${economy.evidence.gpm} GPM and the ${economy.evidence.percentile}th economy percentile were the clearest observed positive factor.`;
  }
  return null;
}

export function buildMatchNarrative(context = {}, locale = 'ru') {
  const language = locale === 'en' ? 'en' : 'ru';
  const comparisons = (context.comparisons || []).map((item) => comparisonSentence(item, language)).filter(Boolean).slice(0, 3);
  const leaders = [leaderSentence(context.ruinLeader, 'ruin', language), leaderSentence(context.impactLeader, 'impact', language)].filter(Boolean);
  const limitations = Object.values(context.availability?.categories || {})
    .filter((category) => category?.status !== 'available')
    .map((category) => LIMITS[language][category.reason])
    .filter(Boolean);
  return { lead: resultLead(context.match, language), paragraphs: [...comparisons, ...leaders], limitations: [...new Set(limitations)] };
}
