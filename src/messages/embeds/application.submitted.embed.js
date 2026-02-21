const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../shared/utils/colors")

module.exports = ({ type, guild, submissionId }) => {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("Application submitted")
    .setDescription(
      `Your **${type}** application has been submitted for **${guild}**.\n` +
      `Submission ID: **${submissionId}**`
    )
    .setTimestamp()
}
