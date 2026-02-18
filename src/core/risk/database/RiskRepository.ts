import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
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
  TransactionContext,
  TransactionalClient,
  UserRiskState,
} from '../types';
import { getDynamicBaseDecayPer24h, toDecayRatePerHourScaled } from '../RiskDecay';

class MySqlTxClient implements TransactionalClient {
  public constructor(private readonly connection: PoolConnection) {}

  public async execute<T>(sql: string, params: readonly unknown[] = []): Promise<[T, unknown]> {
    return this.connection.execute(sql, params) as Promise<[T, unknown]>;
  }

  public async beginTransaction(): Promise<void> {
    await this.connection.beginTransaction();
  }

  public async commit(): Promise<void> {
    await this.connection.commit();
  }

  public async rollback(): Promise<void> {
    await this.connection.rollback();
  }

  public release(): void {
    this.connection.release();
  }
}

export class MySqlRiskRepository implements RiskRepository {
  public constructor(private readonly pool: Pool) {}

  public async withTransaction<T>(handler: (tx: TransactionalClient, context: TransactionContext) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    const tx = new MySqlTxClient(connection);
    try {
      await tx.beginTransaction();
      const result = await handler(tx, { now: new Date() });
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.release();
    }
  }

  public async getGuildRiskConfig(tx: Queryable, guildId: string): Promise<GuildRiskConfig> {
    const [rows] = await tx.execute<RowDataPacket[]>(
      'SELECT guild_id, member_count, decay_rate_per_hour_scaled, anomaly_threshold_scaled, alt_distance_threshold, updated_at FROM guild_risk_config WHERE guild_id = ? LIMIT 1',
      [guildId],
    );

    if (rows.length === 0) {
      const memberCount = 0;
      const decayRatePerHourScaled = toDecayRatePerHourScaled(getDynamicBaseDecayPer24h(memberCount));
      await tx.execute<ResultSetHeader>(
        'INSERT INTO guild_risk_config (guild_id, member_count, decay_rate_per_hour_scaled, anomaly_threshold_scaled, alt_distance_threshold) VALUES (?, ?, ?, 300, 1200)',
        [guildId, memberCount, decayRatePerHourScaled],
      );
      return {
        guildId,
        memberCount,
        decayRatePerHourScaled,
        anomalyThresholdScaled: 300,
        altDistanceThreshold: 1200,
        updatedAt: new Date(),
      };
    }

    const row = rows[0];
    return {
      guildId: String(row.guild_id),
      memberCount: Number(row.member_count),
      decayRatePerHourScaled: Number(row.decay_rate_per_hour_scaled),
      anomalyThresholdScaled: Number(row.anomaly_threshold_scaled),
      altDistanceThreshold: Number(row.alt_distance_threshold),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  public async getUserRiskStateForUpdate(tx: Queryable, guildId: string, userId: string): Promise<UserRiskState | null> {
    const [rows] = await tx.execute<RowDataPacket[]>(
      'SELECT guild_id, user_id, risk_score, risk_trend, last_updated_at, version, avg_message_length, short_message_ratio, avg_seconds_between_messages, link_ratio, mention_ratio, alt_score FROM user_risk_state WHERE guild_id = ? AND user_id = ? FOR UPDATE',
      [guildId, userId],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      guildId: String(row.guild_id),
      userId: String(row.user_id),
      riskScore: Number(row.risk_score),
      riskTrend: Number(row.risk_trend),
      lastUpdatedAt: new Date(String(row.last_updated_at)),
      version: Number(row.version),
      avgMessageLength: Number(row.avg_message_length),
      shortMessageRatio: Number(row.short_message_ratio),
      avgSecondsBetweenMessages: Number(row.avg_seconds_between_messages),
      linkRatio: Number(row.link_ratio),
      mentionRatio: Number(row.mention_ratio),
      altScore: Number(row.alt_score),
    };
  }

  public async insertUserRiskState(tx: Queryable, state: UserRiskState): Promise<void> {
    await tx.execute<ResultSetHeader>(
      'INSERT INTO user_risk_state (guild_id, user_id, risk_score, risk_trend, last_updated_at, version, avg_message_length, short_message_ratio, avg_seconds_between_messages, link_ratio, mention_ratio, alt_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        state.guildId,
        state.userId,
        state.riskScore,
        state.riskTrend,
        state.lastUpdatedAt,
        state.version,
        state.avgMessageLength,
        state.shortMessageRatio,
        state.avgSecondsBetweenMessages,
        state.linkRatio,
        state.mentionRatio,
        state.altScore,
      ],
    );
  }

  public async updateUserRiskStateWithVersion(tx: Queryable, state: UserRiskState, expectedVersion: number): Promise<boolean> {
    const [result] = await tx.execute<ResultSetHeader>(
      'UPDATE user_risk_state SET risk_score = ?, risk_trend = ?, last_updated_at = ?, version = version + 1, avg_message_length = ?, short_message_ratio = ?, avg_seconds_between_messages = ?, link_ratio = ?, mention_ratio = ?, alt_score = ? WHERE guild_id = ? AND user_id = ? AND version = ?',
      [
        state.riskScore,
        state.riskTrend,
        state.lastUpdatedAt,
        state.avgMessageLength,
        state.shortMessageRatio,
        state.avgSecondsBetweenMessages,
        state.linkRatio,
        state.mentionRatio,
        state.altScore,
        state.guildId,
        state.userId,
        expectedVersion,
      ],
    );
    return result.affectedRows === 1;
  }

  public async getRepeatCountWithinWindow(tx: Queryable, guildId: string, userId: string, signalType: string, windowSeconds: number, occurredAt: Date): Promise<number> {
    const [rows] = await tx.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS count_value FROM risk_event_log WHERE guild_id = ? AND user_id = ? AND signal_type = ? AND occurred_at >= DATE_SUB(?, INTERVAL ? SECOND)',
      [guildId, userId, signalType, occurredAt, windowSeconds],
    );
    return Number(rows[0]?.count_value ?? 0);
  }

  public async insertRiskEventLog(tx: Queryable, event: RiskEventLogRecord): Promise<void> {
    await tx.execute<ResultSetHeader>(
      'INSERT INTO risk_event_log (guild_id, user_id, signal_type, signal_weight, risk_score_before, risk_score_after, risk_delta, metadata_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [event.guildId, event.userId, event.signalType, event.signalWeight, event.riskScoreBefore, event.riskScoreAfter, event.riskDelta, event.metadataJson, event.occurredAt],
    );
  }

  public async insertFeatureVector(tx: Queryable, vector: RiskFeatureVectorRecord): Promise<void> {
    await tx.execute<ResultSetHeader>(
      'INSERT INTO risk_feature_vector (guild_id, user_id, risk_score_before, risk_score_after, account_age_days, days_in_guild, message_rate_last_10m, message_rate_last_1h, avg_message_length, short_message_ratio, link_ratio, mention_ratio, spam_burst_count_10m, automod_violation_count_24h, prior_moderation_count, alt_score, signal_type, signal_weight, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        vector.guildId,
        vector.userId,
        vector.riskScoreBefore,
        vector.riskScoreAfter,
        vector.accountAgeDays,
        vector.daysInGuild,
        vector.messageRateLast10m,
        vector.messageRateLast1h,
        vector.avgMessageLength,
        vector.shortMessageRatio,
        vector.linkRatio,
        vector.mentionRatio,
        vector.spamBurstCount10m,
        vector.automodViolationCount24h,
        vector.priorModerationCount,
        vector.altScore,
        vector.signalType,
        vector.signalWeight,
        vector.timestamp,
      ],
    );
  }

  public async getMessageStats(tx: Queryable, guildId: string, userId: string, now: Date): Promise<{ rate10m: number; rate1h: number; burstCount10m: number; automodCount24h: number; priorModerationCount: number }> {
    const [rows] = await tx.execute<RowDataPacket[]>(
      `SELECT
          SUM(CASE WHEN occurred_at >= DATE_SUB(?, INTERVAL 10 MINUTE) THEN 1 ELSE 0 END) AS count_10m,
          SUM(CASE WHEN occurred_at >= DATE_SUB(?, INTERVAL 1 HOUR) THEN 1 ELSE 0 END) AS count_1h,
          SUM(CASE WHEN occurred_at >= DATE_SUB(?, INTERVAL 24 HOUR) AND signal_type = 'automod' THEN 1 ELSE 0 END) AS automod_24h,
          SUM(CASE WHEN signal_type IN ('prior_warning','prior_timeout') THEN 1 ELSE 0 END) AS prior_mod
       FROM risk_event_log
       WHERE guild_id = ? AND user_id = ?`,
      [now, now, now, guildId, userId],
    );
    const row = rows[0];
    return {
      rate10m: Number(row.count_10m ?? 0),
      rate1h: Number(row.count_1h ?? 0),
      burstCount10m: Number(row.count_10m ?? 0),
      automodCount24h: Number(row.automod_24h ?? 0),
      priorModerationCount: Number(row.prior_mod ?? 0),
    };
  }

  public async getTopRiskUsers(guildId: string, limit: number): Promise<TopRiskUser[]> { const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT user_id, risk_score, risk_trend, alt_score, last_updated_at FROM user_risk_state WHERE guild_id = ? ORDER BY risk_score DESC, alt_score DESC LIMIT ?', [guildId, limit]); return rows.map((r) => ({ userId: String(r.user_id), riskScore: Number(r.risk_score), riskTrend: Number(r.risk_trend), altScore: Number(r.alt_score), lastUpdatedAt: new Date(String(r.last_updated_at)) })); }

  public async getRiskOverview(guildId: string): Promise<RiskOverview> { const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total_users, SUM(CASE WHEN risk_score >= 60 THEN 1 ELSE 0 END) AS warning_count, SUM(CASE WHEN risk_score >= 80 THEN 1 ELSE 0 END) AS critical_count, SUM(CASE WHEN alt_score >= 70 THEN 1 ELSE 0 END) AS alt_alert_count, AVG(risk_score) AS avg_risk FROM user_risk_state WHERE guild_id = ?', [guildId]); const row = rows[0]; return { totalUsers: Number(row.total_users ?? 0), warningCount: Number(row.warning_count ?? 0), criticalCount: Number(row.critical_count ?? 0), altAlertCount: Number(row.alt_alert_count ?? 0), averageRisk: Math.floor(Number(row.avg_risk ?? 0)) }; }

  public async getUserRiskTimeline(guildId: string, userId: string): Promise<RiskTimelinePoint[]> { const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT occurred_at, signal_type, risk_score_after FROM risk_event_log WHERE guild_id = ? AND user_id = ? ORDER BY occurred_at DESC LIMIT 200', [guildId, userId]); return rows.map((row) => ({ timestamp: new Date(String(row.occurred_at)), signalType: String(row.signal_type), riskScoreAfter: Number(row.risk_score_after) })); }

  public async getRiskHeatmap(guildId: string): Promise<HeatmapCell[]> { const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT DATE_FORMAT(occurred_at, '%Y-%m-%d %H:00:00') AS hour_bucket, COUNT(*) AS event_count, AVG(risk_delta) AS avg_delta FROM risk_event_log WHERE guild_id = ? GROUP BY DATE_FORMAT(occurred_at, '%Y-%m-%d %H:00:00') ORDER BY hour_bucket DESC LIMIT 168", [guildId]); return rows.map((row) => ({ hourBucket: String(row.hour_bucket), eventCount: Number(row.event_count), averageDelta: Math.floor(Number(row.avg_delta ?? 0)) })); }

  public async getAltAlerts(guildId: string): Promise<AltAlert[]> { const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT user_id, alt_score, risk_score FROM user_risk_state WHERE guild_id = ? AND alt_score >= 70 ORDER BY alt_score DESC', [guildId]); return rows.map((row) => ({ userId: String(row.user_id), altScore: Number(row.alt_score), riskScore: Number(row.risk_score) })); }

  public async getSignalDistribution(guildId: string): Promise<SignalDistributionRow[]> { const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT signal_type, COUNT(*) AS count_value, AVG(signal_weight) AS avg_weight FROM risk_event_log WHERE guild_id = ? GROUP BY signal_type ORDER BY count_value DESC', [guildId]); return rows.map((row) => ({ signalType: String(row.signal_type), count: Number(row.count_value), averageWeight: Math.floor(Number(row.avg_weight ?? 0)) })); }

  public async getRecentlyBannedBehaviorVectors(guildId: string, limit: number): Promise<AltComparisonVector[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT user_id, avg_message_length, short_message_ratio, avg_seconds_between_messages, link_ratio, mention_ratio FROM user_behavior_snapshot WHERE guild_id = ? AND is_banned = 1 ORDER BY banned_at DESC LIMIT ?',
      [guildId, limit],
    );

    return rows.map((row) => ({
      userId: String(row.user_id),
      avgMessageLength: Number(row.avg_message_length),
      shortMessageRatio: Number(row.short_message_ratio),
      avgSecondsBetweenMessages: Number(row.avg_seconds_between_messages),
      linkRatio: Number(row.link_ratio),
      mentionRatio: Number(row.mention_ratio),
    }));
  }
}
