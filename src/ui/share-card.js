const limit = (value, max = 96) => String(value ?? '—').replace(/[\r\n]+/g, ' ').slice(0, max);

export function buildShareCardLines(analysis, locale = 'ru') {
  const demo = analysis.source === 'demo' ? 'DEMO ' : '';
  const disclaimer = locale === 'ru'
    ? 'Эвристика по доступным данным, не доказательство вины.'
    : 'Explainable heuristic from available data, not proof of blame.';
  return [
    `${demo}DOTA RUINER · #${analysis.matchId}`,
    `Data coverage: ${analysis.dataCoverage}% · ${analysis.modelVersions?.ruin || 'model unavailable'}`,
    `Ruin: ${limit(analysis.leaders?.ruin?.name || analysis.leaders?.ruin?.heroName, 52)} · ${analysis.leaders?.ruin?.ruinScore ?? '—'}`,
    `Impact: ${limit(analysis.leaders?.impact?.name || analysis.leaders?.impact?.heroName, 52)} · ${analysis.leaders?.impact?.impactScore ?? '—'}`,
    limit(analysis.leaders?.ruin?.recommendations?.weaknesses?.[0]?.evidence?.join(' · ') || 'No dominant negative factor'),
    disclaimer,
  ].map((line) => limit(line));
}

export async function exportShareCard(analysis, {
  locale = 'ru',
  canvasFactory = () => document.createElement('canvas'),
  share = globalThis.navigator?.share,
} = {}) {
  const canvas = canvasFactory();
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080a0f';
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = '#ff4d57';
  ctx.fillRect(64, 56, 16, 518);
  ctx.textBaseline = 'top';
  buildShareCardLines(analysis, locale).forEach((line, index) => {
    ctx.font = index === 0 ? '700 54px sans-serif' : '600 30px sans-serif';
    ctx.fillStyle = index === 0 ? '#f4f6ff' : '#a5adc2';
    ctx.fillText(line, 120, 80 + index * 78, 1000);
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const filename = `dota-ruiner-${analysis.source === 'demo' ? 'demo' : analysis.matchId}.png`;
  if (share && globalThis.File) {
    const file = new File([blob], filename, { type: 'image/png' });
    try {
      await share({ files: [file], title: 'DOTA RUINER' });
      return { kind: 'shared', filename, blob };
    } catch {
      // A cancelled share falls back to a regular download.
    }
  }
  return { kind: 'blob', filename, blob };
}
