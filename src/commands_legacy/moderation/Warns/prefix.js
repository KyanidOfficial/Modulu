const db = require("../../../core/database")
const warnsEmbed = require("../../../messages/embeds/warns.embed")

module.exports = {
  name: "warns",
  async execute(msg) {
    const user = msg.mentions.users.first()
    if (!user) return

    const list = db.get(msg.guild.id).warnings[user.id] || []

    return msg.channel.send({
      embeds: [warnsEmbed(
        `@${user.username} (${user.tag})`,
        list.length
          ? list.map(w =>
              `\`${w.id}\`\nStatus: ${w.active ? "Active" : "Revoked"}\nReason: ${w.reason}\nBy: <@${w.moderator}>`
            ).join("\n\n")
          : "No warnings"
      )]
    })
  }
}