const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../shared/utils/colors")

module.exports = data =>
  new EmbedBuilder()
    .setTitle("Action failed")
    .setColor(data.color || COLORS.error)
    .setDescription(
      `${data.users} ${data.punishment || "action"} **failed**\n` +
      `> **Moderator:** ${data.moderator || "N/A"}\n` +
      `> **Reason:** ${data.reason || "Unknown error"}\n` +
      `> **State:** ${data.state || "failed"}`
    )
    .setFooter({ text: `${data.footer || "Moderation Error"}` })
    .setTimestamp()
