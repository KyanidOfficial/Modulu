const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")

module.exports = {
  name: "untimeout",
  async execute(msg) {
    const member = msg.mentions.members.first()
    if (!member) return

    try {
      await member.timeout(null)
    } catch {
      return msg.channel.send({
        embeds: [errorEmbed({
          users: `@${member.user.username} (${member.user.tag})`,
          reason: "Permission or hierarchy issue",
          punishment: "untimeout",
          state: "failed",
          color: COLORS.error
        })]
      })
    }

    return msg.channel.send({
      embeds: [embed({
        users: `@${member.user.username} (${member.user.tag})`,
        punishment: "timeout",
        state: "removed",
        reason: "Manual removal",
        color: COLORS.success
      })]
    })
  }
}