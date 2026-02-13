const db = require("../../core/database")
const logger = require("../../core/observability/logger")
const logAction = require("../../utils/logAction")
const logEmbed = require("../../messages/embeds/log.embed")
const contextCollector = require("./contextCollector")

module.exports = {
  async createModerationCase({ guild, targetUser, actorId, actionType, reason, sourceMessage }) {
    const config = await db.getAutomodConfig(guild.id)
    const contextLimit = config.contextMessageLimit || 10
    const contextMessages = contextCollector.collect({
      guild,
      targetUserId: targetUser.id,
      limit: contextLimit
    })

    const context = {
      sourceMessageId: sourceMessage?.id || null,
      sourceChannelId: sourceMessage?.channel?.id || null,
      messages: contextMessages
    }

    const caseId = await db.createCase({
      guildId: guild.id,
      userId: targetUser.id,
      actorId,
      actionType,
      reason,
      context
    })

    await logAction(
      guild,
      logEmbed({
        punishment: actionType,
        user: `<@${targetUser.id}>`,
        moderator: actorId === "SYSTEM" ? "AutoMod" : `<@${actorId}>`,
        reason,
        caseId,
        color: 0xff9900
      })
    )

    logger.info("case.created", { guildId: guild.id, caseId, userId: targetUser.id, actionType })
    return caseId
  }
}
