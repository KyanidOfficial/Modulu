import { RiskSignalType } from './types';

const BASE_WEIGHTS: Record<Exclude<RiskSignalType, 'automod'>, number> = {
  word_violation: 6,
  link_violation: 10,
  phishing_pattern: 18,
  invite_spam: 12,
  repeated_short_messages: 8,
  spam_burst_small: 6,
  spam_burst_medium: 12,
  spam_burst_large: 20,
  message_interval_drop: 10,
  link_ratio_spike: 12,
  mention_ratio_spike: 8,
  deleted_after_flag: 15,
  prior_warning: 10,
  prior_timeout: 20,
  alt_similarity_low: 10,
  alt_similarity_medium: 18,
  alt_similarity_high: 30,
  behavior_anomaly: 10,
};

const AUTOMOD_SEVERITY_SCALE: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1000,
  2: 1200,
  3: 1500,
  4: 2000,
  5: 3000,
};

export function getBaseWeight(signalType: RiskSignalType): number {
  if (signalType === 'automod') {
    return 10;
  }
  return BASE_WEIGHTS[signalType];
}

export function computeScaledWeight(params: {
  baseWeight: number;
  accountAgeDays: number;
  daysInGuild: number;
  repeatCountWithin10m: number;
  automodSeverity?: 1 | 2 | 3 | 4 | 5;
}): number {
  let scaled = params.baseWeight * 1000;

  if (params.accountAgeDays < 7) {
    scaled = Math.floor((scaled * 1300) / 1000);
  }

  if (params.daysInGuild < 1) {
    scaled = Math.floor((scaled * 1200) / 1000);
  }

  if (params.repeatCountWithin10m > 0) {
    const repeatMultiplier = Math.min(3000, 1000 + params.repeatCountWithin10m * 400);
    scaled = Math.floor((scaled * repeatMultiplier) / 1000);
  }

  if (params.automodSeverity !== undefined) {
    scaled = Math.floor((scaled * AUTOMOD_SEVERITY_SCALE[params.automodSeverity]) / 1000);
  }

  return Math.max(0, Math.floor(scaled / 1000));
}
