import { el, formatNumber, heroPortrait } from './dom.js';

function roleText(player, i18n) {
  if (!player?.role || player.role.position === 'unknown') return i18n.t('labels.unknownRole');
  return `${player.role.position} · ${player.role.certainty}`;
}

function insightText(insight, locale) {
  const e = insight?.evidence || {};
  const ru = locale === 'ru';
  if (insight.id === 'survival-low') return ru ? `${e.deaths} смертей · ${e.percentile}-й перцентиль выживаемости` : `${e.deaths} deaths · ${e.percentile}th survival percentile`;
  if (insight.id === 'economy-high') return `${e.gpm} GPM · ${e.percentile}${ru ? '-й экономический перцентиль' : 'th economy percentile'}`;
  if (insight.id === 'combat-high' || insight.id === 'combat-low') return ru ? `${formatNumber(e.heroDamage, locale)} урона героям · ${e.percentile}-й перцентиль` : `${formatNumber(e.heroDamage, locale)} hero damage · ${e.percentile}th percentile`;
  if (insight.id === 'objectives-high' || insight.id === 'objectives-low') return ru ? `${formatNumber(e.towerDamage, locale)} урона строениям · ${e.percentile}-й перцентиль` : `${formatNumber(e.towerDamage, locale)} tower damage · ${e.percentile}th percentile`;
  if (insight.id === 'vision-observed') return ru ? `Варды ${e.obsPlaced ?? '—'} · сентри ${e.senPlaced ?? '—'} · стаки ${e.campsStacked ?? '—'}` : `Wards ${e.obsPlaced ?? '—'} · sentries ${e.senPlaced ?? '—'} · stacks ${e.campsStacked ?? '—'}`;
  if (insight.id === 'abandon-confirmed') return ru ? 'OpenDota подтвердил лив' : 'OpenDota confirmed a leave';
  return insight.id;
}

function itemStrip(player) {
  const list = el('div', { className: 'duel__items', attrs: { 'aria-label': 'Items' } });
  for (const item of [...(player.items || []), player.neutralItemData].filter(Boolean)) {
    list.append(item.image
      ? el('img', { className: 'duel__item', attrs: { src: item.image, alt: '', width: 42, height: 30, loading: 'lazy', 'aria-label': item.name } })
      : el('span', { className: 'duel__item duel__item--fallback', text: item.name.slice(0, 2), attrs: { 'aria-label': item.name } }));
  }
  return list;
}

function leaderCard(kind, player, analysis, i18n) {
  const ru = i18n.locale === 'ru';
  const article = el('article', { className: `duel-card duel-card--${kind}` });
  if (!player) { article.append(el('h3', { text: i18n.t('quality.insufficient') })); return article; }
  const score = kind === 'ruin' ? player.ruinScore : player.impactScore;
  article.append(
    heroPortrait(player, 'duel__hero-art', { eager: true }),
    el('div', { className: 'duel-card__content' }, [
      el('p', { className: 'duel-card__label', text: kind === 'ruin' ? (ru ? 'Главный провал по модели' : 'Largest modelled drop-off') : (ru ? 'MVP по наблюдаемому вкладу' : 'Observed contribution MVP') }),
      el('h3', { text: player.name || player.heroName }), el('p', { className: 'duel-card__hero', text: `${player.heroName} · ${roleText(player, i18n)}` }),
      el('p', { className: 'duel-card__score', text: `${kind === 'ruin' ? 'Ruin' : 'Impact'} ${score ?? '—'}` }),
      el('p', { className: 'duel-card__version', text: analysis.modelVersions?.[kind] || '—' }),
      el('div', { className: 'duel-card__metrics' }, [
        el('span', { text: `${player.kills ?? '—'} / ${player.deaths ?? '—'} / ${player.assists ?? '—'} KDA` }), el('span', { text: `${formatNumber(player.netWorth, i18n.locale)} NW` }),
        el('span', { text: `${player.gpm ?? '—'} GPM` }), el('span', { text: `${formatNumber(player.heroDamage, i18n.locale)} DMG` }),
      ]), itemStrip(player),
      el('ul', { className: 'duel-card__insights' }, (player.insights || []).slice(0, 4).map((insight) => el('li', { className: `insight insight--${insight.tone}`, text: insightText(insight, i18n.locale) }))),
    ]),
  );
  return article;
}

export function renderDuel(analysis, i18n) {
  return el('section', { className: 'duel', attrs: { 'data-duel': '', 'aria-label': i18n.t('labels.verdicts') } }, [
    leaderCard('ruin', analysis.quality?.showVerdict ? analysis.leaders?.ruin : null, analysis, i18n),
    el('div', { className: 'duel__versus', text: 'VS', attrs: { 'aria-hidden': 'true' } }),
    leaderCard('impact', analysis.quality?.showVerdict ? analysis.leaders?.impact : null, analysis, i18n),
  ]);
}
