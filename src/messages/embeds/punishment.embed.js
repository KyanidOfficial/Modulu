const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = data => {
  const embed = new EmbedBuilder()
    .setTitle(`${data.punishment} ${data.state}`)
    .setColor(data.color || COLORS.success)
    .setDescription(
      `> **User:** ${data.users || "Unknown"}` +
      `> **Moderator:** ${data.moderator || "N/A"}` +
      `> **Warning Count:** ${Number.isFinite(data.warningCount) ? data.warningCount : "N/A"}` +
      `> **Expires at:** ${data.expiresAt ? `<t:${data.expiresAt}:F>` : "N/A"}` +
      `> **Reason:** ${data.reason || "No reason provided"}`
    )
    .setFooter({ text: `${data.footer || "Moderation Action"} • ${new Date().toISOString()}` })
    .setTimestamp()

  return embed
}
