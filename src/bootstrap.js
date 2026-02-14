<<<<<<< HEAD
const eventLoader = require("./core/loaders/event.loader")
const slashLoaderImport = require("./core/loaders/slash.loader")
const prefixLoader = require("./core/loaders/prefix.loader")
const { handleClientError } = require("./core/observability/errorHandler")

const slashLoader =
  typeof slashLoaderImport === "function"
    ? slashLoaderImport
    : typeof slashLoaderImport?.loadSlashCommands === "function"
      ? slashLoaderImport.loadSlashCommands
      : typeof slashLoaderImport?.default === "function"
        ? slashLoaderImport.default
        : null
=======
const logger = require("./bootstrap/logger")
const slashLoader = require("./core/loaders/slash.loader")
const interactionHandler = require("./core/handlers/interaction.handler")
const messageHandler = require("./core/handlers/message.handler")
>>>>>>> 2e7d33e5677ccf14a038d3f94d24e5c1b03f782e

module.exports = client => {
  slashLoader(client)

  client.on("clientReady", readyClient => {
    logger.info("client.ready", { tag: readyClient.user.tag })
  })

  client.on("interactionCreate", async interaction => {
    await interactionHandler(client, interaction)
  })

  client.on("messageCreate", async message => {
    await messageHandler(message)
  })
}
