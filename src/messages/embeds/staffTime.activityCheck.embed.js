const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = () => ({
  embeds: [
    new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle("Activity Check")
      .setDescription("Are you still active on staff duty?")
  ],
  components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("staff_active_confirm")
        .setLabel("Still Active")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("staff_active_clockout")
        .setLabel("Clock Out")
        .setStyle(ButtonStyle.Danger)
    )
  ]
})