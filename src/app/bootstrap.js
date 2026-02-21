const slashLoader = require("../core/loaders/slash.loader")
const prefixLoader = require("../core/loaders/prefix.loader")
const { registerEvents } = require("../core/client/registerEvents")

const bootstrapApp = async ({ client }) => {
  registerEvents(client)
  slashLoader(client)
  prefixLoader(client)
}

module.exports = {
  bootstrapApp
}
