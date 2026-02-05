'use strict'

const db = require('../core/database')

const normalizeRoles = roles => {
  if (!roles || typeof roles !== 'object') return null
  const moderators = Array.isArray(roles.moderators) ? roles.moderators : null
  const administrators = Array.isArray(roles.administrators) ? roles.administrators : null
  if (!moderators || !administrators) return null
  return { moderators, administrators }
}

const resolveModerationAccess = async ({ guildId, member, requiredDiscordPerms = [] }) => {
  if (!guildId || !member) {
    return { allowed: false, reason: 'Invalid guild or member context' }
  }

  let data
  try {
    data = await db.get(guildId)
  } catch {
    return { allowed: false, reason: 'Server configuration unavailable' }
  }

  const setup = data && data.setup ? data.setup : null
  if (!setup || !setup.completed) {
    return { allowed: false, reason: 'Server setup incomplete' }
  }

  const roles = normalizeRoles(setup.roles)
  if (!roles) {
    return { allowed: false, reason: 'Server roles not configured' }
  }

  if (requiredDiscordPerms.length && member.permissions && member.permissions.has(requiredDiscordPerms)) {
    return { allowed: true, reason: 'Discord permissions granted' }
  }

  const hasAdmin = roles.administrators.some(roleId => member.roles && member.roles.cache && member.roles.cache.has(roleId))
  if (hasAdmin) {
    return { allowed: true, reason: 'Administrator role granted' }
  }

  const hasMod = roles.moderators.some(roleId => member.roles && member.roles.cache && member.roles.cache.has(roleId))
  if (hasMod) {
    return { allowed: true, reason: 'Moderator role granted' }
  }

  return { allowed: false, reason: 'Missing moderation permissions' }
}

module.exports = { resolveModerationAccess }
