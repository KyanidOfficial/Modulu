const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")
const { EMOJIS } = require("../../utils/constants")

module.exports = data => {
  const embed = new EmbedBuilder()
    .setTitle(`${data.punishment} ${data.state}`)
    .setColor(data.color || COLORS.success)
    .setDescription(
      `> **User:** ${data.users || "Unknown (ERROR)"}\n` +
      `> **Expires at:** ${data.expiresAt
        ? `<t:${data.expiresAt}:F>`
        : "N/A"}\n` +
      `> **Reason:** ${data.reason || "No reason provided"}`
    )
    .setTimestamp()

  return embed
}