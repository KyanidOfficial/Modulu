const { SlashCommandBuilder, PermissionsBitField } = require("discord.js")
const store = require("../../../../modules/automod/store")
const defaults = require("../../../../modules/automod/defaults")
const { createDashboardEmbed, createDashboardComponents } = require("../../../../modules/automod/panel")
const systemEmbed = require("../../../../messages/embeds/system.embed")
const COLORS = require("../../../../shared/utils/colors")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Open AutoMod management dashboard")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    const guildId = interaction.guild.id

    let cfg = defaults
    try {
      cfg = await store.getConfig(guildId)
    } catch {
      cfg = defaults
    }

    let recentCount = 0
    try {
      const recent = await store.getRecentInfractions(guildId, 10)
      recentCount = Array.isArray(recent) ? recent.length : 0
    } catch {
      return interaction.editReply({
        embeds: [
          systemEmbed({
            title: "AutoMod Dashboard",
            description: "AutoMod loaded, but recent infraction history could not be fetched right now.",
            color: COLORS.warning
          }),
          createDashboardEmbed({ cfg, recentCount: 0 })
        ],
        components: createDashboardComponents()
      })
    }

    return interaction.editReply({
      embeds: [createDashboardEmbed({ cfg, recentCount })],
      components: createDashboardComponents()
    })
  }
}
