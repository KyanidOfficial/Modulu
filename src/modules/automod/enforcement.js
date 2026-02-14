const db = require("../../core/database")
const {
  Permissions,
  ensureBotPermissions,
  ensureModeratable
} = require("../../core/moderation/permissionGuard")

const actionPermission = actionType => {
  if (actionType === "timeout") return Permissions.ModerateMembers
  if (actionType === "kick") return Permissions.KickMembers
  if (actionType === "ban") return Permissions.BanMembers
  return null
}

module.exports = {
  async execute({ member, message, decision, idempotencyKey }) {
    const requiredPermission = actionPermission(decision.actionType)

    if (requiredPermission) {
      const botPermissionCheck = ensureBotPermissions({
        guild: member.guild,
        targetMember: member,
        requiredPermission,
        action: decision.actionType
      })
      if (!botPermissionCheck.ok) {
        return { skipped: true, actionType: decision.actionType, reason: botPermissionCheck.reason }
      }

      const moderatableCheck = ensureModeratable({
        targetMember: member,
        action: decision.actionType
      })
      if (!moderatableCheck.ok) {
        return { skipped: true, actionType: decision.actionType, reason: moderatableCheck.reason }
      }
    }

    const acquired = await db.registerActionIdempotency(
      idempotencyKey,
      member.guild.id,
      member.id,
      decision.actionType
    )

    if (!acquired) return { skipped: true, actionType: decision.actionType }

    if (decision.actionType === "timeout") {
      await member.timeout(decision.durationMs, "Automod escalation")
    } else if (decision.actionType === "kick") {
      await member.kick("Automod escalation")
    } else if (decision.actionType === "ban") {
      await member.ban({ reason: "Automod escalation", deleteMessageSeconds: 0 })
    }

    if (message.deletable) {
      await message.delete().catch(() => null)
    }

    return { skipped: false, actionType: decision.actionType }
  }
}
