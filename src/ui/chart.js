import { buildTimeline } from '../domain/timeline.js';

const METRICS = {
  networth: { field: 'networth_t', label: 'Net worth' },
  gold: { field: 'gold_t', label: 'Gold' },
  xp: { field: 'xp_t', label: 'XP' },
  heroDamage: { field: 'heroDamage_t', label: 'Hero Damage' },
};
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

export function getAvailableChartMetrics(match) {
  return buildTimeline(match).metrics.map((metric) => metric.key);
}

export function buildChartSeries(match, metricKey) {
  const metric = METRICS[metricKey];
  if (!metric) return [];
  const candidates = match.players.filter((player) => Array.isArray(player[metric.field]) && player[metric.field].some(finite));
  if (!candidates.length) return [];
  const shared = Math.min(...candidates.map((player) => player[metric.field].length));
  return candidates.map((player) => ({
    slot: player.slot,
    heroId: player.heroId,
    points: player[metric.field].slice(0, shared).map((value, minute) => ({ minute, value: finite(value) ? value : null })),
  }));
}

export function buildTooltipText(series, minute, getHeroName = (id) => `Hero ${id}`, labels = {}) {
  const values = series
    .map((line) => ({ name: getHeroName(line.heroId), value: line.points[minute]?.value }))
    .filter(({ value }) => finite(value))
    .map(({ name, value }) => `${name}: ${value}`);
  return values.length ? `${minute} ${labels.minute || 'min'} · ${values.join(' · ')}` : `${minute} ${labels.minute || 'min'} · ${labels.noValues || 'No observed values'}`;
}

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attrs || {})) node.setAttribute(name, String(value));
  return node;
}

function draw(canvas, series, leaders = {}) {
  const box = canvas.getBoundingClientRect();
  const width = Math.max(320, box.width || 640);
  const height = 280;
  const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const values = series.flatMap((line) => line.points.map((point) => point.value).filter(finite));
  const max = Math.max(1, ...values);
  const pad = { l: 48, r: 20, t: 20, b: 32 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxMinute = Math.max(1, ...series.flatMap((line) => line.points.map((point) => point.minute)));
  ctx.strokeStyle = '#303848';
  ctx.lineWidth = 1;
  for (let row = 0; row <= 4; row += 1) {
    const y = pad.t + plotH * row / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();
  }
  const colors = ['#42d7a1', '#ff4d57', '#e9b949', '#8db4ff', '#ca8cff', '#ff8f66', '#58c7ff', '#f875aa', '#a4dc70', '#c2a7ff'];
  series.forEach((line, index) => {
    ctx.strokeStyle = colors[index % colors.length];
    ctx.lineWidth = line.slot === leaders.ruinSlot || line.slot === leaders.impactSlot ? 3 : 1.5;
    ctx.setLineDash(line.slot === leaders.ruinSlot ? [7, 4] : line.slot === leaders.impactSlot ? [2, 3] : []);
    let open = false;
    ctx.beginPath();
    line.points.forEach((point) => {
      if (!finite(point.value)) { open = false; return; }
      const x = pad.l + point.minute / maxMinute * plotW;
      const y = pad.t + (1 - point.value / max) * plotH;
      if (!open) { ctx.moveTo(x, y); open = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.fillStyle = '#a5adc2';
  ctx.font = '11px system-ui';
  ctx.fillText('0', pad.l - 12, height - 10);
  ctx.fillText(`${maxMinute}m`, width - pad.r - 28, height - 10);
  ctx.fillText(String(Math.round(max)), 4, pad.t + 4);
}

function renderTable(table, series, getHeroName, labels) {
  table.replaceChildren();
  const caption = element('caption', { text: labels.data || 'Chart data' });
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.append(element('th', { text: labels.minuteHeading || 'Minute', attrs: { scope: 'col' } }));
  series.forEach((line) => headRow.append(element('th', { text: getHeroName(line.heroId), attrs: { scope: 'col' } })));
  head.append(headRow);
  const body = document.createElement('tbody');
  const length = Math.max(0, ...series.map((line) => line.points.length));
  for (let minute = 0; minute < length; minute += 1) {
    const row = document.createElement('tr');
    row.append(element('th', { text: minute, attrs: { scope: 'row' } }));
    series.forEach((line) => row.append(element('td', { text: line.points[minute]?.value ?? '—' })));
    body.append(row);
  }
  table.append(caption, head, body);
}

export function createMatchChart(container, { match, getHeroName = (id) => `Hero ${id}`, leaders = {}, labels = {} }) {
  const timeline = buildTimeline(match);
  let metric = getAvailableChartMetrics(match)[0] || null;
  let currentSeries = [];
  const heading = element('h2', { text: labels.timeline || 'Match timeline' });
  const controls = element('div', { className: 'chart-controls', attrs: { role: 'group', 'aria-label': labels.metric || 'Chart metric' } });
  const source = element('p', { className: 'chart-source' });
  const unavailable = element('p', { className: 'chart-unavailable', text: labels.unavailable || 'Timeline unavailable — final observed values remain in player summaries.' });
  const canvas = element('canvas', { className: 'match-chart', attrs: { role: 'img', 'aria-label': labels.observed || 'Observed match timeline', tabindex: '0' } });
  const tooltip = element('output', { className: 'chart-tooltip', attrs: { 'aria-live': 'polite' } });
  const tableWrap = element('div', { className: 'chart-table-wrap', attrs: { tabindex: '0', role: 'region', 'aria-label': labels.scrollable || 'Scrollable chart data' } });
  const table = element('table', { className: 'chart-table', attrs: { 'aria-label': labels.data || 'Chart data' } });
  tableWrap.append(table);
  const dataDisclosure = element('details', { className: 'chart-data-disclosure' });
  dataDisclosure.append(element('summary', { text: labels.data || 'Chart data' }), tableWrap);
  const events = element('ol', { className: 'chart-events', attrs: { 'aria-label': labels.events || 'Observed match events' } });
  const eventNames = {
    death: labels.death || 'Death', buyback: labels.buyback || 'Buyback',
    objective: labels.objective || 'Objective', teamfight: labels.teamfight || 'Teamfight',
  };
  timeline.events.forEach((event) => events.append(element('li', {
    text: `${Math.floor(event.time / 60)}:${String(Math.max(0, event.time % 60)).padStart(2, '0')} · ${eventNames[event.type]} · ${event.source}`,
  })));
  container.replaceChildren(heading, controls, source, unavailable, canvas, tooltip, dataDisclosure, events);
  const available = timeline.metrics.map((entry) => entry.key);

  function showMinute(minute) {
    if (!currentSeries.length) return;
    const lastMinute = Math.max(0, currentSeries[0].points.length - 1);
    tooltip.textContent = buildTooltipText(currentSeries, Math.max(0, Math.min(lastMinute, minute)), getHeroName, labels);
  }
  canvas.addEventListener('pointermove', (event) => {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left - 48) / Math.max(1, box.width - 68)));
    showMinute(Math.round(ratio * Math.max(0, (currentSeries[0]?.points.length || 1) - 1)));
  });
  canvas.addEventListener('focus', () => showMinute(Math.max(0, (currentSeries[0]?.points.length || 1) - 1)));

  function render() {
    controls.replaceChildren();
    for (const [key, config] of Object.entries(METRICS)) {
      const button = element('button', { className: 'button chart-control', text: config.label, attrs: { type: 'button', 'aria-pressed': metric === key } });
      button.disabled = !available.includes(key);
      button.addEventListener('click', () => { metric = key; render(); });
      controls.append(button);
    }
    currentSeries = metric ? buildChartSeries(match, metric) : [];
    source.textContent = timeline.metrics.find((entry) => entry.key === metric)?.source || '';
    source.hidden = !source.textContent;
    draw(canvas, currentSeries, leaders);
    renderTable(table, currentSeries, getHeroName, labels);
    unavailable.hidden = currentSeries.length > 0;
    canvas.hidden = currentSeries.length === 0;
    tooltip.hidden = currentSeries.length === 0;
    tableWrap.hidden = currentSeries.length === 0;
    dataDisclosure.hidden = currentSeries.length === 0;
    if (currentSeries.length) showMinute(currentSeries[0].points.length - 1);
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => render()) : null;
  observer?.observe(container);
  render();
  return { render, resize: render, destroy() { observer?.disconnect(); container.replaceChildren(); } };
}
