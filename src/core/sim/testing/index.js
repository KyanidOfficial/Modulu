const simConfig = require("../config/sim.config")
const { getSimService } = require("..")
const SimTestService = require("./simTest.service")

let shared = null

const getSimTestService = () => {
  if (!simConfig.enabled || !simConfig.testMode) return null
  const sim = getSimService()
  if (!sim) return null

  if (!shared) shared = new SimTestService(sim)
  return shared
}

module.exports = {
  getSimTestService
}
