import { el, formatNumber, heroPortrait } from './dom.js';

const TABS = [
  ['overview', 'Обзор', 'Overview'], ['economy', 'Экономика', 'Economy'], ['combat', 'Бой', 'Combat'],
  ['support', 'Поддержка', 'Support'], ['scoring', 'Оценка', 'Scoring'],
];

function metric(label, value) {
  return el('div', { className: 'inspector-metric' }, [el('span', { text: label }), el('strong', { text: value })]);
}

function itemNode(item, type, index) {
  if (!item) return el('span', { className: `inspector-item inspector-item--${type} inspector-item--empty`, text: '—', attrs: { 'aria-hidden': 'true' } });
  return item.image
    ? el('img', { className: `inspector-item inspector-item--${type}`, attrs: { src: item.image, alt: item.name, width: 48, height: 34, loading: 'lazy' } })
    : el('span', { className: `inspector-item inspector-item--${type}`, text: item.name.slice(0, 2), attrs: { role: 'img', 'aria-label': item.name } });
}

function items(player, ru) {
  const section = el('section', { className: 'inspector-items', attrs: { 'aria-label': ru ? 'Предметы' : 'Items' } });
  const main = [...(player.items || [])].slice(0, 6);
  while (main.length < 6) main.push(null);
  main.forEach((item, index) => section.append(itemNode(item, 'main', index)));
  if (player.neutralItemData) section.append(itemNode(player.neutralItemData, 'neutral', 0));
  return section;
}

function components(player, ru) {
  const rows = [...(player.ruin?.components || []), ...(player.impact?.components || [])].filter((part) => part.available);
  if (!rows.length) return el('p', { className: 'inspector-empty', text: ru ? 'Компоненты оценки недоступны.' : 'Scoring components are unavailable.' });
  return el('ul', { className: 'inspector-components' }, rows.map((part) => el('li', {}, [
    el('strong', { text: part.id }), el('span', { text: `${part.points}/${part.maxPoints}` }), el('small', { text: part.source }),
  ])));
}

function panelContent(id, player, locale) {
  const ru = locale === 'ru';
  if (id === 'overview') return el('div', { className: 'inspector-metrics' }, [
    metric('K / D / A', `${player.kills ?? '—'} / ${player.deaths ?? '—'} / ${player.assists ?? '—'}`), metric(ru ? 'Уровень' : 'Level', player.level ?? '—'),
    metric('Net worth', formatNumber(player.netWorth, locale)), metric(ru ? 'Роль' : 'Role', player.role?.position || '—'),
  ]);
  if (id === 'economy') return el('div', { className: 'inspector-metrics' }, [
    metric('GPM', player.gpm == null ? '—' : `${player.gpm} GPM`), metric('XPM', player.xpm == null ? '—' : `${player.xpm} XPM`), metric('Net worth', formatNumber(player.netWorth, locale)),
    metric('LH / DN', `${player.lastHits ?? '—'} / ${player.denies ?? '—'}`), metric(ru ? 'Потрачено золота' : 'Gold spent', formatNumber(player.goldSpent, locale)),
  ]);
  if (id === 'combat') return el('div', { className: 'inspector-metrics' }, [
    metric(ru ? 'Урон героям' : 'Hero damage', formatNumber(player.heroDamage, locale)), metric(ru ? 'Урон строениям' : 'Tower damage', formatNumber(player.towerDamage, locale)),
    metric(ru ? 'Лечение' : 'Healing', formatNumber(player.heroHealing, locale)), metric(ru ? 'Контроль, сек.' : 'Stuns, sec', player.stuns ?? '—'),
  ]);
  if (id === 'support') {
    const values = [player.obsPlaced, player.senPlaced, player.campsStacked];
    if (values.every((value) => value === null || value === undefined)) return el('p', { className: 'inspector-empty', text: ru ? 'Данные поддержки не получены OpenDota.' : 'OpenDota did not provide support data.' });
    return el('div', { className: 'inspector-metrics' }, [metric(ru ? 'Варды' : 'Observer wards', player.obsPlaced ?? '—'), metric(ru ? 'Сентри' : 'Sentries', player.senPlaced ?? '—'), metric(ru ? 'Стаки' : 'Stacks', player.campsStacked ?? '—')]);
  }
  return components(player, ru);
}

export function renderPlayerInspector(player, i18n) {
  const ru = i18n.locale === 'ru';
  const prefix = `player-${player.slot}`;
  const region = el('section', { className: 'player-inspector', attrs: { 'data-player-inspector': '', id: `${prefix}-inspector`, 'aria-labelledby': `${prefix}-title` } });
  region.append(el('header', { className: 'player-inspector__header' }, [
    heroPortrait(player, 'player-inspector__portrait'),
    el('div', {}, [el('h3', { text: player.name || player.heroName, attrs: { id: `${prefix}-title` } }), el('p', { text: `${player.heroName} · ${player.role?.position || (ru ? 'роль не определена' : 'role unknown')}` })]),
    items(player, ru),
  ]));
  const tablist = el('div', { className: 'inspector-tabs', attrs: { role: 'tablist', 'aria-label': ru ? 'Разделы игрока' : 'Player sections' } });
  const panels = el('div', { className: 'inspector-panels' });
  const buttons = [];
  const activate = (index, focus = false) => {
    buttons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === index;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      panels.children[buttonIndex].hidden = !selected;
    });
    if (focus) buttons[index].focus();
  };
  TABS.forEach(([id, ruLabel, enLabel], index) => {
    const button = el('button', { className: 'inspector-tab', text: ru ? ruLabel : enLabel, attrs: { type: 'button', role: 'tab', id: `${prefix}-tab-${id}`, 'aria-controls': `${prefix}-panel-${id}` } });
    button.addEventListener('click', () => activate(index));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      activate(target, true);
    });
    buttons.push(button); tablist.append(button);
    panels.append(el('div', { className: 'inspector-panel', attrs: { role: 'tabpanel', id: `${prefix}-panel-${id}`, 'aria-labelledby': `${prefix}-tab-${id}` } }, panelContent(id, player, i18n.locale)));
  });
  region.append(tablist, panels);
  activate(0);
  return region;
}
