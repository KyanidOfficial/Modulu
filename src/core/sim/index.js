const simConfig = require("./config/sim.config")
const SimService = require("./services/sim.service")

let shared = null

const getSimService = () => {
  if (!simConfig.enabled) return null
  if (!shared) shared = new SimService()
  return shared
}

module.exports = {
  getSimService
}
