const { PermissionsBitField } = require("discord.js")

const moderationError = reason => ({ ok: false, reason })

const ensureActionableTarget = ({ guild, executor, targetMember, action }) => {
  if (!guild || !executor || !targetMember) {
    return moderationError("Invalid moderation context")
  }

  if (targetMember.id === executor.id) {
    return moderationError(`You cannot ${action} yourself`)
  }

  if (targetMember.id === guild.ownerId) {
    return moderationError("Cannot moderate the server owner")
  }

  if (targetMember.roles.highest.position >= executor.roles.highest.position && executor.id !== guild.ownerId) {
    return moderationError("Role hierarchy issue")
  }

  return { ok: true }
}

const ensureBotPermissions = ({ guild, targetMember, requiredPermission, action }) => {
  const me = guild?.members?.me
  if (!me) return moderationError("Bot member unavailable")

  if (!me.permissions.has(requiredPermission)) {
    return moderationError(`Bot lacks required permission for ${action}`)
  }

  if (targetMember.id === me.id) {
    return moderationError(`Cannot ${action} the bot user`)
  }

  if (me.roles.highest.position <= targetMember.roles.highest.position) {
    return moderationError("Bot role is not high enough")
  }

  return { ok: true }
}

const ensureModeratable = ({ targetMember, action }) => {
  if (action === "timeout" && !targetMember.moderatable) {
    return moderationError("Target is not moderatable")
  }

  if (action === "kick" && !targetMember.kickable) {
    return moderationError("Target is not kickable")
  }

  if (action === "ban" && !targetMember.bannable) {
    return moderationError("Target is not bannable")
  }

  if (!targetMember.manageable && action !== "ban") {
    return moderationError("Target is not manageable")
  }

  return { ok: true }
}

module.exports = {
  Permissions: PermissionsBitField.Flags,
  ensureActionableTarget,
  ensureBotPermissions,
  ensureModeratable
}
