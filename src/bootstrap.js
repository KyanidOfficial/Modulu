const eventLoader = require("./core/loaders/event.loader")
const slashLoader = require("./core/loaders/slash.loader")
const prefixLoader = require("./core/loaders/prefix.loader")

module.exports = client => {
  eventLoader(client)
  slashLoader(client)
  prefixLoader(client)
}