import { el, formatNumber, heroPortrait } from './dom.js';
import { renderPlayerInspector } from './player-inspector.js';

function row(player, i18n, onActivate) {
  const factors = player?.ruin?.components || [];
  const available = factors.filter((part) => part.available).length;
  const button = el('button', { className: 'scoreboard-row player-card', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': `player-${player.slot}-inspector` } }, [
    heroPortrait(player, 'scoreboard-row__portrait'),
    el('span', { className: 'scoreboard-row__identity' }, [el('strong', { text: player.name || player.heroName }), el('small', { text: `${player.heroName} · ${player.role?.position || i18n.t('labels.unknownRole')}` })]),
    el('span', { className: 'scoreboard-row__level', text: `LVL ${player.level ?? '—'}` }),
    el('span', { className: 'scoreboard-row__kda', text: `${player.kills ?? '—'} / ${player.deaths ?? '—'} / ${player.assists ?? '—'}` }),
    el('span', { className: 'scoreboard-row__economy', text: `${player.gpm ?? '—'} / ${player.xpm ?? '—'} G/XPM · ${formatNumber(player.netWorth, i18n.locale)} NW` }),
    el('span', { className: 'scoreboard-row__damage', text: `${formatNumber(player.heroDamage, i18n.locale)} DMG · ${formatNumber(player.towerDamage, i18n.locale)} TWR` }),
    el('span', { className: 'scoreboard-row__scores' }, [el('b', { text: `R ${player.ruinScore ?? '—'}` }), el('b', { text: `I ${player.impactScore ?? '—'}` })]),
    el('small', { className: 'player-card__coverage', text: `${available}/${factors.length} ${i18n.t('labels.factors')}` }),
  ]);
  button.addEventListener('click', () => onActivate(player, button));
  return button;
}

export function renderScoreboard(analysis, i18n, onSelect = () => {}) {
  const section = el('section', { className: 'scoreboard', attrs: { 'aria-labelledby': 'scoreboard-title' } });
  section.append(el('h2', { text: i18n.t('labels.players'), attrs: { id: 'scoreboard-title' } }));
  const grid = el('div', { className: 'scoreboard__teams' });
  const inspectorHost = el('div', { className: 'scoreboard__inspector-host' });
  const rows = [];
  let selectedSlot = null;
  const activate = (player, button) => {
    const closing = selectedSlot === player.slot;
    selectedSlot = closing ? null : player.slot;
    rows.forEach((candidate) => candidate.setAttribute('aria-expanded', String(!closing && candidate === button)));
    inspectorHost.replaceChildren();
    if (!closing) inspectorHost.append(renderPlayerInspector(player, i18n));
    onSelect(player);
  };
  for (const team of analysis.teams || []) {
    const panel = el('section', { className: `scoreboard-team scoreboard-team--${team.id}` }, el('h3', { text: team.label }));
    const list = el('div', { className: 'scoreboard-team__players' });
    team.players.forEach((player) => { const button = row(player, i18n, activate); rows.push(button); list.append(button); });
    panel.append(list); grid.append(panel);
  }
  section.append(grid, inspectorHost);
  return section;
}
