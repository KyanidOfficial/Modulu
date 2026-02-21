const db = require("../../../../core/database")
const embed = require("../../../../messages/embeds/punishment.embed")
const COLORS = require("../../../../shared/utils/colors")

module.exports = {
  name: "unwarn",
  async execute(msg, args) {
    const user = msg.mentions.users.first()
    const id = args[1]
    if (!user || !id) return

    const data = db.get(msg.guild.id)
    const warn = (data.warnings[user.id] || []).find(w => w.id === id)
    if (!warn) return

    warn.active = false
    db.save(msg.guild.id, data)

    return msg.channel.send({
      embeds: [embed({
        users: `@${user.username} (${user.tag})`,
        punishment: "warn",
        state: "revoked",
        reason: `Warning ID ${id}`,
        color: COLORS.success
      })]
    })
  }
}