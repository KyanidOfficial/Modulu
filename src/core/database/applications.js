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
  async getAllConfigs(guildId) {
    const [rows] = await pool.query(
      "SELECT type, config_json FROM application_configs WHERE guild_id = ?",
      [guildId]
    )

    return rows.map(row => ({
      type: row.type,
      config: row.config_json // ALREADY an object
    }))
  },

  async getConfig(guildId, type) {
    const [rows] = await pool.query(
      "SELECT config_json FROM application_configs WHERE guild_id = ? AND type = ?",
      [guildId, type]
    )

    if (!rows.length) return null
    return rows[0].config_json // ALREADY an object
  },

  async saveConfig(guildId, type, config) {
    await pool.query(
      `
      INSERT INTO application_configs (guild_id, type, config_json)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE config_json = VALUES(config_json)
      `,
      [guildId, type, JSON.stringify(config)]
    )
  },

  async deleteConfig(guildId, type) {
    await pool.query(
      "DELETE FROM application_configs WHERE guild_id = ? AND type = ?",
      [guildId, type]
    )
  },

  async createSubmission({ guildId, type, userId, answers }) {
    const [result] = await pool.query(
      `
      INSERT INTO application_submissions
      (guild_id, type, user_id, answers_json, status)
      VALUES (?, ?, ?, ?, 'submitted')
      `,
      [guildId, type, userId, JSON.stringify(answers)]
    )

    return result.insertId
  }
}