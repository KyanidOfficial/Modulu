const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const store = require("../../../modules/automod/store")
const { createDashboardEmbed, createDashboardComponents } = require("../../../modules/automod/panel")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Open AutoMod management dashboard")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    const guildId = interaction.guild.id
    const cfg = await store.getConfig(guildId)
    const recent = await store.getRecentInfractions(guildId, 10)

    return interaction.editReply({
      embeds: [createDashboardEmbed({ cfg, recentCount: recent.length })],
      components: createDashboardComponents()
    })
  }
}
