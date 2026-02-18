export type RiskSignalType =
  | 'word_violation'
  | 'link_violation'
  | 'phishing_pattern'
  | 'invite_spam'
  | 'repeated_short_messages'
  | 'spam_burst_small'
  | 'spam_burst_medium'
  | 'spam_burst_large'
  | 'message_interval_drop'
  | 'link_ratio_spike'
  | 'mention_ratio_spike'
  | 'deleted_after_flag'
  | 'prior_warning'
  | 'prior_timeout'
  | 'alt_similarity_low'
  | 'alt_similarity_medium'
  | 'alt_similarity_high'
  | 'behavior_anomaly'
  | 'automod';

export interface AutomodSignal {
  type: string;
  severity: 1 | 2 | 3 | 4 | 5;
  metadata?: Record<string, unknown>;
}

export interface SignalContext {
  guildId: string;
  userId: string;
  signalType: RiskSignalType;
  accountAgeDays: number;
  daysInGuild: number;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface MessageEvent {
  guildId: string;
  userId: string;
  content: string;
  mentionCount: number;
  containsLink: boolean;
  createdAt: Date;
}

export interface GuildRiskConfig {
  guildId: string;
  memberCount: number;
  decayRatePerHourScaled: number;
  anomalyThresholdScaled: number;
  altDistanceThreshold: number;
  updatedAt: Date;
}

export interface UserRiskState {
  guildId: string;
  userId: string;
  riskScore: number;
  riskTrend: number;
  lastUpdatedAt: Date;
  version: number;
  avgMessageLength: number;
  shortMessageRatio: number;
  avgSecondsBetweenMessages: number;
  linkRatio: number;
  mentionRatio: number;
  altScore: number;
}

export interface RiskEventLogRecord {
  guildId: string;
  userId: string;
  signalType: RiskSignalType;
  signalWeight: number;
  riskScoreBefore: number;
  riskScoreAfter: number;
  riskDelta: number;
  metadataJson: string;
  occurredAt: Date;
}

export interface RiskFeatureVectorRecord {
  guildId: string;
  userId: string;
  riskScoreBefore: number;
  riskScoreAfter: number;
  accountAgeDays: number;
  daysInGuild: number;
  messageRateLast10m: number;
  messageRateLast1h: number;
  avgMessageLength: number;
  shortMessageRatio: number;
  linkRatio: number;
  mentionRatio: number;
  spamBurstCount10m: number;
  automodViolationCount24h: number;
  priorModerationCount: number;
  altScore: number;
  signalType: string;
  signalWeight: number;
  timestamp: Date;
}

export interface RiskEvaluationInput {
  state: UserRiskState;
  config: GuildRiskConfig;
  context: SignalContext;
  repeatCountWithin10m: number;
  appliedDecay: boolean;
}

export interface RiskEvaluationResult {
  weightApplied: number;
  scoreBefore: number;
  scoreAfter: number;
}

export interface BehaviorSnapshotInput {
  messageLength: number;
  isShortMessage: boolean;
  secondsSincePrevious: number;
  containsLink: boolean;
  mentionCount: number;
}

export interface BehaviorAnomalyResult {
  isAnomaly: boolean;
  signalType?: RiskSignalType;
  distanceScaled: number;
}

export interface AltComparisonVector {
  userId: string;
  avgMessageLength: number;
  shortMessageRatio: number;
  avgSecondsBetweenMessages: number;
  linkRatio: number;
  mentionRatio: number;
}

export interface AltLikelihood {
  userId: string;
  score: number;
  nearestBannedUserId?: string;
  distance?: number;
}

export interface TopRiskUser {
  userId: string;
  riskScore: number;
  riskTrend: number;
  altScore: number;
  lastUpdatedAt: Date;
}

export interface RiskOverview {
  totalUsers: number;
  warningCount: number;
  criticalCount: number;
  altAlertCount: number;
  averageRisk: number;
}

export interface RiskTimelinePoint {
  timestamp: Date;
  signalType: string;
  riskScoreAfter: number;
}

export interface HeatmapCell {
  hourBucket: string;
  eventCount: number;
  averageDelta: number;
}

export interface AltAlert {
  userId: string;
  altScore: number;
  riskScore: number;
}

export interface SignalDistributionRow {
  signalType: string;
  count: number;
  averageWeight: number;
}

export interface TransactionContext {
  now: Date;
}

export interface Queryable {
  execute<T>(sql: string, params?: readonly unknown[]): Promise<[T, unknown]>;
}

export interface TransactionalClient extends Queryable {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export interface RiskRepository {
  withTransaction<T>(handler: (tx: TransactionalClient, context: TransactionContext) => Promise<T>): Promise<T>;
  getGuildRiskConfig(tx: Queryable, guildId: string): Promise<GuildRiskConfig>;
  getUserRiskStateForUpdate(tx: Queryable, guildId: string, userId: string): Promise<UserRiskState | null>;
  insertUserRiskState(tx: Queryable, state: UserRiskState): Promise<void>;
  updateUserRiskStateWithVersion(tx: Queryable, state: UserRiskState, expectedVersion: number): Promise<boolean>;
  getRepeatCountWithinWindow(tx: Queryable, guildId: string, userId: string, signalType: string, windowSeconds: number, occurredAt: Date): Promise<number>;
  insertRiskEventLog(tx: Queryable, event: RiskEventLogRecord): Promise<void>;
  insertFeatureVector(tx: Queryable, vector: RiskFeatureVectorRecord): Promise<void>;
  getMessageStats(tx: Queryable, guildId: string, userId: string, now: Date): Promise<{ rate10m: number; rate1h: number; burstCount10m: number; automodCount24h: number; priorModerationCount: number }>;
  getTopRiskUsers(guildId: string, limit: number): Promise<TopRiskUser[]>;
  getRiskOverview(guildId: string): Promise<RiskOverview>;
  getUserRiskTimeline(guildId: string, userId: string): Promise<RiskTimelinePoint[]>;
  getRiskHeatmap(guildId: string): Promise<HeatmapCell[]>;
  getAltAlerts(guildId: string): Promise<AltAlert[]>;
  getSignalDistribution(guildId: string): Promise<SignalDistributionRow[]>;
  getRecentlyBannedBehaviorVectors(guildId: string, limit: number): Promise<AltComparisonVector[]>;
}
