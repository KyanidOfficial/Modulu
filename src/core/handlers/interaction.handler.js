const execute = require("./execute")
const rateLimit = require("../../middleware/rateLimiter")

module.exports = async (client, interaction) => {
  if (!interaction.isChatInputCommand()) return

  const allowed = rateLimit({ key: `${interaction.user.id}:${interaction.commandName}` })
  if (!allowed) return

  const command = client.commands.get(interaction.commandName)
  if (!command) return

  await execute(interaction, command)
}
