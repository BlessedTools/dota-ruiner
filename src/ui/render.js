import { el, formatNumber, heroPortrait } from './dom.js';
import { renderDuel } from './duel.js';
import { renderMatchArena } from './match-arena.js';
import { renderMatchStory } from './match-story.js';
import { renderScoreboard } from './scoreboard.js';

function observedFactors(player) {
  const factors = player?.ruin?.components || [];
  return { available: factors.filter((factor) => factor.available).length, total: factors.length };
}

function roleText(player, i18n) {
  if (!player?.role || player.role.position === 'unknown') return i18n.t('labels.unknownRole');
  return `${player.role.position} · ${player.role.certainty}`;
}

function playerCard(player, i18n) {
  const factors = observedFactors(player);
  return el('article', { className: 'player-card' }, [
    heroPortrait(player),
    el('div', { className: 'player-card__identity' }, [el('h3', { text: player.name || player.heroName }), el('p', { text: `${player.heroName} · ${roleText(player, i18n)}` })]),
    el('p', { className: 'player-card__kda', text: `${player.kills ?? '—'} / ${player.deaths ?? '—'} / ${player.assists ?? '—'}` }),
    el('div', { className: 'player-card__economy' }, [el('span', { text: `${player.gpm ?? '—'} GPM` }), el('span', { text: `${formatNumber(player.netWorth, i18n.locale)} NW` })]),
    el('div', { className: 'player-card__scores' }, [el('span', { className: 'mini-score mini-score--ruin', text: `R ${player.ruinScore ?? '—'}` }), el('span', { className: 'mini-score mini-score--impact', text: `I ${player.impactScore ?? '—'}` })]),
    el('p', { className: 'player-card__coverage', text: `${factors.available}/${factors.total} ${i18n.t('labels.factors')}` }),
  ]);
}

function renderLineups(analysis, i18n) {
  const section = el('section', { className: 'lineups', attrs: { 'aria-labelledby': 'lineups-title' } }, el('h2', { text: i18n.t('labels.players'), attrs: { id: 'lineups-title' } }));
  const grid = el('div', { className: 'lineups__grid' });
  for (const team of analysis.teams || []) {
    const panel = el('section', { className: `lineup lineup--${team.id}` }, el('h3', { text: team.label }));
    const list = el('div', { className: 'player-list' });
    team.players.forEach((player) => list.append(playerCard(player, i18n)));
    panel.append(list); grid.append(panel);
  }
  section.append(grid);
  return section;
}

export function renderAnalysis(container, analysis, i18n) {
  const fragment = document.createDocumentFragment();
  if (analysis.source === 'demo') fragment.append(el('div', { className: 'demo-banner', text: i18n.t('demo.label'), attrs: { 'data-demo-label': '', role: 'status' } }));
  if (analysis.cacheState === 'cached') fragment.append(el('div', { className: 'cache-banner', text: i18n.t('cache.label'), attrs: { 'data-cache-label': '', role: 'status' } }));
  fragment.append(renderMatchArena(analysis, i18n), renderDuel(analysis, i18n), renderMatchStory(analysis, i18n));
  fragment.append(el('section', { className: 'chart-panel', attrs: { 'data-chart-host': '', 'aria-label': i18n.t('chart.timeline') } }));
  fragment.append(renderScoreboard(analysis, i18n));
  if (analysis.warnings?.length) {
    const warnings = el('section', { className: 'warnings' }, el('h2', { text: i18n.t('labels.warnings') }));
    const list = el('ul');
    analysis.warnings.forEach((warning) => { const localized = i18n.t(`warnings.${warning}`); list.append(el('li', { text: localized === `warnings.${warning}` ? warning : localized })); });
    warnings.append(list); fragment.append(warnings);
  }
  const method = el('details', { className: 'methodology' });
  method.append(el('summary', { text: i18n.t('labels.methodology') }), el('p', { text: i18n.t('disclaimer') }), el('p', { text: `${i18n.t('labels.model')}: ${analysis.modelVersions?.ruin || '—'} / ${analysis.modelVersions?.impact || '—'}` }));
  fragment.append(method);
  container.replaceChildren(fragment);
}
