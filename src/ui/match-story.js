import { el, formatNumber } from './dom.js';

const METRIC_LABELS = { kills: ['Убийства', 'Kills'], netWorth: ['Net worth', 'Net worth'], gpm: ['Суммарный GPM', 'Combined GPM'], xpm: ['Суммарный XPM', 'Combined XPM'], heroDamage: ['Урон героям', 'Hero damage'], towerDamage: ['Урон строениям', 'Tower damage'], heroHealing: ['Лечение', 'Healing'], lastHits: ['Добитые крипы', 'Last hits'], denies: ['Денаи', 'Denies'] };

function comparisonRow(comparison, locale) {
  const maximum = Math.max(comparison.radiant || 0, comparison.dire || 0, 1);
  const ru = locale === 'ru';
  return el('div', { className: 'team-comparison', attrs: { 'data-team-comparison': comparison.metric } }, [
    el('div', { className: 'team-comparison__heading' }, [
      el('strong', { text: METRIC_LABELS[comparison.metric]?.[ru ? 0 : 1] || comparison.metric }),
      el('span', { text: comparison.complete ? `${formatNumber(comparison.radiant, locale)} : ${formatNumber(comparison.dire, locale)}` : (ru ? 'Неполные данные' : 'Partial data') }),
    ]),
    el('div', { className: 'team-comparison__track' }, [
      el('span', { className: 'team-comparison__radiant', attrs: { style: `--value:${Math.round(((comparison.radiant || 0) / maximum) * 100)}%`, 'aria-label': `Radiant ${formatNumber(comparison.radiant, locale)}` } }),
      el('span', { className: 'team-comparison__dire', attrs: { style: `--value:${Math.round(((comparison.dire || 0) / maximum) * 100)}%`, 'aria-label': `Dire ${formatNumber(comparison.dire, locale)}` } }),
    ]),
  ]);
}

export function renderMatchStory(analysis, i18n) {
  const ru = i18n.locale === 'ru';
  return el('section', { className: 'match-story', attrs: { 'data-match-story': '', 'aria-labelledby': 'match-story-title' } }, [
    el('div', { className: 'match-story__copy' }, [
      el('h2', { text: ru ? 'Что произошло в матче' : 'What happened in the match', attrs: { id: 'match-story-title' } }),
      el('p', { className: 'match-story__lead', text: analysis.narrative?.lead || '' }),
      ...(analysis.narrative?.paragraphs || []).map((paragraph) => el('p', { text: paragraph })),
      ...(analysis.narrative?.limitations || []).map((limitation) => el('p', { className: 'match-story__limitation', text: limitation })),
    ]),
    el('div', { className: 'match-story__comparisons' }, (analysis.comparisons || []).filter((item) => ['kills', 'netWorth', 'heroDamage', 'towerDamage', 'heroHealing'].includes(item.metric)).map((item) => comparisonRow(item, i18n.locale))),
  ]);
}
