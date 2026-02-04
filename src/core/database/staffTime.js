const mysql = require("mysql2/promise")

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5
})

module.exports = {
  async getActive(guildId, userId) {
    const [rows] = await pool.query(
      "SELECT * FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )
    return rows[0]
  },

  async getAllActive() {
    const [rows] = await pool.query(
      "SELECT * FROM staff_time_active"
    )
    return rows
  },

  async startSession({ guildId, userId, startedAt }) {
    await pool.query(
      "INSERT INTO staff_time_active (guild_id, user_id, started_at, last_check, warned) VALUES (?, ?, ?, 0, 0)",
      [guildId, userId, startedAt]
    )
  },

  async endSession({ guildId, userId }) {
    const [rows] = await pool.query(
      "SELECT * FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )

    if (!rows[0]) return null

    const started = rows[0].started_at
    const ended = Date.now()
    const seconds = Math.floor((ended - started) / 1000)

    await pool.query(
      "DELETE FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )

    await pool.query(
      "INSERT INTO staff_time_sessions (guild_id, user_id, started_at, ended_at, duration_seconds, reason) VALUES (?, ?, ?, ?, ?, 'manual')",
      [guildId, userId, started, ended, seconds]
    )

    await pool.query(
      "INSERT INTO staff_time_totals (guild_id, user_id, seconds) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE seconds = seconds + VALUES(seconds)",
      [guildId, userId, seconds]
    )

    return seconds
  },

  async forceEnd({ guildId, userId, reason }) {
    const [rows] = await pool.query(
      "SELECT * FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )

    if (!rows[0]) return

    const started = rows[0].started_at
    const ended = Date.now()
    const seconds = Math.floor((ended - started) / 1000)

    await pool.query(
      "DELETE FROM staff_time_active WHERE guild_id = ? AND user_id = ?",
      [guildId, userId]
    )

    await pool.query(
      "INSERT INTO staff_time_sessions (guild_id, user_id, started_at, ended_at, duration_seconds, reason) VALUES (?, ?, ?, ?, ?, ?)",
      [guildId, userId, started, ended, seconds, reason]
    )

    await pool.query(
      "INSERT INTO staff_time_totals (guild_id, user_id, seconds) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE seconds = seconds + VALUES(seconds)",
      [guildId, userId, seconds]
    )
  },

  async markWarned(guildId, userId) {
    await pool.query(
      "UPDATE staff_time_active SET warned = 1, last_check = ? WHERE guild_id = ? AND user_id = ?",
      [Date.now(), guildId, userId]
    )
  },

  async getTotals(guildId) {
    const [rows] = await pool.query(
      "SELECT * FROM staff_time_totals WHERE guild_id = ? ORDER BY seconds DESC",
      [guildId]
    )
    return rows
  },

  async getAnyActive(userId) {
    const [rows] = await pool.query(
      "SELECT * FROM staff_time_active WHERE user_id = ? LIMIT 1",
      [userId]
    )
    return rows[0]
  },

  async confirmActive(guildId, userId, now) {
    await pool.query(
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