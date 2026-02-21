const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../shared/utils/colors")

module.exports = data => {
  const embed = new EmbedBuilder()
    .setTitle(`${data.punishment} ${data.state}`)
    .setColor(data.color || COLORS.success)
    .setDescription(
      `> **User:** ${data.users || "Unknown"}\n` +
      `> **Moderator:** ${data.moderatorId ? `<@${data.moderatorId}>` : "N/A"}\n` +
      `> **Warning Count:** ${Number.isFinite(data.warningCount) ? data.warningCount : "N/A"}\n` +
      `> **Expires at:** ${data.expiresAt ? `<t:${data.expiresAt}:F>` : "N/A"}\n` +
      `> **Reason:** ${data.reason || "No reason provided"}\n`
    )
    .setFooter({ text: `${data.footer || "Moderation Action"}` })
    .setTimestamp()

  return embed
}