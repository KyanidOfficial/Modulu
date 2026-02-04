const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")
const { EMOJIS } = require("../../utils/constants")

module.exports = data => 
  new EmbedBuilder()
    .setTitle(`Uh oh. This is embarrassing.`)
    .setColor(data.color || COLORS.error)
    .setDescription(
      `${data.users} ${data.punisment} **failed**\n` +
      `> **Reason:** ${data.reason || "Err"}\n` +
      `> **State:** ${data.state || "Err"}` +
      `\n` +
      `Please contact developers if the issue persists.`
    )