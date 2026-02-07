const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = data => {
  if (!data || !data.punishment || !data.guild) return null

  return new EmbedBuilder()
    .setColor(data.color || COLORS.warning)
    .setTitle("Moderation action")
    .setDescription(
      `**Action:** ${data.punishment}\n` +
      `**Reason:** ${data.reason || "No reason provided"}\n` +
      `**Expires at:** ${
        data.expiresAt
          ? `<t:${data.expiresAt}:F>`
          : "N/A"
      }\n` +
      `**Server:** ${data.guild}`
    )
}