const { getSimService } = require("../../../core/sim")

const processSimMessage = async message => {
  const sim = getSimService()
  if (!sim) return null
  await sim.handleMessage(message)
  return true
}

const getSimDelayForUser = (guildId, userId) => {
  const sim = getSimService()
  if (!sim) return 0
  return sim.getMessageDelayMsForUser?.(guildId, userId) || 0
}

module.exports = {
  processSimMessage,
  getSimDelayForUser
}
