const { getSimService } = require("../../../core/sim")

const applyEnforcement = async message => {
  const sim = getSimService()
  if (!sim) return null
  return sim.handleMessage(message)
}

module.exports = {
  applyEnforcement
}
