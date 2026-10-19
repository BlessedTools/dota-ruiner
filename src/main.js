import './styles/main.css';
import './styles/accessibility.css';
import { fetchMatch, parseMatchInput } from './api/opendota.js';
import { createRequestCoordinator } from './api/client.js';
import { normalizeMatch } from './domain/normalize-match.js';
import { inferRole } from './domain/roles.js';
import { calculateRuinScore } from './domain/ruin-score.js';
import { calculateImpactScore } from './domain/impact-score.js';
import { assessConclusionQuality } from './domain/confidence.js';
import { buildRecommendations } from './domain/recommendations.js';
import { createDemoAnalysisInput } from './data/demo-match.js';
import { MODEL_VERSIONS } from './data/scoring-config.js';
import { createI18n } from './data/i18n.js';
import { getHero, loadHeroConstants } from './data/heroes.js';
import { createHistoryStore } from './storage/history.js';
import { compareAnalyses, renderComparison } from './ui/comparison.js';
import { createMatchChart } from './ui/chart.js';
import { renderAnalysis } from './ui/render.js';
import { exportShareCard } from './ui/share-card.js';
import { renderError, renderIdle, renderLoading, renderReady } from './ui/states.js';

const elements = {
  form: document.querySelector('#match-form'),
  input: document.querySelector('#match-id'),
  analyze: document.querySelector('#analyze-button'),
  demo: document.querySelector('#demo-button'),
  locale: document.querySelector('#locale-button'),
  history: document.querySelector('#history-button'),
  compare: document.querySelector('#compare-button'),
  share: document.querySelector('#share-button'),
  historyPanel: document.querySelector('#history-panel'),
  comparisonPanel: document.querySelector('#comparison-panel'),
  status: document.querySelector('#status'),
  results: document.querySelector('#results'),
};
const i18n = createI18n(null);
const coordinator = createRequestCoordinator();
const historyStore = createHistoryStore();
const heroConstantsReady = loadHeroConstants().catch(() => null);
let chart = null;
let currentAnalysis = null;
let submissionSequence = 0;

function chartLabels() {
  return {
    timeline: i18n.t('chart.timeline'), metric: i18n.t('chart.metric'), data: i18n.t('chart.data'),
    minute: i18n.t('chart.minute'), minuteHeading: i18n.t('chart.minuteHeading'), observed: i18n.t('chart.observed'),
    scrollable: i18n.t('chart.scrollable'), unavailable: i18n.t('chart.unavailable'), noValues: i18n.t('chart.noValues'),
  };
}

function playerView(player, match, team) {
  const hero = getHero(player.heroId);
  const role = inferRole(player, team, hero);
  const context = { player, team, match, role };
  const ruin = calculateRuinScore(context);
  const impact = calculateImpactScore(context);
  return {
    slot: player.slot,
    name: player.personaname,
    heroName: hero.name,
    heroId: hero.id,
    heroImage: hero.image,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    role,
    ruinScore: ruin.score,
    impactScore: impact.score,
    ruin,
    impact,
    recommendations: buildRecommendations(ruin),
  };
}

export function analyzeNormalizedMatch(match, warnings = []) {
  const radiant = match.players.filter((player) => player.team === 'radiant');
  const dire = match.players.filter((player) => player.team === 'dire');
  const players = [
    ...radiant.map((player) => playerView(player, match, radiant)),
    ...dire.map((player) => playerView(player, match, dire)),
  ];
  const ruinSorted = [...players].filter((player) => player.ruinScore !== null).sort((a, b) => b.ruinScore - a.ruinScore || a.slot - b.slot);
  const impactSorted = [...players].filter((player) => player.impactScore !== null).sort((a, b) => b.impactScore - a.impactScore || a.slot - b.slot);
  const ruinLeader = ruinSorted[0] || null;
  const coverage = ruinLeader?.ruin.dataCoverage ?? 0;
  const quality = assessConclusionQuality({
    dataCoverage: coverage,
    roleCertainty: ruinLeader?.role.certainty,
    leadGap: ruinLeader && ruinSorted[1] ? ruinLeader.ruinScore - ruinSorted[1].ruinScore : 100,
  });
  return {
    source: match.source,
    matchId: match.matchId,
    duration: match.duration,
    startTime: match.startTime,
    mode: match.mode,
    warnings,
    quality,
    dataCoverage: coverage,
    modelVersions: MODEL_VERSIONS,
    leaders: { ruin: ruinLeader, impact: impactSorted[0] || null },
    teams: [
      { id: 'radiant', label: 'Radiant', players: players.filter((player) => radiant.some((item) => item.slot === player.slot)) },
      { id: 'dire', label: 'Dire', players: players.filter((player) => dire.some((item) => item.slot === player.slot)) },
    ],
    match,
  };
}

function chartMatch(analysis) {
  return analysis.match || { players: analysis.timelines || [] };
}

function displayAnalysis(analysis, { persist = false } = {}) {
  currentAnalysis = analysis;
  chart?.destroy();
  renderAnalysis(elements.results, analysis, i18n);
  chart = createMatchChart(elements.results.querySelector('[data-chart-host]'), {
    match: chartMatch(analysis),
    getHeroName: (id) => getHero(id).name,
    leaders: { ruinSlot: analysis.leaders?.ruin?.slot, impactSlot: analysis.leaders?.impact?.slot },
    labels: chartLabels(),
  });
  elements.share.disabled = false;
  if (persist) historyStore.save(analysis);
  renderHistory();
  renderReady(elements.status, i18n);
  return analysis;
}

function showNormalized(result, { persist = false } = {}) {
  if (!result.ok) {
    renderError(elements.status, 'invalid-response', i18n);
    return null;
  }
  return displayAnalysis(analyzeNormalizedMatch(result.match, result.warnings), { persist });
}

function renderHistory() {
  const entries = historyStore.list();
  elements.historyPanel.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = i18n.t('actions.history');
  elements.historyPanel.append(heading);
  const list = document.createElement('div');
  list.className = 'history-list';
  for (const entry of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button history-entry';
    button.textContent = `#${entry.matchId} · ${entry.mode} · ${entry.dataCoverage}%`;
    button.addEventListener('click', () => {
      displayAnalysis(entry);
      elements.historyPanel.hidden = true;
    });
    list.append(button);
  }
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.textContent = i18n.locale === 'ru' ? 'История пока пуста.' : 'History is empty.';
    list.append(empty);
  }
  elements.historyPanel.append(list);
  elements.compare.hidden = entries.length < 2;
}

function applyCopy() {
  document.documentElement.lang = i18n.locale;
  document.title = `${i18n.t('app.title')} — ${i18n.t('app.subtitle')}`;
  document.querySelector('#app-title').textContent = i18n.t('app.title');
  document.querySelector('#app-subtitle').textContent = i18n.t('app.subtitle');
  document.querySelector('label[for="match-id"]').textContent = i18n.t('form.matchId');
  document.querySelector('.header-actions').setAttribute('aria-label', i18n.locale === 'ru' ? 'Действия' : 'Actions');
  elements.input.placeholder = i18n.t('form.placeholder');
  elements.analyze.textContent = i18n.t('actions.analyze');
  elements.demo.textContent = i18n.t('actions.demo');
  elements.history.textContent = i18n.t('actions.history');
  elements.historyPanel.setAttribute('aria-label', i18n.t('actions.history'));
  elements.share.textContent = i18n.t('actions.share');
  elements.compare.textContent = i18n.locale === 'ru' ? 'Сравнить' : 'Compare';
  elements.locale.textContent = i18n.locale === 'ru' ? 'EN' : 'RU';
  elements.locale.setAttribute('aria-label', i18n.locale === 'ru' ? 'Switch language — EN' : 'Переключить язык — RU');
  document.querySelector('#disclaimer').textContent = i18n.t('disclaimer');
  if (currentAnalysis) displayAnalysis(currentAnalysis);
  else {
    renderIdle(elements.status, i18n);
    renderHistory();
  }
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseMatchInput(elements.input.value);
  if (!parsed.ok) {
    elements.input.setAttribute('aria-invalid', 'true');
    elements.status.setAttribute('role', 'alert');
    elements.status.textContent = i18n.t(parsed.errorKey);
    return;
  }
  elements.input.removeAttribute('aria-invalid');
  renderLoading(elements.status, i18n);
  elements.analyze.disabled = true;
  const submission = ++submissionSequence;
  coordinator.run(async (signal) => {
    const raw = await fetchMatch(parsed.matchId, { signal });
    await heroConstantsReady;
    return raw;
  }, {
    onSuccess(raw) {
      const analysis = showNormalized(normalizeMatch(raw), { persist: true });
      if (analysis) history.replaceState(null, '', `#${parsed.matchId}`);
    },
    onError(error) { renderError(elements.status, error.code, i18n); },
  }).catch(() => {}).finally(() => {
    if (submission === submissionSequence) elements.analyze.disabled = false;
  });
});

elements.demo.addEventListener('click', () => showNormalized(normalizeMatch(createDemoAnalysisInput(), { source: 'demo' })));
elements.locale.addEventListener('click', () => {
  i18n.setLocale(i18n.locale === 'ru' ? 'en' : 'ru');
  applyCopy();
});
elements.history.addEventListener('click', () => {
  elements.historyPanel.hidden = !elements.historyPanel.hidden;
  if (!elements.historyPanel.hidden) elements.historyPanel.querySelector('button')?.focus();
});
elements.compare.addEventListener('click', () => {
  const entries = historyStore.list();
  if (entries.length < 2) return;
  renderComparison(elements.comparisonPanel, compareAnalyses(entries[1], entries[0]), i18n);
  elements.comparisonPanel.hidden = false;
});
elements.share.addEventListener('click', async () => {
  if (!currentAnalysis) return;
  const result = await exportShareCard(currentAnalysis, { locale: i18n.locale });
  if (result.kind === 'blob') {
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, { scope: import.meta.env.BASE_URL }).catch(() => {}));
}
applyCopy();
const hashId = location.hash.slice(1);
if (/^\d{7,12}$/.test(hashId)) {
  elements.input.value = hashId;
  elements.form.requestSubmit();
}
