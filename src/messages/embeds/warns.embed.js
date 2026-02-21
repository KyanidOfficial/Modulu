const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../shared/utils/colors")

module.exports = ({ userMention, content, moderatorMention, color }) =>
  new EmbedBuilder()
    .setTitle(`${userMention} warnings`)
    .setDescription(content || "No warnings found")
    .setColor(color || COLORS.info)
    .setFooter({
      text: `Moderator: ${moderatorMention || "N/A"}}`
    })
    .setTimestamp()
