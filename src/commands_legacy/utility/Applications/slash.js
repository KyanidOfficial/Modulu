const COMMAND_ENABLED = true
const { SlashCommandBuilder } = require("discord.js")
const panel = require("../../../modules/applications/panel")
const { isAdmin } = require("../../../modules/applications/permissions")
const systemEmbed = require("../../../messages/embeds/system.embed")
const COLORS = require("../../../utils/colors")

module.exports = {
  COMMAND_ENABLED,

  data: new SlashCommandBuilder()
    .setName("applications")
    .setDescription("Manage server applications"),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
      await interaction.editReply({
        embeds: [
          systemEmbed({
            title: "Unavailable",
            description: "This command can only be used in a server.",
            color: COLORS.warning
          })
        ]
      })
      return
    }

    if (!isAdmin(interaction.member)) {
      await interaction.editReply({
        embeds: [
          systemEmbed({
            title: "Access denied",
            description: "You are not allowed to manage applications.",
            color: COLORS.error
          })
        ]
      })
      return
    }

    await interaction.editReply(panel.main())
  }
}
