import { RiskFeatureVectorRecord, SignalContext, UserRiskState } from './types';

export function buildFeatureVector(params: {
  context: SignalContext;
  stateBefore: UserRiskState;
  stateAfter: UserRiskState;
  signalWeight: number;
  messageRateLast10m: number;
  messageRateLast1h: number;
  spamBurstCount10m: number;
  automodViolationCount24h: number;
  priorModerationCount: number;
}): RiskFeatureVectorRecord {
  return {
    guildId: params.context.guildId,
    userId: params.context.userId,
    riskScoreBefore: params.stateBefore.riskScore,
    riskScoreAfter: params.stateAfter.riskScore,
    accountAgeDays: Math.max(0, params.context.accountAgeDays),
    daysInGuild: Math.max(0, params.context.daysInGuild),
    messageRateLast10m: params.messageRateLast10m,
    messageRateLast1h: params.messageRateLast1h,
    avgMessageLength: params.stateAfter.avgMessageLength,
    shortMessageRatio: params.stateAfter.shortMessageRatio,
    linkRatio: params.stateAfter.linkRatio,
    mentionRatio: params.stateAfter.mentionRatio,
    spamBurstCount10m: params.spamBurstCount10m,
    automodViolationCount24h: params.automodViolationCount24h,
    priorModerationCount: params.priorModerationCount,
    altScore: params.stateAfter.altScore,
    signalType: params.context.signalType,
    signalWeight: params.signalWeight,
    timestamp: params.context.occurredAt,
  };
}
