import { el, formatNumber } from './dom.js';

const CATEGORY_LABELS = {
  summary: ['Итоговые показатели', 'Final metrics'], benchmarks: ['Перцентили героя', 'Hero percentiles'],
  economyTimeline: ['Поминутная экономика', 'Economy timeline'], combatTimeline: ['Поминутный урон', 'Damage timeline'],
  teamfights: ['Командные драки', 'Teamfights'], objectives: ['Объекты', 'Objectives'],
  support: ['Вижен и стаки', 'Vision and stacks'], purchases: ['Покупки и байбэки', 'Purchases and buybacks'],
};

export function renderMatchArena(analysis, i18n) {
  const ru = i18n.locale === 'ru';
  const radiantWon = analysis.radiantWin === true;
  const direWon = analysis.radiantWin === false;
  const winner = radiantWon ? 'Radiant' : direWon ? 'Dire' : null;
  const section = el('section', { className: 'match-arena match-board', attrs: { 'data-match-arena': '', 'aria-labelledby': 'match-result-title' } });
  const context = [analysis.metadata?.mode || analysis.mode, analysis.metadata?.lobby, analysis.metadata?.region, analysis.metadata?.patch ? `${ru ? 'Патч' : 'Patch'} ${analysis.metadata.patch}` : null].filter(Boolean);
  section.append(
    el('div', { className: 'match-arena__result' }, [
      el('p', { className: 'match-board__id', text: `${ru ? 'Матч' : 'Match'} #${analysis.matchId}` }),
      el('h2', { text: winner ? `${ru ? 'Победа' : 'Victory'} ${winner}` : i18n.t('labels.resultUnavailable'), attrs: { id: 'match-result-title' } }),
      el('p', { className: 'match-arena__meta', text: context.join(' · ') }),
    ]),
    el('div', { className: 'match-board__score', attrs: { 'data-match-score': '' } }, [
      el('span', { className: radiantWon ? 'team-name team-name--winner' : 'team-name', text: 'Radiant' }),
      el('strong', { text: formatNumber(analysis.radiantScore, i18n.locale) }), el('span', { className: 'score-separator', text: ':' }),
      el('strong', { text: formatNumber(analysis.direScore, i18n.locale) }), el('span', { className: direWon ? 'team-name team-name--winner' : 'team-name', text: 'Dire' }),
    ]),
    el('div', { className: `match-board__quality quality--${analysis.quality?.quality || 'insufficient'}` }, [
      el('strong', { text: i18n.t(`quality.${analysis.quality?.quality || 'insufficient'}`) }),
      el('span', { text: `${Math.floor((analysis.duration || 0) / 60)}:${String((analysis.duration || 0) % 60).padStart(2, '0')}` }),
    ]),
  );
  const availability = el('div', { className: 'availability-strip', attrs: { 'data-availability': '', 'aria-label': ru ? 'Доступность данных' : 'Data availability' } });
  for (const [key, category] of Object.entries(analysis.availability?.categories || {})) {
    const label = CATEGORY_LABELS[key]?.[ru ? 0 : 1] || key;
    const status = category.status === 'available' ? (ru ? 'есть' : 'available') : category.status === 'partial' ? (ru ? 'частично' : 'partial') : (ru ? 'нет' : 'missing');
    availability.append(el('span', { className: `availability-chip availability-chip--${category.status}`, text: `${label}: ${status}` }));
  }
  section.append(availability);
  return section;
}
