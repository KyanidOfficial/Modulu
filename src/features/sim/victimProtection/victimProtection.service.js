const { getSimService } = require("../../../core/sim")

const getVictimProtectionState = (guildId, sourceId, targetId) => {
  const sim = getSimService()
  if (!sim) return null
  return sim.getVictimProtectionState?.(guildId, sourceId, targetId) || null
}

module.exports = {
  getVictimProtectionState
}
