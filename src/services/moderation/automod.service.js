const db = require("../../core/database")

module.exports = {
  async toggle(guildId, enabled) {
    const config = await db.getAutomodConfig(guildId)
    await db.setAutomodConfig(guildId, { ...config, enabled })
    return enabled
  },
  async setThreshold(guildId, key, value) {
    const config = await db.getAutomodConfig(guildId)
    const parsed = Number.isNaN(Number(value)) ? value : Number(value)
    const next = { ...config, thresholds: { ...config.thresholds, [key]: parsed } }
    await db.setAutomodConfig(guildId, next)
    return next
  },
  async getConfig(guildId) {
    return db.getAutomodConfig(guildId)
  }
}
