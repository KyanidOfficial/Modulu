import { clamp } from './RiskCalculator';

export function getDynamicBaseDecayPer24h(memberCount: number): number {
  if (memberCount < 5000) {
    return 2;
  }
  if (memberCount < 50000) {
    return 3;
  }
  return 4;
}

export function toDecayRatePerHourScaled(baseDecayPer24h: number): number {
  return Math.floor((baseDecayPer24h * 1000) / 24);
}

export function getPiecewiseDecayRateScaled(riskScore: number, baseDecayPerHourScaled: number): number {
  if (riskScore >= 70) {
    return Math.floor((baseDecayPerHourScaled * 500) / 1000);
  }
  if (riskScore >= 30) {
    return baseDecayPerHourScaled;
  }
  return Math.floor((baseDecayPerHourScaled * 1500) / 1000);
}

export function applyDecay(params: {
  riskScore: number;
  lastUpdatedAt: Date;
  now: Date;
  baseDecayPerHourScaled: number;
  hasSignalsWithin72h: boolean;
}): { newScore: number; decayPoints: number; bonusApplied: number } {
  const elapsedMs = params.now.getTime() - params.lastUpdatedAt.getTime();
  const secondsElapsed = Math.max(0, Math.floor(elapsedMs / 1000));
  const decayRateScaled = getPiecewiseDecayRateScaled(params.riskScore, params.baseDecayPerHourScaled);
  const decayPoints = Math.floor((secondsElapsed * decayRateScaled) / 3600000);
  let reduced = Math.max(0, params.riskScore - decayPoints);
  let bonusApplied = 0;

  if (!params.hasSignalsWithin72h && secondsElapsed >= 72 * 3600) {
    reduced = Math.max(0, reduced - 5);
    bonusApplied = 5;
  }

  return {
    newScore: clamp(reduced, 0, 100),
    decayPoints,
    bonusApplied,
  };
}
