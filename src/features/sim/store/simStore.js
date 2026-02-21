const { getSimService } = require("../../../core/sim")

const getSimStore = () => {
  const sim = getSimService()
  if (!sim) return null
  return sim.store || null
}

module.exports = {
  getSimStore
}
