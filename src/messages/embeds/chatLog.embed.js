const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = data => {
  const safeUser = data.user.replace(/_/g, "\\_")

  return new EmbedBuilder()
    .setColor(data.color || COLORS.error)
    .setTitle("Chat log")
    .setDescription(
      `**Action:** ${data.action}\n` +
      `**User:** ${safeUser}\n` +
      `**Channel:** ${data.channel}\n` +
      (data.before ? `**Before:** ${data.before}\n` : "") +
      (data.after ? `**After:** ${data.after}\n` : "")
    )
    .setTimestamp()
}