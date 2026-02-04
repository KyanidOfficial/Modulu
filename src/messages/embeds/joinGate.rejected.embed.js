const { EmbedBuilder } = require("discord.js")

module.exports = ({ guild, reviewer, reason }) =>
  new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Join Gate Rejected")
    .setDescription(
      `Server: ${guild.name}\n` +
      `Reviewed by: ${reviewer}\n\n` +
      `Reason:\n${reason}`
    )
    .setFooter({ text: "You may reapply later if allowed." })