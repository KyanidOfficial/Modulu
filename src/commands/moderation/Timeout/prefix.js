const parse = require("../../../utils/time")
const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")

module.exports = {
  name: "timeout",
  async execute(msg, args) {
    const member = msg.mentions.members.first()
    const parsed = parse(args[1])
    if (!member || !parsed) return

    const reason = args.slice(2).join(" ") || "No reason provided"
    const expiresAt = Math.floor((Date.now() + parsed.ms) / 1000)

    try {
      await member.timeout(parsed.ms, reason)
    } catch {
      return msg.channel.send({
        embeds: [errorEmbed({
          users: `@${member.user.username} (${member.user.tag})`,
          reason: "Permission or hierarchy issue",
          punishment: "timeout",
          state: "failed",
          color: COLORS.error
        })]
      })
    }

    return msg.channel.send({
      embeds: [embed({
        users: `@${member.user.username} (${member.user.tag})`,
        punishment: "timeout",
        state: "applied",
        expiresAt,
        reason,
        duration: parsed.label,
        color: COLORS.success
      })]
    })
  }
}