const logger = require("./logger")

const withContext = ({ error, context = {} }) => {
  logger.error("application.error", {
    ...context,
    error,
    message: error?.message,
    stack: error?.stack
  })
}

const handleInteractionError = async ({ error, interaction, message = "Command failed." }) => {
  withContext({
    error,
    context: {
      source: "interaction",
      commandName: interaction?.commandName,
      interactionId: interaction?.id,
      guildId: interaction?.guildId,
      channelId: interaction?.channelId,
      userId: interaction?.user?.id
    }
  })

  if (!interaction || typeof interaction.isRepliable !== "function" || !interaction.isRepliable()) {
    return
  }

  const payload = { content: message, ephemeral: true }

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload)
      return
    }
    await interaction.reply(payload)
  } catch (replyError) {
    withContext({ error: replyError, context: { source: "interaction-error-reply" } })
  }
}

const handleClientError = ({ error, event, context = {} }) => {
  withContext({
    error,
    context: {
      source: "client",
      event,
      ...context
    }
  })
}

module.exports = {
  withContext,
  handleInteractionError,
  handleClientError,
  async report({ error, context = {}, fallback }) {
    withContext({ error, context })
    if (typeof fallback === "function") {
      try {
        await fallback()
      } catch (fallbackError) {
        withContext({ error: fallbackError, context: { source: "fallback" } })
      }
    }
  }
}
