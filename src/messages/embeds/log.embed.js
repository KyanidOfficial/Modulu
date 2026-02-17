const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = data => {
  return new EmbedBuilder()
    .setColor(data?.color || COLORS.warning)
    .setTitle("Moderation log")
    .setDescription(
      `${data?.caseId ? `**Case ID:** ${data.caseId}\n` : ""}` +
      `**Action:** ${data?.punishment || "Unknown"}\n` +
      `**User:** ${data?.user || "Unknown"}\n` +
      `**Moderator:** ${data?.moderator || "Unknown"}\n` +
      `**Reason:** ${data?.reason || "No reason provided"}\n` +
      `**Warning Count:** ${data?.warningCount ?? "N/A"}\n` +
      `**Duration:** ${data?.duration || "N/A"}\n` +
      `**Expires at:** ${
        data?.expiresAt
          ? `<t:${data.expiresAt}:F>`
          : "N/A"
      }`
    )
    .setFooter({ text: `Moderation Log • ${new Date().toISOString()}` })
    .setTimestamp()
}
