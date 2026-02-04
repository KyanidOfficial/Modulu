const db = require("../../../core/database")
const id = require("../../../utils/ids")
const embed = require("../../../messages/embeds/punishment.embed")
const COLORS = require("../../../utils/colors")

module.exports = {
  name: "warn",
  async execute(msg, args) {
    const user = msg.mentions.users.first()
    if (!user) return

    const reason = args.slice(1).join(" ") || "No reason provided"

    const data = db.get(msg.guild.id)
    if (!data.warnings[user.id]) data.warnings[user.id] = []

    data.warnings[user.id].push({
      id: id(),
      reason,
      moderator: msg.author.id,
      active: true
    })

    db.save(msg.guild.id, data)

    return msg.channel.send({
      embeds: [embed({
        users: user.toString(),
        punishment: "warn",
        state: "applied",
        reason,
        color: COLORS.warning
      })]
    })
  }
}