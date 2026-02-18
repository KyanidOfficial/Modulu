import { RiskSignalType } from '../types';

export function evaluateMentionSpam(mentionRatioScaled: number, thresholdScaled: number): RiskSignalType | null {
  if (mentionRatioScaled - thresholdScaled > 120) {
    return 'mention_ratio_spike';
  }
  return null;
}
