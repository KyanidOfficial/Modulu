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
  try {
    const stored = await db.getAutomodConfig(guildId)
    return merge(defaults, stored || {})
  } catch {
    return merge(defaults, {})
  }
}

module.exports.saveConfig = async (guildId, config) => {
  try {
    await db.saveAutomodConfig(guildId, config)
    return true
  } catch {
    return false
  }
}

module.exports.addInfraction = async payload => {
  try {
    await db.addAutomodInfraction(payload)
    return true
  } catch {
    return false
  }
}

module.exports.getRecentInfractions = async (guildId, limit = 10) => {
  try {
    return await db.getRecentAutomodInfractions(guildId, limit)
  } catch {
    return []
  }
}

module.exports.isPunishmentCoolingDown = async (guildId, userId, triggerType) => {
  try {
    return await db.isAutomodCooldownActive(guildId, userId, triggerType)
  } catch {
    return false
  }
}

module.exports.setPunishmentCooldown = async (guildId, userId, triggerType, cooldownMs) => {
  try {
    await db.setAutomodCooldown(guildId, userId, triggerType, cooldownMs)
    return true
  } catch {
    return false
  }
}
