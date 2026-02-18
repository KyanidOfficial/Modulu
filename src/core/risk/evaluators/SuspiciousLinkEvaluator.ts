import { RiskSignalType } from '../types';

export function evaluateSuspiciousLink(content: string): RiskSignalType | null {
  const normalized = content.toLowerCase();
  if (normalized.includes('discord.gift') || normalized.includes('steamcommunity') || normalized.includes('@everyone http')) {
    return 'phishing_pattern';
  }
  if (normalized.includes('discord.gg/') || normalized.includes('invite')) {
    return 'invite_spam';
  }
  if (normalized.includes('http://') || normalized.includes('https://')) {
    return 'link_violation';
  }
  return null;
}
