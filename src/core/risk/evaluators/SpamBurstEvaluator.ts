import { RiskSignalType } from '../types';

export function evaluateSpamBurst(messageCount10m: number): RiskSignalType | null {
  if (messageCount10m >= 25) return 'spam_burst_large';
  if (messageCount10m >= 15) return 'spam_burst_medium';
  if (messageCount10m >= 8) return 'spam_burst_small';
  return null;
}
