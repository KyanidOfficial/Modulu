const db = require("../database")

const cache = new Map()

module.exports.isActive = async guildId => {
  if (cache.has(guildId)) return true

  const state = await db.getRaidState(guildId)
  if (!state || !state.active) return false

  if (state.ends_at && Date.now() > new Date(state.ends_at).getTime()) {
    cache.delete(guildId)
    return false
  }

  cache.set(guildId, true)
  return true
}

module.exports.activate = async (guildId, joins) => {
  cache.set(guildId, true)

  await db.setRaidState({
    guildId,
    active: true,
    joinCount: joins,
    durationSeconds: 900
  })
}