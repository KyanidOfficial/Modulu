const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js")

const systemEmbed = require("../../messages/embeds/system.embed")
const COLORS = require("../../shared/utils/colors")

module.exports = {
  main() {
    return {
      embeds: [
        systemEmbed({
          title: "Applications",
          description: "Manage application types and submissions.",
          color: COLORS.info
        })
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("apps:create")
            .setLabel("Create Type")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("apps:list")
            .setLabel("List Types")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("apps:questions")
            .setLabel("Question Editor")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId("apps:applications")
            .setLabel("View Applications")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId("apps:submissions")
            .setLabel("View Submissions")
            .setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("apps:delete")
            .setLabel("Delete Type")
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId("apps:submissions:delete-type")
            .setLabel("Delete Type Submissions")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    }
  }
}
