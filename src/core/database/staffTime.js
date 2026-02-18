const { withConnection, isTimeoutError } = require("./mysql")

const safeQuery = async (sql, params = []) => {
  const response = await withConnection(async connection => connection.execute(sql, params))
  if (!response) return [[], { affectedRows: 0 }]
  return response
}

module.exports = {
  async getActive(guildId, userId) {
    try {
      const [rows] = await safeQuery(
        "SELECT * FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
        [guildId, userId]
      )
      return rows[0]
    } catch (error) {
      if (isTimeoutError(error)) return null
      throw error
    }
  },

  async getAllActive() {
    try {
      const [rows] = await safeQuery("SELECT * FROM staff_time_active")
      return rows
    } catch (error) {
      if (isTimeoutError(error)) return []
      throw error
    }
  },

  async startSession({ guildId, userId, startedAt }) {
    await safeQuery(
      "INSERT INTO staff_time_active (guild_id, user_id, started_at, last_check, warned) VALUES (?, ?, ?, 0, 0)",
      [guildId, userId, startedAt]
    )
  },

  async endSession({ guildId, userId }) {
    const [rows] = await safeQuery(
      "SELECT * FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )

    if (!rows[0]) return null

    const started = rows[0].started_at
    const ended = Date.now()
    const seconds = Math.floor((ended - started) / 1000)

    await safeQuery(
      "DELETE FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )

    await safeQuery(
      "INSERT INTO staff_time_sessions (guild_id, user_id, started_at, ended_at, duration_seconds, reason) VALUES (?, ?, ?, ?, ?, 'manual')",
      [guildId, userId, started, ended, seconds]
    )

    await safeQuery(
      "INSERT INTO staff_time_totals (guild_id, user_id, seconds) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE seconds = seconds + VALUES(seconds)",
      [guildId, userId, seconds]
    )

    return seconds
  },

  async forceEnd({ guildId, userId, reason }) {
    const [rows] = await safeQuery(
      "SELECT * FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )

    if (!rows[0]) return

    const started = rows[0].started_at
    const ended = Date.now()
    const seconds = Math.floor((ended - started) / 1000)

    await safeQuery(
      "DELETE FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )

    await safeQuery(
      "INSERT INTO staff_time_sessions (guild_id, user_id, started_at, ended_at, duration_seconds, reason) VALUES (?, ?, ?, ?, ?, ?)",
      [guildId, userId, started, ended, seconds, reason]
    )

    await safeQuery(
      "INSERT INTO staff_time_totals (guild_id, user_id, seconds) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE seconds = seconds + VALUES(seconds)",
      [guildId, userId, seconds]
    )
  },

  async markWarned(guildId, userId, now = Date.now()) {
    await safeQuery(
      "UPDATE staff_time_active SET warned = 1, last_check = ? WHERE guild_id = ? AND user_id = ?",
      [now, guildId, userId]
    )
  },

  async getTotals(guildId) {
    const [rows] = await safeQuery(
      "SELECT * FROM staff_time_totals WHERE guild_id = ? ORDER BY seconds DESC",
      [guildId]
    )
    return rows
  },

  async getAnyActive(userId) {
    const [rows] = await safeQuery(
      "SELECT * FROM staff_time_active WHERE user_id = ? LIMIT 1",
      [userId]
    )
    return rows[0]
  },

  async confirmActive(guildId, userId, now) {
    await safeQuery(
      `
      UPDATE staff_time_active
      SET warned = 0,
          last_check = ?
      WHERE guild_id = ? AND user_id = ?
      `,
      [now, guildId, userId]
    )
  }
}
