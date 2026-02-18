const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = data =>
  new EmbedBuilder()
    .setTitle("Action failed")
    .setColor(data.color || COLORS.error)
    .setDescription(
      `${data.users} ${data.punishment || "action"} **failed**
` +
      `> **Moderator:** ${data.moderator || "N/A"}
` +
      `> **Reason:** ${data.reason || "Unknown error"}
` +
      `> **State:** ${data.state || "failed"}`
    )
    .setFooter({ text: `${data.footer || "Moderation Error"} • ${new Date().toISOString()}` })
    .setTimestamp()
