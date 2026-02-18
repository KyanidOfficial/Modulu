const db = require("../../core/database")
const defaults = require("./defaults")

const merge = (target, source) => {
  if (!source || typeof source !== "object") return target
  const out = { ...target }
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = merge(out[key] || {}, value)
    } else {
      out[key] = value
    }
  }
  return out
}

module.exports.getConfig = async guildId => {
  const stored = await db.getAutomodConfig(guildId)
  return merge(defaults, stored || {})
}

module.exports.saveConfig = (guildId, config) => db.saveAutomodConfig(guildId, config)

module.exports.addInfraction = payload => db.addAutomodInfraction(payload)
module.exports.getRecentInfractions = async () => []

module.exports.isPunishmentCoolingDown = (guildId, userId, triggerType) =>
  db.isAutomodCooldownActive(guildId, userId, triggerType)

module.exports.setPunishmentCooldown = (guildId, userId, triggerType, cooldownMs) =>
  db.setAutomodCooldown(guildId, userId, triggerType, cooldownMs)
