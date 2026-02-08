const mysql = require("mysql2/promise")

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5
})

const parseConfigJson = raw => {
  if (!raw) return null
  if (typeof raw === "object") return raw

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const parseSubmissionJson = parseConfigJson

module.exports = {
  async getAllConfigs(guildId) {
    const [rows] = await pool.query(
      "SELECT type, config_json FROM application_configs WHERE guild_id = ?",
      [guildId]
    )

    return rows
      .map(row => ({
        type: row.type,
        config: parseConfigJson(row.config_json)
      }))
      .filter(row => row.config)
  },

  async getConfig(guildId, type) {
    const [rows] = await pool.query(
      "SELECT config_json FROM application_configs WHERE guild_id = ? AND type = ?",
      [guildId, type]
    )

    if (!rows.length) return null
    return parseConfigJson(rows[0].config_json)
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
    const [result] = await pool.query(
      "DELETE FROM application_configs WHERE guild_id = ? AND type = ?",
      [guildId, type]
    )

    return result.affectedRows > 0
  },

  async createSubmission({ guildId, type, userId, answers, status = "pending" }) {
    const [result] = await pool.query(
      `
      INSERT INTO application_submissions
      (guild_id, type, user_id, answers_json, status)
      VALUES (?, ?, ?, ?, ?)
      `,
      [guildId, type, userId, JSON.stringify(answers), status]
    )

    return result.insertId
  },

  async listSubmissions(guildId) {
    const [rows] = await pool.query(
      `
      SELECT id, user_id, type, status, answers_json
      FROM application_submissions
      WHERE guild_id = ?
      ORDER BY id DESC
      LIMIT 25
      `,
      [guildId]
    )

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      status: row.status,
      payload: parseSubmissionJson(row.answers_json)
    }))
  },

  async getSubmission(guildId, submissionId) {
    const [rows] = await pool.query(
      `
      SELECT id, user_id, type, status, answers_json
      FROM application_submissions
      WHERE guild_id = ? AND id = ?
      LIMIT 1
      `,
      [guildId, submissionId]
    )

    if (!rows.length) return null

    return {
      id: rows[0].id,
      userId: rows[0].user_id,
      type: rows[0].type,
      status: rows[0].status,
      payload: parseSubmissionJson(rows[0].answers_json)
    }
  },

  async saveSubmission(guildId, submissionId, { status, payload }) {
    const [result] = await pool.query(
      `
      UPDATE application_submissions
      SET status = ?, answers_json = ?
      WHERE guild_id = ? AND id = ?
      `,
      [status, JSON.stringify(payload), guildId, submissionId]
    )

    return result.affectedRows > 0
  }
}
