const defaults = {
  nodeEnv: process.env.NODE_ENV || "development",
  prefix: process.env.PREFIX || "!",
  simEnabled: process.env.SIM_ENABLED === "true",
  simTestMode: process.env.SIM_TEST_MODE === "true"
}

module.exports = defaults
