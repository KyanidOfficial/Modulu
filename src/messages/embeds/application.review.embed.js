const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = ({ type, user, answers, submissionId }) => {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`New ${type} application`)
    .setDescription(`Submission ID: **${submissionId}**\nApplicant: <@${user.id}>`)
    .setTimestamp()

  for (const item of answers) {
    embed.addFields({
      name: item.prompt,
      value: item.answer || "No response",
      inline: false
    })
  }

  return embed
}
