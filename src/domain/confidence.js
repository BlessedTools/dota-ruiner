const certaintyRank = { unknown: 0, low: 1, medium: 2, high: 3 };

export function assessConclusionQuality({ dataCoverage = 0, roleCertainty = 'unknown', leadGap = 0 }) {
  if (dataCoverage < 50) return { quality: 'insufficient', showVerdict: false, ambiguous: false };
  const ambiguous = leadGap < 5;
  let quality = dataCoverage < 70 ? 'low' : dataCoverage < 85 ? 'medium' : 'high';
  if ((certaintyRank[roleCertainty] ?? 0) < 2 && quality === 'high') quality = 'medium';
  if (ambiguous && quality === 'high') quality = 'medium';
  return { quality, showVerdict: true, ambiguous };
}
