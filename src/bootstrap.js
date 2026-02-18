const eventLoader = require("./core/loaders/event.loader")
const slashLoader = require("./core/loaders/slash.loader")
const prefixLoader = require("./core/loaders/prefix.loader")
const { initRiskEngine } = require("./core/risk/runtime")

module.exports = client => {
  client.riskEngine = initRiskEngine()

  eventLoader(client)
  slashLoader(client)
  prefixLoader(client)
}
