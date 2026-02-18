const { getPool } = require("./mysql")

const DEFAULTS = guildId => ({
  guild_id: guildId,
  enabled: 1,
  scan_staff: 0,
  timeout: 0,
  timeout_time: 600,
  log_enabled: 1
})

module.exports = {
  async get(guildId) {
    try {
      const pool = getPool()
      const [rows] = await pool.query(
        "SELECT * FROM harmful_links WHERE guild_id = ?",
        [guildId]
      )

      if (!rows[0]) {
        return DEFAULTS(guildId)
      }

      return rows[0]
    } catch {
      return DEFAULTS(guildId)
    }
  },

  async save(guildId, data) {
    const enabled = data.enabled ? 1 : 0
    const scanStaff = data.scan_staff ? 1 : 0
    const timeout = data.timeout ? 1 : 0
    const timeoutTime = typeof data.timeout_time === "number" ? data.timeout_time : 600
    const logEnabled = data.log_enabled ? 1 : 0

    try {
      const pool = getPool()
      await pool.query(
        `INSERT INTO harmful_links
         (guild_id, enabled, scan_staff, timeout, timeout_time, log_enabled)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           enabled = VALUES(enabled),
           scan_staff = VALUES(scan_staff),
           timeout = VALUES(timeout),
           timeout_time = VALUES(timeout_time),
           log_enabled = VALUES(log_enabled)`,
        [
          guildId,
          enabled,
          scanStaff,
          timeout,
          timeoutTime,
          logEnabled
        ]
      )
      return true
    } catch {
      return false
    }
  }
}
