'use strict'

const { resolveModerationAccess } = require('./permissionResolver')

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000

const normalizeReason = reason => {
  if (typeof reason !== 'string') return 'No reason provided'
  const trimmed = reason.trim()
  return trimmed.length ? trimmed : 'No reason provided'
}

const hasRoleHierarchyIssue = (executor, target) => {
  if (!executor || !target) return false
  const execRole = executor.roles && executor.roles.highest
  const targetRole = target.roles && target.roles.highest
  if (!execRole || !targetRole) return false
  return targetRole.position >= execRole.position
}

const validateTargetState = (commandName, state) => {
  if (!state) return null
  if (commandName === 'ban' && state.banned) return 'User already banned'
  if (commandName === 'unban' && !state.banned) return 'User is not banned'
  if (commandName === 'mute' && state.muted) return 'User already muted'
  if (commandName === 'unmute' && !state.muted) return 'User is not muted'
  if (commandName === 'timeout' && state.timedOut) return 'User already timed out'
  if (commandName === 'untimeout' && !state.timedOut) return 'User is not timed out'
  return null
}

const guardCommand = async ({
  commandName,
  interaction,
  requiredDiscordPerms = [],
  requireGuild = true,
  requireTarget = false,
  durationMs = null,
  reason = null,
  target = null,
  commandEnabled = true
}) => {
  if (!commandEnabled) {
    return { allowed: false, error: 'This command is disabled by developers.' }
  }

  if (!interaction) {
    return { allowed: false, error: 'Missing interaction' }
  }

  const guild = interaction.guild
  if (requireGuild && !guild) {
    return { allowed: false, error: 'Guild only command' }
  }

  const executor = interaction.member
  if (requiredDiscordPerms.length) {
    const access = await resolveModerationAccess({
      guildId: guild && guild.id,
      member: executor,
      requiredDiscordPerms
    })
    if (!access.allowed) {
      return { allowed: false, error: access.reason }
    }

    const botPerms = guild && guild.members && guild.members.me && guild.members.me.permissions
    if (!botPerms || !botPerms.has(requiredDiscordPerms)) {
      return { allowed: false, error: 'Bot lacks permissions' }
    }
  }

  if (requireTarget && !target) {
    return { allowed: false, error: 'Target not found' }
  }

  if (target && interaction.user && target.id === interaction.user.id) {
    return { allowed: false, error: 'Cannot target yourself' }
  }

  if (target && guild && guild.members && guild.members.me && target.id === guild.members.me.id) {
    return { allowed: false, error: 'Cannot target bot' }
  }

  if (target && guild && guild.ownerId && target.id === guild.ownerId) {
    return { allowed: false, error: 'Cannot target server owner' }
  }

  if (target && hasRoleHierarchyIssue(executor, target)) {
    return { allowed: false, error: 'Role hierarchy issue' }
  }

  const stateIssue = validateTargetState(commandName, interaction.targetState)
  if (stateIssue) {
    return { allowed: false, error: stateIssue }
  }

  if (durationMs !== null) {
    if (!Number.isInteger(durationMs) || durationMs <= 0) {
      return { allowed: false, error: 'Invalid duration' }
    }
    if (durationMs > MAX_TIMEOUT_MS) {
      return { allowed: false, error: 'Duration exceeds maximum' }
    }
  }

  return { allowed: true, reason: normalizeReason(reason) }
}

module.exports = { guardCommand }
