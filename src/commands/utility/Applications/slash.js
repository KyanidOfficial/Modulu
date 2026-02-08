const COMMAND_ENABLED = true
const { SlashCommandBuilder } = require("discord.js")
const panel = require("../../../modules/applications/panel")

module.exports = {
  COMMAND_ENABLED,

  data: new SlashCommandBuilder()
    .setName("applications")
    .setDescription("Manage server applications"),

  async execute(interaction) {
    await interaction.editReply(panel.main())
  }
}