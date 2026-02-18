import { calculateAltLikelihood } from './AltDetection';
import { applyDiminishingReturn, clamp, computeTrend } from './RiskCalculator';
import { applyDecay } from './RiskDecay';
import { buildFeatureVector } from './RiskFeatureVector';
import { computeScaledWeight, getBaseWeight } from './RiskWeights';
import { DashboardAggregator } from './DashboardAggregator';
import { evaluateBehaviorAnomaly } from './evaluators/BehaviorAnomalyEvaluator';
import {
  AutomodSignal,
  MessageEvent,
  RiskRepository,
  SignalContext,
  TopRiskUser,
  UserRiskState,
} from './types';

const MAX_RETRIES = 3;

function createInitialState(guildId: string, userId: string, now: Date): UserRiskState {
  return {
    guildId,
    userId,
    riskScore: 0,
    riskTrend: 0,
    lastUpdatedAt: now,
    version: 1,
    avgMessageLength: 0,
    shortMessageRatio: 0,
    avgSecondsBetweenMessages: 0,
    linkRatio: 0,
    mentionRatio: 0,
    altScore: 0,
  };
}

export class VersionConflictError extends Error {}

export class RiskEngine {
  private readonly dashboard: DashboardAggregator;

  public constructor(private readonly repository: RiskRepository) {
    this.dashboard = new DashboardAggregator(repository);
  }

  public async recordSignal(context: SignalContext): Promise<UserRiskState> {
    return this.executeWithRetries(context, undefined);
  }

  public async recordAutomodSignal(params: {
    guildId: string;
    userId: string;
    accountAgeDays: number;
    daysInGuild: number;
    signal: AutomodSignal;
    occurredAt: Date;
  }): Promise<UserRiskState> {
    const context: SignalContext = {
      guildId: params.guildId,
      userId: params.userId,
      signalType: 'automod',
      accountAgeDays: params.accountAgeDays,
      daysInGuild: params.daysInGuild,
      occurredAt: params.occurredAt,
      metadata: { ...params.signal.metadata, type: params.signal.type, severity: params.signal.severity },
    };
    return this.executeWithRetries(context, params.signal.severity);
  }

  public async recordMessageEvent(event: MessageEvent): Promise<{ state: UserRiskState; anomalyDetected: boolean }> {
    return this.repository.withTransaction(async (tx) => {
      const config = await this.repository.getGuildRiskConfig(tx, event.guildId);
      let state = await this.repository.getUserRiskStateForUpdate(tx, event.guildId, event.userId);
      if (state === null) {
        state = createInitialState(event.guildId, event.userId, event.createdAt);
        await this.repository.insertUserRiskState(tx, state);
      }

      const elapsed = Math.max(0, Math.floor((event.createdAt.getTime() - state.lastUpdatedAt.getTime()) / 1000));
      const { nextState, anomaly } = evaluateBehaviorAnomaly({
        state,
        thresholdScaled: config.anomalyThresholdScaled,
        messageLength: event.content.length,
        isShortMessage: event.content.trim().length <= 4,
        secondsSincePrevious: elapsed,
        containsLink: event.containsLink,
        mentionCount: event.mentionCount,
      });

      const persisted = await this.repository.updateUserRiskStateWithVersion(
        tx,
        {
          ...nextState,
          lastUpdatedAt: event.createdAt,
          riskTrend: 0,
        },
        state.version,
      );

      if (!persisted) {
        throw new VersionConflictError('version conflict while recording message event');
      }

      return {
        state: {
          ...nextState,
          lastUpdatedAt: event.createdAt,
          version: state.version + 1,
        },
        anomalyDetected: anomaly.isAnomaly,
      };
    });
  }

  public async getUserRisk(guildId: string, userId: string): Promise<UserRiskState | null> {
    return this.repository.withTransaction(async (tx) => this.repository.getUserRiskStateForUpdate(tx, guildId, userId));
  }

  public async getTopRiskUsers(guildId: string, limit = 25): Promise<TopRiskUser[]> {
    return this.repository.getTopRiskUsers(guildId, limit);
  }

  public async getAltLikelihood(guildId: string, userId: string): Promise<number> {
    const state = await this.getUserRisk(guildId, userId);
    if (state === null) return 0;
    const vectors = await this.repository.getRecentlyBannedBehaviorVectors(guildId, 200);
    const likelihood = calculateAltLikelihood(state, vectors, 1200);
    return likelihood.score;
  }

  public getDashboardAggregator(): DashboardAggregator {
    return this.dashboard;
  }

  private async executeWithRetries(context: SignalContext, automodSeverity?: 1 | 2 | 3 | 4 | 5): Promise<UserRiskState> {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        return await this.repository.withTransaction(async (tx, transactionContext) => {
          const config = await this.repository.getGuildRiskConfig(tx, context.guildId);
          const existing = await this.repository.getUserRiskStateForUpdate(tx, context.guildId, context.userId);
          const currentState = existing ?? createInitialState(context.guildId, context.userId, context.occurredAt);

          if (existing === null) {
            await this.repository.insertUserRiskState(tx, currentState);
          }

          const repeatCount = await this.repository.getRepeatCountWithinWindow(
            tx,
            context.guildId,
            context.userId,
            context.signalType,
            600,
            context.occurredAt,
          );

          const decay = applyDecay({
            riskScore: currentState.riskScore,
            lastUpdatedAt: currentState.lastUpdatedAt,
            now: transactionContext.now,
            baseDecayPerHourScaled: config.decayRatePerHourScaled,
            hasSignalsWithin72h: (transactionContext.now.getTime() - currentState.lastUpdatedAt.getTime()) < 72 * 3600 * 1000,
          });

          const decayedState: UserRiskState = {
            ...currentState,
            riskScore: decay.newScore,
          };

          const weight = computeScaledWeight({
            baseWeight: getBaseWeight(context.signalType),
            accountAgeDays: context.accountAgeDays,
            daysInGuild: context.daysInGuild,
            repeatCountWithin10m: repeatCount,
            automodSeverity,
          });

          const riskAfter = applyDiminishingReturn(decayedState.riskScore, weight);
          let nextState: UserRiskState = {
            ...decayedState,
            riskScore: clamp(riskAfter, 0, 100),
            riskTrend: computeTrend(currentState.riskScore, riskAfter),
            lastUpdatedAt: transactionContext.now,
          };

          const vectors = await this.repository.getRecentlyBannedBehaviorVectors(context.guildId, 100);
          const alt = calculateAltLikelihood(nextState, vectors, config.altDistanceThreshold);
          nextState = {
            ...nextState,
            altScore: alt.score,
          };

          const persisted = await this.repository.updateUserRiskStateWithVersion(tx, nextState, currentState.version);
          if (!persisted) {
            throw new VersionConflictError('optimistic lock conflict');
          }

          await this.repository.insertRiskEventLog(tx, {
            guildId: context.guildId,
            userId: context.userId,
            signalType: context.signalType,
            signalWeight: weight,
            riskScoreBefore: currentState.riskScore,
            riskScoreAfter: nextState.riskScore,
            riskDelta: nextState.riskScore - currentState.riskScore,
            metadataJson: JSON.stringify(context.metadata ?? {}),
            occurredAt: context.occurredAt,
          });

          const stats = await this.repository.getMessageStats(tx, context.guildId, context.userId, transactionContext.now);
          await this.repository.insertFeatureVector(
            tx,
            buildFeatureVector({
              context,
              stateBefore: currentState,
              stateAfter: nextState,
              signalWeight: weight,
              messageRateLast10m: stats.rate10m,
              messageRateLast1h: stats.rate1h,
              spamBurstCount10m: stats.burstCount10m,
              automodViolationCount24h: stats.automodCount24h,
              priorModerationCount: stats.priorModerationCount,
            }),
          );

          return {
            ...nextState,
            version: currentState.version + 1,
          };
        });
      } catch (error) {
        if (error instanceof VersionConflictError) {
          attempt += 1;
          continue;
        }
        throw error;
      }
    }

    throw new VersionConflictError('max retries exceeded');
  }
}
