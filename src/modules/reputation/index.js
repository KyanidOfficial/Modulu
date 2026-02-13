const db = require("../../core/database")
const logger = require("../../core/observability/logger")
const errorHandler = require("../../core/observability/errorHandler")

module.exports = {
  async applyImpact({ guildId, userId, delta, sourceType, caseId, metadata }) {
    try {
      await db.applyReputationDelta({ guildId, userId, delta, sourceType, caseId, metadata })
      logger.info("reputation.updated", { guildId, userId, delta, sourceType, caseId })
    } catch (error) {
      await errorHandler({ error, context: { module: "reputation.applyImpact", guildId, userId } })
    }
  },

  async view(guildId, userId) {
    return db.getReputation(guildId, userId)
  },

  async adjust(guildId, userId, delta, moderatorId, reason) {
    await db.adjustReputation(guildId, userId, delta, moderatorId, reason)
    logger.info("reputation.adjusted", { guildId, userId, delta, moderatorId })
  },

  async leaderboard(guildId, page, pageSize) {
    const offset = Math.max(0, (page - 1) * pageSize)
    return db.getReputationLeaderboard(guildId, pageSize, offset)
  }
}
