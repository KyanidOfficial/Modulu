const mysql = require("mysql2/promise")

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5
})

let moderationLogsReady = false
let automodReady = false

const ensureModerationLogsTable = async () => {
  if (moderationLogsReady) return

  await pool.query(
    `
    CREATE TABLE IF NOT EXISTS moderation_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(32) NOT NULL,
      action VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NULL,
      moderator_id VARCHAR(32) NULL,
      reason TEXT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `
  )

  moderationLogsReady = true
}

const ensureAutomodTables = async () => {
  if (automodReady) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automod_configs (
      guild_id VARCHAR(32) PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      config_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moderation_cases (
      case_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      actor_id VARCHAR(32) NOT NULL,
      action_type VARCHAR(32) NOT NULL,
      reason TEXT NULL,
      context_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cases_guild_case (guild_id, case_id),
      INDEX idx_cases_guild_user (guild_id, user_id, created_at)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS infractions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      case_id BIGINT NOT NULL,
      type VARCHAR(32) NOT NULL,
      severity INT NOT NULL,
      source_message_id VARCHAR(32) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_infractions_guild_user (guild_id, user_id, created_at),
      UNIQUE KEY uniq_infraction_case (case_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reputation (
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      score INT NOT NULL DEFAULT 0,
      last_decay_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_reward_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id),
      INDEX idx_reputation_guild_score (guild_id, score)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reputation_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      delta INT NOT NULL,
      source_type VARCHAR(32) NOT NULL,
      case_id BIGINT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rep_events_guild_user (guild_id, user_id, created_at)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automod_actions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      idempotency_key VARCHAR(255) NOT NULL,
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      action_type VARCHAR(32) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_action_key (idempotency_key)
    )
  `)

  automodReady = true
}

const defaultAutomodConfig = {
  enabled: false,
  bypassRoleIds: [],
  staffRoleIds: [],
  thresholds: {
    burstCount: 6,
    burstWindowMs: 5000,
    duplicateCount: 3,
    mentionCount: 6,
    inviteDetection: true,
    regexBlacklist: []
  },
  escalation: {
    warnAt: 1,
    timeoutAt: 2,
    timeoutMs: 60000,
    kickAt: 4,
    banAt: 6
  },
  contextMessageLimit: 10,
  reputationImpact: {
    warn: -2,
    timeout: -5,
    kick: -10,
    ban: -20
  }
}

module.exports = {
  async get(guildId) {
    const [rows] = await pool.query(
      "SELECT setup_json FROM servers WHERE guild_id = ?",
      [guildId]
    )

    if (!rows.length) return {}
    return JSON.parse(rows[0].setup_json)
  },

  async save(guildId, data) {
    await pool.query(
      "INSERT INTO servers (guild_id, setup_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE setup_json = VALUES(setup_json)",
      [guildId, JSON.stringify(data)]
    )
  },

  async addWarning(data) {
    await pool.query(
      "INSERT INTO warnings (id, guild_id, user_id, moderator_id, reason, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        data.id,
        data.guildId,
        data.userId,
        data.moderatorId,
        data.reason,
        data.active ? 1 : 0,
        data.createdAt
      ]
    )
  },

  async revokeWarning(id) {
    await pool.query(
      "UPDATE warnings SET active = 0 WHERE id = ?",
      [id]
    )
  },

  async getWarnings(guildId, userId) {
    const [rows] = await pool.query(
      "SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC",
      [guildId, userId]
    )
    return rows
  },

  async addSpamEvent({ guildId, userId, type, metadata }) {
    await pool.query(
      "INSERT INTO spam_events (guild_id, user_id, type, metadata, created_at) VALUES (?, ?, ?, ?, NOW())",
      [guildId, userId, type, JSON.stringify(metadata || {})]
    )
  },

  async cleanupSpamEvents(minutes = 30) {
    await pool.query(
      `
      DELETE FROM spam_events
      WHERE created_at < NOW() - INTERVAL ? MINUTE
      `,
      [minutes]
    )
  },

  async incrementViolation({ guildId, userId, type }) {
    await pool.query(
      `
      INSERT INTO user_violations (guild_id, user_id, type, count, last_trigger)
      VALUES (?, ?, ?, 1, NOW())
      ON DUPLICATE KEY UPDATE
        count = count + 1,
        last_trigger = NOW()
      `,
      [guildId, userId, type]
    )
  },

  async getViolation(guildId, userId, type) {
    const [rows] = await pool.query(
      "SELECT * FROM user_violations WHERE guild_id = ? AND user_id = ? AND type = ?",
      [guildId, userId, type]
    )
    return rows[0]
  },

  async resetViolation(guildId, userId, type) {
    await pool.query(
      "DELETE FROM user_violations WHERE guild_id = ? AND user_id = ? AND type = ?",
      [guildId, userId, type]
    )
  },

  async addJoin(guildId) {
    await pool.query(
      "INSERT INTO join_velocity (guild_id, joined_at) VALUES (?, NOW())",
      [guildId]
    )
  },

  async countRecentJoins(guildId, seconds) {
    const [rows] = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM join_velocity
      WHERE guild_id = ?
        AND joined_at >= NOW() - INTERVAL ? SECOND
      `,
      [guildId, seconds]
    )
    return rows[0].count
  },

  async setRaidState({ guildId, active, joinCount, durationSeconds }) {
    await pool.query(
      `
      INSERT INTO raid_state (guild_id, active, join_count, started_at, ends_at)
      VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))
      ON DUPLICATE KEY UPDATE
        active = VALUES(active),
        join_count = VALUES(join_count),
        started_at = NOW(),
        ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
      `,
      [guildId, active ? 1 : 0, joinCount, durationSeconds]
    )
  },

  async getRaidState(guildId) {
    const [rows] = await pool.query(
      "SELECT * FROM raid_state WHERE guild_id = ?",
      [guildId]
    )
    return rows[0]
  },

  async cleanupViolations(minutes = 30) {
    await pool.query(
      `
      DELETE FROM user_violations
      WHERE last_trigger < NOW() - INTERVAL ? MINUTE
      `,
      [minutes]
    )
  },

  async addModerationLog({ guildId, action, userId, moderatorId, reason, metadata }) {
    await ensureModerationLogsTable()
    const [result] = await pool.query(
      `
      INSERT INTO moderation_logs
        (guild_id, action, user_id, moderator_id, reason, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        guildId,
        action,
        userId || null,
        moderatorId || null,
        reason || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    )
    return result.insertId
  },

  async getAutomodConfig(guildId) {
    await ensureAutomodTables()
    const [rows] = await pool.query(
      "SELECT enabled, config_json FROM automod_configs WHERE guild_id = ?",
      [guildId]
    )
    if (!rows.length) return defaultAutomodConfig
    return {
      ...defaultAutomodConfig,
      ...(rows[0].config_json || {}),
      enabled: rows[0].enabled === 1
    }
  },

  async setAutomodConfig(guildId, patch = {}) {
    await ensureAutomodTables()
    const current = await this.getAutomodConfig(guildId)
    const next = {
      ...current,
      ...patch,
      thresholds: { ...current.thresholds, ...(patch.thresholds || {}) },
      escalation: { ...current.escalation, ...(patch.escalation || {}) },
      reputationImpact: { ...current.reputationImpact, ...(patch.reputationImpact || {}) }
    }

    await pool.query(
      `INSERT INTO automod_configs (guild_id, enabled, config_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), config_json = VALUES(config_json)`,
      [guildId, next.enabled ? 1 : 0, JSON.stringify(next)]
    )

    return next
  },

  async registerActionIdempotency(key, guildId, userId, actionType) {
    await ensureAutomodTables()
    try {
      await pool.query(
        "INSERT INTO automod_actions (idempotency_key, guild_id, user_id, action_type) VALUES (?, ?, ?, ?)",
        [key, guildId, userId, actionType]
      )
      return true
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") return false
      throw error
    }
  },

  async createCase({ guildId, userId, actorId, actionType, reason, context }) {
    await ensureAutomodTables()
    const [result] = await pool.query(
      `INSERT INTO moderation_cases (guild_id, user_id, actor_id, action_type, reason, context_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [guildId, userId, actorId, actionType, reason || null, JSON.stringify(context || {})]
    )
    return result.insertId
  },

  async createInfraction({ guildId, userId, caseId, type, severity, sourceMessageId }) {
    await ensureAutomodTables()
    await pool.query(
      `INSERT INTO infractions (guild_id, user_id, case_id, type, severity, source_message_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [guildId, userId, caseId, type, severity, sourceMessageId || null]
    )
  },

  async getInfractionsCount(guildId, userId) {
    await ensureAutomodTables()
    const [rows] = await pool.query(
      "SELECT COUNT(*) as count FROM infractions WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )
    return Number(rows[0]?.count || 0)
  },

  async getCaseById(guildId, caseId) {
    await ensureAutomodTables()
    const [rows] = await pool.query(
      "SELECT * FROM moderation_cases WHERE guild_id = ? AND case_id = ?",
      [guildId, caseId]
    )
    return rows[0] || null
  },

  async getCaseHistory(guildId, userId, limit = 10, offset = 0) {
    await ensureAutomodTables()
    const [rows] = await pool.query(
      "SELECT * FROM moderation_cases WHERE guild_id = ? AND user_id = ? ORDER BY case_id DESC LIMIT ? OFFSET ?",
      [guildId, userId, limit, offset]
    )
    return rows
  },

  async applyReputationDelta({ guildId, userId, delta, sourceType, caseId, metadata }) {
    await ensureAutomodTables()
    await pool.query(
      "INSERT INTO reputation (guild_id, user_id, score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE score = score + VALUES(score)",
      [guildId, userId, delta]
    )
    await pool.query(
      "INSERT INTO reputation_events (guild_id, user_id, delta, source_type, case_id, metadata) VALUES (?, ?, ?, ?, ?, ?)",
      [guildId, userId, delta, sourceType, caseId || null, JSON.stringify(metadata || {})]
    )
  },

  async getReputation(guildId, userId) {
    await ensureAutomodTables()
    const [rows] = await pool.query(
      "SELECT * FROM reputation WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )
    return rows[0] || { guild_id: guildId, user_id: userId, score: 0 }
  },

  async adjustReputation(guildId, userId, delta, moderatorId, reason) {
    await this.applyReputationDelta({
      guildId,
      userId,
      delta,
      sourceType: "MANUAL",
      metadata: { moderatorId, reason }
    })
  },

  async getReputationLeaderboard(guildId, limit = 10, offset = 0) {
    await ensureAutomodTables()
    const [rows] = await pool.query(
      "SELECT * FROM reputation WHERE guild_id = ? ORDER BY score DESC, user_id ASC LIMIT ? OFFSET ?",
      [guildId, limit, offset]
    )
    return rows
  },

  async processReputationDecay(cursorId = 0, batchSize = 100, decayPoints = 1) {
    await ensureAutomodTables()
    const [rows] = await pool.query(
      "SELECT guild_id, user_id, score FROM reputation WHERE score > 0 AND CAST(user_id AS UNSIGNED) > ? ORDER BY CAST(user_id AS UNSIGNED) ASC LIMIT ?",
      [cursorId, batchSize]
    )

    for (const row of rows) {
      await pool.query(
        "UPDATE reputation SET score = GREATEST(score - ?, 0), last_decay_at = NOW() WHERE guild_id = ? AND user_id = ?",
        [decayPoints, row.guild_id, row.user_id]
      )
      await pool.query(
        "INSERT INTO reputation_events (guild_id, user_id, delta, source_type, metadata) VALUES (?, ?, ?, 'DECAY', ?)",
        [row.guild_id, row.user_id, -Math.min(decayPoints, row.score), JSON.stringify({})]
      )
    }

    return {
      rows,
      nextCursor: rows.length ? Number(rows[rows.length - 1].user_id) : null
    }
  },

  async processCleanRewards(cursorId = 0, batchSize = 100, rewardPoints = 1) {
    await ensureAutomodTables()
    const [rows] = await pool.query(
      `SELECT r.guild_id, r.user_id
       FROM reputation r
       LEFT JOIN infractions i
         ON i.guild_id = r.guild_id
         AND i.user_id = r.user_id
         AND i.created_at > NOW() - INTERVAL 1 DAY
       WHERE i.id IS NULL
         AND CAST(r.user_id AS UNSIGNED) > ?
       ORDER BY CAST(r.user_id AS UNSIGNED) ASC
       LIMIT ?`,
      [cursorId, batchSize]
    )

    for (const row of rows) {
      await pool.query(
        "UPDATE reputation SET score = score + ?, last_reward_at = NOW() WHERE guild_id = ? AND user_id = ?",
        [rewardPoints, row.guild_id, row.user_id]
      )
      await pool.query(
        "INSERT INTO reputation_events (guild_id, user_id, delta, source_type, metadata) VALUES (?, ?, ?, 'CLEAN_REWARD', ?)",
        [row.guild_id, row.user_id, rewardPoints, JSON.stringify({})]
      )
    }

    return {
      rows,
      nextCursor: rows.length ? Number(rows[rows.length - 1].user_id) : null
    }
  }
}
