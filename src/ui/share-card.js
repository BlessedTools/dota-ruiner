const limit = (value, max = 96) => String(value ?? '—').replace(/[\r\n]+/g, ' ').slice(0, max);

export function buildShareCardLines(analysis, locale = 'ru') {
  const demo = analysis.source === 'demo' ? 'DEMO ' : '';
  const winner = analysis.radiantWin === true ? 'Radiant' : analysis.radiantWin === false ? 'Dire' : (locale === 'ru' ? 'не указан' : 'unavailable');
  const score = `${analysis.radiantScore ?? '—'}:${analysis.direScore ?? '—'}`;
  const minutes = Math.floor((analysis.duration || 0) / 60);
  const disclaimer = locale === 'ru'
    ? 'Эвристика по доступным данным, не доказательство вины.'
    : 'Explainable heuristic from available data, not proof of blame.';
  return [
    `${demo}DOTA RUINER · #${analysis.matchId}`,
    `${locale === 'ru' ? 'Победитель' : 'Winner'}: ${winner} ${score} · ${minutes} ${locale === 'ru' ? 'мин' : 'min'}`,
    `${analysis.modelVersions?.ruin || 'ruin model unavailable'} · ${analysis.modelVersions?.impact || 'impact model unavailable'}`,
    `Ruin: ${limit(analysis.leaders?.ruin?.name || analysis.leaders?.ruin?.heroName, 34)} (${limit(analysis.leaders?.ruin?.heroName, 24)}) · ${analysis.leaders?.ruin?.ruinScore ?? '—'}`,
    `Impact: ${limit(analysis.leaders?.impact?.name || analysis.leaders?.impact?.heroName, 34)} (${limit(analysis.leaders?.impact?.heroName, 24)}) · ${analysis.leaders?.impact?.impactScore ?? '—'}`,
    `${locale === 'ru' ? 'Наблюдаемые данные' : 'observed data'}: ${analysis.dataCoverage}% · ${analysis.narrative?.lead || (locale === 'ru' ? 'Итог без домыслов.' : 'Observed match result only.')}`,
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
  ctx.fillStyle = '#07090c';
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = '#e6ba60';
  ctx.fillRect(64, 56, 12, 518);
  ctx.fillStyle = '#11171d';
  ctx.fillRect(96, 190, 1040, 308);
  ctx.textBaseline = 'top';
  buildShareCardLines(analysis, locale).forEach((line, index) => {
    ctx.font = index === 0 ? '800 54px sans-serif' : index === 1 ? '800 34px sans-serif' : '600 26px sans-serif';
    ctx.fillStyle = index === 0 ? '#f0eadc' : index === 1 ? '#f5dda3' : '#b8b2a7';
    ctx.fillText(line, 120, 74 + index * 70, 980);
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
