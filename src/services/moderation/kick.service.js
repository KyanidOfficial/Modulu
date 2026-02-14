const modlog = require("../logging/modlog.service")

module.exports = {
  async run({ guild, member, moderatorId, reason }) {
    await member.kick(reason)
    await modlog.write({ guild, action: "kick", userId: member.id, moderatorId, reason })
  }
}
