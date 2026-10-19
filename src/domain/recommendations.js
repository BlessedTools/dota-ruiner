export function buildRecommendations({ components = [] }) {
  const available = components.filter((item) => item.available && item.maxPoints > 0);
  const ratio = (item) => item.points / item.maxPoints;
  return {
    weaknesses: available.filter((item) => ratio(item) >= 0.6).sort((a, b) => ratio(b) - ratio(a)).slice(0, 3),
    strengths: available.filter((item) => ratio(item) <= 0.2).sort((a, b) => ratio(a) - ratio(b)).slice(0, 3),
  };
}
