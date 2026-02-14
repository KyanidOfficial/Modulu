const COMMAND_ENABLED = true
const { SlashCommandBuilder } = require("discord.js")
const applyFlow = require("../../../modules/applications/apply.flow")

module.exports = {
  COMMAND_ENABLED,
  skipDefer: true,

  data: new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Apply for a position")
    .addStringOption(o =>
      o.setName("type")
        .setDescription("Application type")
        .setRequired(true)
    ),

  async execute(interaction) {
    await applyFlow(interaction)
  }
}