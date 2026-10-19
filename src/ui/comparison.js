function major(version) {
  const match = String(version || '').match(/-v(\d+)/);
  return match ? Number(match[1]) : null;
}

export function compareAnalyses(left, right) {
  const leftMajor = major(left?.modelVersions?.ruin);
  const rightMajor = major(right?.modelVersions?.ruin);
  const comparable = leftMajor !== null && leftMajor === rightMajor;
  return {
    comparable,
    reason: comparable ? null : 'model-major-mismatch',
    left,
    right,
    deltas: {
      duration: (right?.duration ?? 0) - (left?.duration ?? 0),
      dataCoverage: (right?.dataCoverage ?? 0) - (left?.dataCoverage ?? 0),
    },
  };
}

function name(player) {
  return player?.name || player?.heroName || '—';
}

export function renderComparison(container, comparison, i18n = null) {
  const t = (key, fallback) => {
    const value = i18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };
  container.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = t('comparison.title', 'Match comparison');
  const note = document.createElement('p');
  note.textContent = comparison.comparable
    ? t('comparison.same', 'Same major scoring model')
    : t('comparison.mismatch', 'Scores are not directly comparable: model major versions differ');
  const grid = document.createElement('div');
  grid.className = 'comparison-grid';
  for (const entry of [comparison.left, comparison.right]) {
    const card = document.createElement('article');
    const title = document.createElement('h3');
    title.textContent = `#${entry.matchId}`;
    const data = document.createElement('p');
    data.textContent = `${entry.mode} · ${Math.floor(entry.duration / 60)} min · ${entry.dataCoverage}% coverage`;
    const ruin = document.createElement('p');
    ruin.textContent = `Ruin: ${name(entry.leaders?.ruin)} · ${entry.leaders?.ruin?.ruinScore ?? entry.leaders?.ruin?.score ?? '—'}`;
    const impact = document.createElement('p');
    impact.textContent = `Impact: ${name(entry.leaders?.impact)} · ${entry.leaders?.impact?.impactScore ?? entry.leaders?.impact?.score ?? '—'}`;
    const model = document.createElement('p');
    model.className = 'mono';
    model.textContent = entry.modelVersions?.ruin || 'model unavailable';
    card.append(title, data, ruin, impact, model);
    grid.append(card);
  }
  container.append(heading, note, grid);
}
