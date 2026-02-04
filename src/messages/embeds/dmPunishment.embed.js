const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = data => {
    new EmbedBuilder()
    .setColor(data.color || COLORS.warning)
    .setTitle(`Moderation action`)
    .setDescription(
      `**Action:** ${data.punishment}\n` +
      `**Reason:** ${data.reason}\n` +
      `**Expires at:** ${
        data.expiresAt
          ? `<t:${data.expiresAt}:F>`
          : "N/A"
      }\n` +
      `**Server:** ${data.guild}`
    )
}
