const execute = require("../execute")

module.exports = async (client, interaction) => {
  if (!interaction.isChatInputCommand()) return

  const fileCommands = [
    require("../../commands/automod"),
    require("../../commands/case"),
    require("../../commands/rep")
  ]

  const mapped = new Map(fileCommands.map(c => [c.data.name, c]))
  const cmd = client.commands.get(interaction.commandName) || mapped.get(interaction.commandName)
  if (!cmd) return
  await execute(interaction, cmd)
}
