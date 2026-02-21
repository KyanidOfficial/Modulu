const { getSimService } = require("../../../core/sim")

const getSimStateForUser = (guildId, userId) => {
  const sim = getSimService()
  if (!sim) return null
  return sim.getUserReport(guildId, userId)
}

const resetSimStateForUser = (guildId, userId) => {
  const sim = getSimService()
  if (!sim) return false
  sim.resetUserState(guildId, userId)
  return true
}

module.exports = {
  getSimStateForUser,
  resetSimStateForUser
}
