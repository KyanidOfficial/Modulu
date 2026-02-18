import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDecay, getPiecewiseDecayRateScaled } from '../RiskDecay';
import { applyDiminishingReturn } from '../RiskCalculator';
import { computeScaledWeight } from '../RiskWeights';
import { evaluateBehaviorAnomaly } from '../evaluators/BehaviorAnomalyEvaluator';
import { calculateAltLikelihood } from '../AltDetection';
import { RiskEngine, VersionConflictError } from '../RiskEngine';
import {
  AltAlert,
  AltComparisonVector,
  GuildRiskConfig,
  HeatmapCell,
  Queryable,
  RiskEventLogRecord,
  RiskFeatureVectorRecord,
  RiskOverview,
  RiskRepository,
  RiskTimelinePoint,
  SignalDistributionRow,
  TopRiskUser,
  TransactionalClient,
  UserRiskState,
} from '../types';

const now = new Date('2026-01-01T00:00:00.000Z');

test('piecewise decay uses correct rate bands', () => {
  assert.equal(getPiecewiseDecayRateScaled(75, 100), 50);
  assert.equal(getPiecewiseDecayRateScaled(45, 100), 100);
  assert.equal(getPiecewiseDecayRateScaled(15, 100), 150);
});

test('piecewise decay applies integer formula and bonus', () => {
  const res = applyDecay({
    riskScore: 40,
    lastUpdatedAt: new Date(now.getTime() - 73 * 3600 * 1000),
    now,
    baseDecayPerHourScaled: 125,
    hasSignalsWithin72h: false,
  });
  assert.equal(res.decayPoints, 9);
  assert.equal(res.bonusApplied, 5);
  assert.equal(res.newScore, 26);
});

test('diminishing returns are bounded', () => {
  assert.equal(applyDiminishingReturn(90, 20), 92);
  assert.equal(applyDiminishingReturn(10, 50), 55);
});

test('repeat escalation caps at 3x', () => {
  const weight = computeScaledWeight({ baseWeight: 10, accountAgeDays: 50, daysInGuild: 10, repeatCountWithin10m: 10 });
  assert.equal(weight, 30);
});

test('behavior anomaly evaluator updates EMA and detects anomaly', () => {
  const state: UserRiskState = {
    guildId: '1', userId: '2', riskScore: 0, riskTrend: 0, lastUpdatedAt: now, version: 1,
    avgMessageLength: 10, shortMessageRatio: 0, avgSecondsBetweenMessages: 60, linkRatio: 0, mentionRatio: 0, altScore: 0,
  };
  const { nextState, anomaly } = evaluateBehaviorAnomaly({
    state,
    thresholdScaled: 50,
    messageLength: 200,
    isShortMessage: true,
    secondsSincePrevious: 1,
    containsLink: true,
    mentionCount: 2,
  });
  assert.ok(nextState.avgMessageLength > state.avgMessageLength);
  assert.equal(anomaly.isAnomaly, true);
});

test('alt similarity distance yields deterministic score', () => {
  const state: UserRiskState = {
    guildId: '1', userId: 'u', riskScore: 0, riskTrend: 0, lastUpdatedAt: now, version: 1,
    avgMessageLength: 100, shortMessageRatio: 100, avgSecondsBetweenMessages: 50, linkRatio: 50, mentionRatio: 20, altScore: 0,
  };
  const alt = calculateAltLikelihood(state, [{ userId: 'b', avgMessageLength: 100, shortMessageRatio: 100, avgSecondsBetweenMessages: 50, linkRatio: 50, mentionRatio: 20 }], 1200);
  assert.equal(alt.score, 100);
  assert.equal(alt.distance, 0);
});

class MockTx implements TransactionalClient {
  public async beginTransaction(): Promise<void> { return; }
  public async commit(): Promise<void> { return; }
  public async rollback(): Promise<void> { return; }
  public release(): void { return; }
  public async execute<T>(_sql: string, _params?: readonly unknown[]): Promise<[T, unknown]> { throw new Error('not used'); }
}

class MockRepo implements RiskRepository {
  private attempts = 0;
  public decaysApplied = 0;

  public constructor(private readonly conflictCount: number) {}

  private readonly baseState: UserRiskState = {
    guildId: 'g', userId: 'u', riskScore: 50, riskTrend: 0,
    lastUpdatedAt: new Date(now.getTime() - 3600 * 1000), version: 1,
    avgMessageLength: 0, shortMessageRatio: 0, avgSecondsBetweenMessages: 0, linkRatio: 0, mentionRatio: 0, altScore: 0,
  };

  public async withTransaction<T>(handler: (tx: TransactionalClient, context: { now: Date }) => Promise<T>): Promise<T> {
    return handler(new MockTx(), { now });
  }

  public async getGuildRiskConfig(_tx: Queryable, _guildId: string): Promise<GuildRiskConfig> {
    return { guildId: 'g', memberCount: 100, decayRatePerHourScaled: 125, anomalyThresholdScaled: 300, altDistanceThreshold: 1200, updatedAt: now };
  }

  public async getUserRiskStateForUpdate(_tx: Queryable, _guildId: string, _userId: string): Promise<UserRiskState> {
    return this.baseState;
  }

  public async insertUserRiskState(_tx: Queryable, _state: UserRiskState): Promise<void> { return; }

  public async updateUserRiskStateWithVersion(_tx: Queryable, state: UserRiskState, _expectedVersion: number): Promise<boolean> {
    if (state.riskScore < this.baseState.riskScore) {
      this.decaysApplied += 1;
    }
    this.attempts += 1;
    return this.attempts > this.conflictCount;
  }

  public async getRepeatCountWithinWindow(_tx: Queryable, _guildId: string, _userId: string, _signalType: string, _windowSeconds: number, _occurredAt: Date): Promise<number> { return 0; }
  public async insertRiskEventLog(_tx: Queryable, _event: RiskEventLogRecord): Promise<void> { return; }
  public async insertFeatureVector(_tx: Queryable, _vector: RiskFeatureVectorRecord): Promise<void> { return; }
  public async getMessageStats(_tx: Queryable, _guildId: string, _userId: string, _now: Date): Promise<{ rate10m: number; rate1h: number; burstCount10m: number; automodCount24h: number; priorModerationCount: number }> {
    return { rate10m: 1, rate1h: 1, burstCount10m: 1, automodCount24h: 0, priorModerationCount: 0 };
  }
  public async getTopRiskUsers(_guildId: string, _limit: number): Promise<TopRiskUser[]> { return []; }
  public async getRiskOverview(_guildId: string): Promise<RiskOverview> { return { totalUsers: 0, warningCount: 0, criticalCount: 0, altAlertCount: 0, averageRisk: 0 }; }
  public async getUserRiskTimeline(_guildId: string, _userId: string): Promise<RiskTimelinePoint[]> { return []; }
  public async getRiskHeatmap(_guildId: string): Promise<HeatmapCell[]> { return []; }
  public async getAltAlerts(_guildId: string): Promise<AltAlert[]> { return []; }
  public async getSignalDistribution(_guildId: string): Promise<SignalDistributionRow[]> { return []; }
  public async getRecentlyBannedBehaviorVectors(_guildId: string, _limit: number): Promise<AltComparisonVector[]> { return []; }
}

test('engine retries on optimistic conflict max 3 and succeeds', async () => {
  const repo = new MockRepo(2);
  const engine = new RiskEngine(repo);
  const result = await engine.recordSignal({ guildId: 'g', userId: 'u', signalType: 'word_violation', accountAgeDays: 30, daysInGuild: 30, occurredAt: now });
  assert.ok(result.riskScore >= 0);
});

test('engine throws after max retry conflicts', async () => {
  const repo = new MockRepo(3);
  const engine = new RiskEngine(repo);
  await assert.rejects(
    engine.recordSignal({ guildId: 'g', userId: 'u', signalType: 'word_violation', accountAgeDays: 30, daysInGuild: 30, occurredAt: now }),
    VersionConflictError,
  );
});

test('no double decay in one transaction path', async () => {
  const repo = new MockRepo(0);
  const engine = new RiskEngine(repo);
  await engine.recordSignal({ guildId: 'g', userId: 'u', signalType: 'word_violation', accountAgeDays: 30, daysInGuild: 30, occurredAt: now });
  assert.equal(repo.decaysApplied <= 1, true);
});

test('integer precision remains integer safe', () => {
  const value = computeScaledWeight({ baseWeight: 18, accountAgeDays: 1, daysInGuild: 0, repeatCountWithin10m: 1, automodSeverity: 3 });
  assert.equal(Number.isInteger(value), true);
});
