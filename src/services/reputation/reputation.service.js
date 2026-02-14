const reputation = require("../../modules/reputation")

module.exports = {
  view(guildId, userId) {
    return reputation.view(guildId, userId)
  },
  leaderboard(guildId, page, pageSize) {
    return reputation.leaderboard(guildId, page, pageSize)
  },
  adjust(guildId, userId, value, actorId, reason) {
    return reputation.adjust(guildId, userId, value, actorId, reason)
  }
}
