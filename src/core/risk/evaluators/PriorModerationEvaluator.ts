import { RiskSignalType } from '../types';

export function evaluatePriorModeration(priorWarnings: number, priorTimeouts: number): RiskSignalType[] {
  const signals: RiskSignalType[] = [];
  if (priorWarnings > 0) {
    signals.push('prior_warning');
  }
  if (priorTimeouts > 0) {
    signals.push('prior_timeout');
  }
  return signals;
}
