const logModerationAction = require("../../utils/logModerationAction")

module.exports = {
  async write({ guild, action, userId, moderatorId, reason, metadata }) {
    return logModerationAction({ guild, action, userId, moderatorId, reason, metadata })
  }
}
