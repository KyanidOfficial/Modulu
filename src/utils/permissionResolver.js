const db = require("../core/database")

const normalizeRoles = roles => {
  if (!roles || typeof roles !== "object") return null
  const { moderators, administrators } = roles
  if (!Array.isArray(moderators) || !Array.isArray(administrators)) return null
  return { moderators, administrators }
}

const resolveModerationAccess = async ({ guildId, member, requiredDiscordPerms = [] }) => {
  if (!guildId || !member) {
    return { allowed: false, reason: "Invalid guild or member context" }
  }

  let data
  try {
    data = await db.get(guildId)
  } catch {
    return { allowed: false, reason: "Server configuration unavailable" }
  }

  const setup = data?.setup
  if (!setup?.completed) {
    return { allowed: false, reason: "Server setup incomplete" }
  }

  const roles = normalizeRoles(setup.roles)
  if (!roles) {
    return { allowed: false, reason: "Server roles not configured" }
  }

  if (requiredDiscordPerms.length && member.permissions?.has(requiredDiscordPerms)) {
    return { allowed: true, reason: "Discord permissions granted" }
  }

  const hasAdminRole = roles.administrators.some(roleId => member.roles.cache.has(roleId))
  if (hasAdminRole) {
    return { allowed: true, reason: "Administrator role granted" }
  }

  const hasModRole = roles.moderators.some(roleId => member.roles.cache.has(roleId))
  if (hasModRole) {
    return { allowed: true, reason: "Moderator role granted" }
  }

  return { allowed: false, reason: "Missing moderation permissions" }
}

module.exports = { resolveModerationAccess }
