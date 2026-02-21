const isIgnorableInteractionError = err => err && (err.code === 10062 || err.code === 10008)

const safeExecute = (name, execute) => {
  return async interaction => {
    try {
      return await execute(interaction)
    } catch (err) {
      console.error(`[COMMAND_ERROR] ${name}`)
      console.error(err?.stack || err)

      if (!interaction?.isRepliable?.()) return

      const payload = {
        content: "Something went wrong while running this command. Please try again.",
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
    }
  }
}

module.exports = {
  safeExecute
}
