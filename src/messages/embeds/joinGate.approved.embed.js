const { EmbedBuilder } = require("discord.js")

module.exports = ({ guild, reviewer, reason }) =>
  new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Join Gate Approved")
    .setDescription(
      `Server: ${guild.name}\n` +
      `Reviewed by: ${reviewer}\n\n` +
      `Reason:\n${reason}`
    )
    .setFooter({ text: "You are now allowed to join the server." })