const { requireEnabled } = require("../../shared/utils/commandToggle")

const isIgnorableInteractionError = err => err && (err.code === 10062 || err.code === 10008)

const safeExecute = (commandName, execute, options = {}) => {
  const { skipDefer = false, deferEphemeral = false, disabledMessage = "This command is disabled by developers." } = options

  return async interaction => {
    const timerLabel = `CMD_${commandName}`
    console.time(timerLabel)

    try {
      if (!skipDefer && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: deferEphemeral })
      }

      const enabled = requireEnabled({ COMMAND_ENABLED: options.commandEnabled })
      if (!enabled.ok) {
        const payload = { content: disabledMessage || enabled.reason, ephemeral: true }
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload)
        } else {
          await interaction.reply(payload)
        }
        return
      }

      await execute(interaction)
    } catch (err) {
      console.error(`[COMMAND_ERROR] ${commandName}`)
      console.error(err?.stack || err)

      if (!interaction?.isRepliable?.()) return

      const payload = {
        content: "An error occurred.",
        ephemeral: true
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(payload).catch(() => {})
      } else {
        await interaction.reply(payload).catch(replyError => {
          if (!isIgnorableInteractionError(replyError)) {
            console.error(replyError?.stack || replyError)
          }
        })
      }
    } finally {
      console.timeEnd(timerLabel)
    }
  }
}

module.exports = {
  safeExecute
}
