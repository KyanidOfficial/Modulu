const embed = require("../../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../../messages/embeds/error.embed")
const COLORS = require("../../../../shared/utils/colors")

module.exports = {
  name: "ban",
  async execute(msg, args) {
    const member = msg.mentions.members.first()
    if (!member) return

    const reason = args.slice(1).join(" ") || "No reason provided"

    try {
      await member.ban({ reason })
    } catch {
      return msg.channel.send({
        embeds: [errorEmbed({
          users: `@${member.user.username} (${member.user.tag})`,
          reason: "Permission or hierarchy issue",
          punishment: "ban",
          state: "failed",
          color: COLORS.error
        })]
      })
    }

    return msg.channel.send({
      embeds: [embed({
        users: `@${member.user.username} (${member.user.tag})`,
        punishment: "ban",
        state: "applied",
        reason,
        color: COLORS.success
      })]
    })
  }
}