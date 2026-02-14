const modlog = require("../logging/modlog.service")

module.exports = {
  async run({ guild, member, moderatorId, reason, deleteMessageSeconds = 0 }) {
    await member.ban({ reason, deleteMessageSeconds })
    await modlog.write({ guild, action: "ban", userId: member.id, moderatorId, reason })
  }
}
