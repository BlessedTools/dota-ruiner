export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeScore(components) {
  const totalWeight = components.reduce((sum, component) => sum + Math.max(0, component.maxPoints || 0), 0);
  const available = components.filter((component) => component.available === true && component.maxPoints > 0);
  const availableWeight = available.reduce((sum, component) => sum + component.maxPoints, 0);
  if (!availableWeight || !totalWeight) return { score: null, dataCoverage: 0 };
  const earned = available.reduce((sum, component) => sum + clamp(Number(component.points) || 0, 0, component.maxPoints), 0);
  return {
    score: Math.round((earned / availableWeight) * 100),
    dataCoverage: Math.round((availableWeight / totalWeight) * 100),
  };
}

export function component(id, maxPoints, available, points, observed, expected, evidence = []) {
  return { id, labelKey: `score.${id}`, observed, expected, points: available ? clamp(Math.round(points), 0, maxPoints) : 0, maxPoints, available, evidence };
}
