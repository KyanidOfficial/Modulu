const embed = require("../../../messages/embeds/punishment.embed")
const errorEmbed = require("../../../messages/embeds/error.embed")
const COLORS = require("../../../utils/colors")

module.exports = {
  name: "unban",
  async execute(msg, args) {
    const id = args[0]
    if (!id) return

    try {
      await msg.guild.members.unban(id)
    } catch {
      return msg.channel.send({
        embeds: [errorEmbed({
          users: `<@${id}>`,
          reason: "User not banned or missing permissions",
          punishment: "unban",
          state: "failed",
          color: COLORS.error
        })]
      })
    }

    return msg.channel.send({
      embeds: [embed({
        users: `<@${id}>`,
        punishment: "ban",
        state: "removed",
        reason: "Manual unban",
        color: COLORS.success
      })]
    })
  }
}