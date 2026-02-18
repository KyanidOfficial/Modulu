export function applyDiminishingReturn(oldScore: number, weight: number): number {
  const boundedOld = clamp(oldScore, 0, 100);
  const safeWeight = Math.max(0, weight);
  const delta = Math.floor((safeWeight * (100 - boundedOld)) / 100);
  return clamp(boundedOld + delta, 0, 100);
}

export function computeTrend(previousScore: number, newScore: number): number {
  return newScore - previousScore;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}
