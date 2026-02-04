const db = require("./mysql")

module.exports = {
  async get(guildId) {
    const [rows] = await db.query(
      "SELECT * FROM join_gates WHERE guild_id = ?",
      [guildId]
    )

    if (!rows[0]) {
      return {
        guild_id: guildId,
        enabled: false,
        account_age_days: 7,
        require_avatar: true,
        category_id: null
      }
    }

    return rows[0]
  },

  async save(guildId, data) {
    await db.query(
      `INSERT INTO join_gates
       (guild_id, enabled, account_age_days, require_avatar, category_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         account_age_days = VALUES(account_age_days),
         require_avatar = VALUES(require_avatar),
         category_id = VALUES(category_id)`,
      [
        guildId,
        data.enabled,
        data.account_age_days,
        data.require_avatar,
        data.category_id
      ]
    )
  }
}