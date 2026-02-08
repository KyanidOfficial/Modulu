const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js")

const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../utils/colors")

module.exports = {
  main() {
    return {
      embeds: [
        systemEmbed({
          title: "Applications",
          description: "Manage server applications.",
          color: COLORS.info
        })
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("apps:create")
            .setLabel("Create")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("apps:list")
            .setLabel("List")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("apps:questions")
            .setLabel("Questions +/-")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId("apps:view")
            .setLabel("View Applications")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId("apps:delete")
            .setLabel("Delete")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    }
  }
}
