const { EmbedBuilder } = require("discord.js")
const COLORS = require("../../utils/colors")

module.exports = ({ userTag, userId, avatar, feedback, guildName, guildId, invite }) => {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("New Feedback")
    .setDescription(feedback)
    .setAuthor({
      name: `${userTag} (${userId})`,
      iconURL: avatar
    })
    .addFields(
      { name: "Server", value: `${guildName} | ${guildId}` },
      { name: "Invite", value: invite || "Unavailable" }
    )
    .setTimestamp()
}