const handler = require("../core/handlers/interaction.handler")
const { handleClientError } = require("../core/observability/errorHandler")

module.exports = async (client, interaction) => {
  try {
    await handler(client, interaction)
  } catch (error) {
    handleClientError({
      error,
      event: "interactionCreate",
      context: { interactionId: interaction?.id, commandName: interaction?.commandName }
    })
  }
}
