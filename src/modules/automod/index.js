const db = require("../../core/database")
const { report } = require("../../core/observability/errorHandler")
const logger = require("../../core/observability/logger")
const slidingWindow = require("./slidingWindow")
const ruleEngine = require("./ruleEngine")
const escalationPolicy = require("./escalationPolicy")
const enforcement = require("./enforcement")
const caseModule = require("../case")
const reputation = require("../reputation")

const hasBypass = (member, config) => {
  const roleIds = member.roles.cache.map(r => r.id)
  const bypass = new Set([...(config.bypassRoleIds || []), ...(config.staffRoleIds || [])])
  return roleIds.some(id => bypass.has(id)) || member.permissions.has("ModerateMembers")
}

module.exports = {
  async handleMessage(message) {
    if (!message.guild || !message.member || message.author.bot) return

    const guildId = message.guild.id
    const userId = message.author.id

    try {
      const config = await db.getAutomodConfig(guildId)
      if (!config.enabled) return
      if (hasBypass(message.member, config)) return

      const stats = slidingWindow.record({
        guildId,
        userId,
        contentHash: (message.content || "").trim().toLowerCase(),
        burstWindowMs: config.thresholds.burstWindowMs
      })

      const violation = ruleEngine.evaluate({ message, config, stats })
      if (!violation.violated) return

      const infractionCount = await db.getInfractionsCount(guildId, userId)
      const rep = await db.getReputation(guildId, userId)
      const trustAdjustment = rep.score < 0 ? 1 : 0
      const decision = escalationPolicy.resolveAction({ config, infractionCount, trustAdjustment })
      const idempotencyKey = `${guildId}:${userId}:${message.id}:${violation.type}:${decision.actionType}`

      const actionResult = await enforcement.execute({
        member: message.member,
        message,
        decision,
        idempotencyKey
      })

      if (actionResult.skipped) return

      const caseId = await caseModule.createModerationCase({
        guild: message.guild,
        targetUser: message.author,
        actorId: "SYSTEM",
        actionType: decision.actionType,
        reason: `AutoMod: ${violation.type}`,
        sourceMessage: message
      })

      await db.createInfraction({
        guildId,
        userId,
        caseId,
        type: violation.type,
        severity: decision.severity,
        sourceMessageId: message.id
      })

      const delta = config.reputationImpact[decision.actionType] || -1
      await reputation.applyImpact({
        guildId,
        userId,
        delta,
        sourceType: "INFRACTION",
        caseId,
        metadata: { violationType: violation.type, actionType: decision.actionType }
      })

      logger.info("automod.triggered", {
        guildId,
        userId,
        caseId,
        violationType: violation.type,
        actionType: decision.actionType
      })
    } catch (error) {
      await report({
        error,
        context: {
          module: "automod",
          guildId,
          userId,
          messageId: message.id
        }
      })
    }
  }
}
