const db = require("../../../core/database")
const warnsEmbed = require("../../../messages/embeds/warns.embed")

module.exports = {
  name: "warns",
  async execute(msg) {
    const user = msg.mentions.users.first()
    if (!user) return

    const list = (await db.getWarnings(msg.guild.id, user.id)) || []

    return msg.channel.send({
      embeds: [warnsEmbed({
        userMention: `@${user.username} (${user.tag})`,
        content: list.length
          ? list.map(w =>
            `\`${w.id}\`\nStatus: ${w.active ? "Active" : "Revoked"}\nReason: ${w.reason}\nBy: <@${w.moderator_id}>`
          ).join("\n\n")
          : "No warnings found",
        moderatorMention: `<@${msg.author.id}>`
      })]
    })
  }
}
