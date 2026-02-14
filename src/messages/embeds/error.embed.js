const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")
module.exports = data =>
  new EmbedBuilder()
    .setTitle("Action failed")
    .setColor(data.color || COLORS.error)
    .setDescription(
      `${data.users} ${data.punishment || "action"} **failed**\n` +
      `> **Reason:** ${data.reason || "Unknown error"}\n` +
      `> **State:** ${data.state || "failed"}\n` +
      `Please contact developers if the issue persists.`
    )
