const logger = require("./bootstrap/logger")
const slashLoader = require("./core/loaders/slash.loader")
const interactionHandler = require("./core/handlers/interaction.handler")
const messageHandler = require("./core/handlers/message.handler")

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
