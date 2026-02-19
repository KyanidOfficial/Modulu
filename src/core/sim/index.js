const SimService = require("./services/sim.service")

let shared = null

const getSimService = () => {
  if (!shared) shared = new SimService()
  return shared
}

module.exports = {
  getSimService
}
