const pool = require("./mysql")

let tablesReady = false

const ensureTables = async () => {
  if (tablesReady) return

  await pool.query(
    `
    CREATE TABLE IF NOT EXISTS application_configs (
      guild_id VARCHAR(32) NOT NULL,
      type VARCHAR(64) NOT NULL,
      config_json JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, type)
    )
    `
  )

  await pool.query(
    `
    CREATE TABLE IF NOT EXISTS application_submissions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(32) NOT NULL,
      type VARCHAR(64) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      answers_json JSON NOT NULL,
      status VARCHAR(32) DEFAULT 'submitted',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `
  )

  tablesReady = true
}

const getConfig = async (guildId, type) => {
  await ensureTables()
  const [rows] = await pool.query(
    "SELECT config_json FROM application_configs WHERE guild_id = ? AND type = ?",
    [guildId, type]
  )
  if (!rows.length) return null
  const stored = rows[0].config_json
  return typeof stored === "string" ? JSON.parse(stored) : stored
}

const listConfigs = async guildId => {
  await ensureTables()
  const [rows] = await pool.query(
    "SELECT type, config_json FROM application_configs WHERE guild_id = ?",
    [guildId]
  )
  return rows.map(row => ({
    type: row.type,
    config: typeof row.config_json === "string"
      ? JSON.parse(row.config_json)
      : row.config_json
  }))
}

const saveConfig = async (guildId, type, config) => {
  await ensureTables()
  await pool.query(
    `
    INSERT INTO application_configs (guild_id, type, config_json)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE config_json = VALUES(config_json)
    `,
    [guildId, type, JSON.stringify(config)]
  )
}

const deleteConfig = async (guildId, type) => {
  await ensureTables()
  await pool.query(
    "DELETE FROM application_configs WHERE guild_id = ? AND type = ?",
    [guildId, type]
  )
}

const addSubmission = async ({ guildId, type, userId, answers }) => {
  await ensureTables()
  const [result] = await pool.query(
    `
    INSERT INTO application_submissions (guild_id, type, user_id, answers_json)
    VALUES (?, ?, ?, ?)
    `,
    [guildId, type, userId, JSON.stringify(answers)]
  )
  return result.insertId
}

module.exports = {
  getConfig,
  listConfigs,
  saveConfig,
  deleteConfig,
  addSubmission
}
