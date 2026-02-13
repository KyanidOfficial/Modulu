const execute = require("../execute")

module.exports = async (client, interaction) => {
  if (!interaction.isChatInputCommand()) return

  const cmd = client.commands.get(interaction.commandName)
  if (!cmd) return

  await execute(interaction, cmd)
}
