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
  }
}
