const execute = require("../execute")
const { handleInteractionError } = require("../observability/errorHandler")

module.exports = async (client, interaction) => {
  if (!interaction.isChatInputCommand()) return

  const cmd = client.commands.get(interaction.commandName)
  if (!cmd) return

  try {
    await execute(interaction, cmd)
  } catch (error) {
    await handleInteractionError({ error, interaction })
  }
}
