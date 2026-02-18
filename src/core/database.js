const { executeQuery } = require("./database/mysql")

let moderationLogsReady = false
let automodTablesReady = false
let warningTablesReady = false


const safeJsonStringify = value => {
  if (value === undefined) return null

  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify({ serializationError: true })
  }
}

const ensureWarningTables = async () => {
  if (warningTablesReady) return

  await executeQuery(
    `
    CREATE TABLE IF NOT EXISTS warning_users (
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id)
    )
    `
  )

  await executeQuery(
    `
    CREATE TABLE IF NOT EXISTS mod_warnings (
      id VARCHAR(32) NOT NULL,
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      moderator_id VARCHAR(32) NOT NULL,
      reason TEXT NOT NULL,
      source VARCHAR(32) NOT NULL DEFAULT 'manual',
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      revoked_at BIGINT NULL,
      PRIMARY KEY (id),
      INDEX idx_warnings_lookup (guild_id, user_id, created_at),
      INDEX idx_warnings_duplicate (guild_id, user_id, moderator_id, active, created_at)
    )
    `
  )

  warningTablesReady = true
}

const ensureModerationLogsTable = async () => {
  if (moderationLogsReady) return

  await executeQuery(
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
  if (automodTablesReady) return

  await executeQuery(
    `
    CREATE TABLE IF NOT EXISTS automod_configs (
      guild_id VARCHAR(32) PRIMARY KEY,
      config_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
    `
  )

  await executeQuery(
    `
    CREATE TABLE IF NOT EXISTS automod_infractions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      trigger_type VARCHAR(64) NOT NULL,
      reason TEXT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_automod_infraction_lookup (guild_id, user_id, trigger_type, created_at)
    )
    `
  )

  await executeQuery(
    `
    CREATE TABLE IF NOT EXISTS automod_cooldowns (
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      trigger_type VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      PRIMARY KEY (guild_id, user_id, trigger_type)
    )
    `
  )

  automodTablesReady = true
}

module.exports = {
  async get(guildId) {
    const [rows] = await executeQuery(
      "SELECT setup_json FROM servers WHERE guild_id = ?",
      [guildId]
    )

    if (!rows.length) return {}
    return JSON.parse(rows[0].setup_json)
  },

  async save(guildId, data) {
    await executeQuery(
      "INSERT INTO servers (guild_id, setup_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE setup_json = VALUES(setup_json)",
      [guildId, JSON.stringify(data)]
    )
  },

  async addWarning(data) {
    await ensureWarningTables()
    await executeQuery(
      `
      INSERT INTO mod_warnings (id, guild_id, user_id, moderator_id, reason, source, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.id,
        data.guildId,
        data.userId,
        data.moderatorId,
        data.reason,
        data.source || "manual",
        data.active ? 1 : 0,
        data.createdAt
      ]
    )
  },

  async revokeWarning(guildId, userId, id) {
    await ensureWarningTables()
    await executeQuery(
      "UPDATE mod_warnings SET active = 0, revoked_at = ? WHERE guild_id = ? AND user_id = ? AND id = ?",
      [Date.now(), guildId, userId, id]
    )
  },

  async getWarnings(guildId, userId) {
    await ensureWarningTables()
    await this.ensureWarningUser(guildId, userId)
    const [rows] = await executeQuery(
      "SELECT * FROM mod_warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC",
      [guildId, userId]
    )
    return rows
  },

  async ensureWarningUser(guildId, userId) {
    await ensureWarningTables()
    await executeQuery(
      `
      INSERT INTO warning_users (guild_id, user_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
      `,
      [guildId, userId]
    )
  },

  async createWarning({ guildId, userId, moderatorId, reason, source = "manual" }) {
    await ensureWarningTables()
    await this.ensureWarningUser(guildId, userId)

    const warningId = `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`

    await this.addWarning({
      id: warningId,
      guildId,
      userId,
      moderatorId,
      reason,
      source,
      active: true,
      createdAt: Date.now()
    })

    return warningId
  },

  async getWarningById(guildId, userId, warningId) {
    await ensureWarningTables()
    const [rows] = await executeQuery(
      "SELECT * FROM mod_warnings WHERE guild_id = ? AND user_id = ? AND id = ? LIMIT 1",
      [guildId, userId, warningId]
    )
    return rows[0] || null
  },

  async clearWarnings(guildId, userId) {
    await ensureWarningTables()
    const [result] = await executeQuery(
      "UPDATE mod_warnings SET active = 0, revoked_at = ? WHERE guild_id = ? AND user_id = ? AND active = 1",
      [Date.now(), guildId, userId]
    )
    return result.affectedRows || 0
  },

  async countWarnings(guildId, userId, activeOnly = false) {
    await ensureWarningTables()
    await this.ensureWarningUser(guildId, userId)
    const [rows] = await executeQuery(
      `
      SELECT COUNT(*) AS count
      FROM mod_warnings
      WHERE guild_id = ?
        AND user_id = ?
        ${activeOnly ? "AND active = 1" : ""}
      `,
      [guildId, userId]
    )
    return rows[0]?.count || 0
  },

  async hasDuplicateWarning({ guildId, userId, moderatorId, reason, withinMs }) {
    await ensureWarningTables()
    const threshold = Date.now() - Math.max(1000, withinMs || 10000)
    const [rows] = await executeQuery(
      `
      SELECT id
      FROM mod_warnings
      WHERE guild_id = ?
        AND user_id = ?
        AND moderator_id = ?
        AND reason = ?
        AND active = 1
        AND created_at >= ?
      LIMIT 1
      `,
      [guildId, userId, moderatorId, reason, threshold]
    )
    return rows.length > 0
  },

  async addSpamEvent({ guildId, userId, type, metadata }) {
    await executeQuery(
      "INSERT INTO spam_events (guild_id, user_id, type, metadata, created_at) VALUES (?, ?, ?, ?, NOW())",
      [guildId, userId, type, JSON.stringify(metadata || {})]
    )
  },

  async cleanupSpamEvents(minutes = 30) {
    await executeQuery(
      `
      DELETE FROM spam_events
      WHERE created_at < NOW() - INTERVAL ? MINUTE
      `,
      [minutes]
    )
  },

  async incrementViolation({ guildId, userId, type }) {
    await executeQuery(
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
    const [rows] = await executeQuery(
      "SELECT * FROM user_violations WHERE guild_id = ? AND user_id = ? AND type = ?",
      [guildId, userId, type]
    )
    return rows[0]
  },

  async resetViolation(guildId, userId, type) {
    await executeQuery(
      "DELETE FROM user_violations WHERE guild_id = ? AND user_id = ? AND type = ?",
      [guildId, userId, type]
    )
  },

  async addJoin(guildId) {
    await executeQuery(
      "INSERT INTO join_velocity (guild_id, joined_at) VALUES (?, NOW())",
      [guildId]
    )
  },

  async countRecentJoins(guildId, seconds) {
    const [rows] = await executeQuery(
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
    await executeQuery(
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
    const [rows] = await executeQuery(
      "SELECT * FROM raid_state WHERE guild_id = ?",
      [guildId]
    )
    return rows[0]
  },

  async cleanupViolations(minutes = 30) {
    await executeQuery(
      `
      DELETE FROM user_violations
      WHERE last_trigger < NOW() - INTERVAL ? MINUTE
      `,
      [minutes]
    )
  },

  async addModerationLog({ guildId, action, userId, moderatorId, reason, metadata }) {
    await ensureModerationLogsTable()
    const [result] = await executeQuery(
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
        safeJsonStringify(metadata)
      ]
    )
    return result.insertId
  },

  async getAutomodConfig(guildId) {
    await ensureAutomodTables()
    const [rows] = await executeQuery(
      "SELECT config_json FROM automod_configs WHERE guild_id = ?",
      [guildId]
    )
    if (!rows.length) return null
    return rows[0].config_json
  },

  async saveAutomodConfig(guildId, config) {
    await ensureAutomodTables()
    await executeQuery(
      `
      INSERT INTO automod_configs (guild_id, config_json)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE config_json = VALUES(config_json)
      `,
      [guildId, JSON.stringify(config)]
    )
  },

  async addAutomodInfraction({ guildId, userId, triggerType, reason, metadata }) {
    await ensureAutomodTables()
    await executeQuery(
      `
      INSERT INTO automod_infractions
        (guild_id, user_id, trigger_type, reason, metadata)
      VALUES (?, ?, ?, ?, ?)
      `,
      [guildId, userId, triggerType, reason || null, safeJsonStringify(metadata)]
    )
  },

  async countAutomodInfractions(guildId, userId, triggerType, withinMinutes = 1440) {
    await ensureAutomodTables()
    const [rows] = await executeQuery(
      `
      SELECT COUNT(*) AS count
      FROM automod_infractions
      WHERE guild_id = ?
        AND user_id = ?
        AND trigger_type = ?
        AND created_at >= NOW() - INTERVAL ? MINUTE
      `,
      [guildId, userId, triggerType, withinMinutes]
    )
    return rows[0].count || 0
  },



  async getRecentAutomodInfractions(guildId, limit = 10) {
    await ensureAutomodTables()
    const parsedLimit = Number.parseInt(String(limit), 10)
    const safeLimit = Math.max(1, Math.min(25, Number.isFinite(parsedLimit) ? parsedLimit : 10))
    const [rows] = await executeQuery(
      `
      SELECT id, guild_id, user_id, trigger_type, reason, metadata, created_at
      FROM automod_infractions
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
      `,
      [guildId]
    )
    return rows
  },

  async isAutomodCooldownActive(guildId, userId, triggerType) {
    await ensureAutomodTables()
    const [rows] = await executeQuery(
      `
      SELECT 1 AS active
      FROM automod_cooldowns
      WHERE guild_id = ?
        AND user_id = ?
        AND trigger_type = ?
        AND expires_at > NOW()
      `,
      [guildId, userId, triggerType]
    )
    return rows.length > 0
  },

  async setAutomodCooldown(guildId, userId, triggerType, cooldownMs) {
    await ensureAutomodTables()
    const seconds = Math.max(1, Math.floor(cooldownMs / 1000))
    await executeQuery(
      `
      INSERT INTO automod_cooldowns (guild_id, user_id, trigger_type, expires_at)
      VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
      ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)
      `,
      [guildId, userId, triggerType, seconds]
    )
  }
}
