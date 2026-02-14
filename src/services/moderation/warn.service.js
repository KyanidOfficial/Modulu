const db = require("../../core/database")
const ids = require("../../utils/ids")
const modlog = require("../logging/modlog.service")

module.exports = {
  async run({ guild, moderatorId, userId, reason }) {
    const id = ids()
    await db.addWarning({ id, guildId: guild.id, userId, moderatorId, reason, active: true, createdAt: Date.now() })
    await modlog.write({ guild, action: "warn", userId, moderatorId, reason, metadata: { warningId: id } })
    return { id }
  }
}
