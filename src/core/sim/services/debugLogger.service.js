const simConfig = require("../config/sim.config")

const sanitizeNumber = value => Number(Number(value || 0).toFixed(4))

const debugLog = (event, payload = {}) => {
  if (!simConfig.debug) return

  const clean = {}
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "number") clean[key] = sanitizeNumber(value)
    else clean[key] = value
  }

  console.log(`[SIM DEBUG] ${event}`, clean)
}

module.exports = {
  debugLog
}
