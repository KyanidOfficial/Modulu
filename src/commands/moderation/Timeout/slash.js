'use strict'

const { resolveModerationAccess } = require('../../../utils/permissionResolver')

module.exports = {
  name: 'timeout',
  description: 'timeout command',
  data: { name: 'timeout', description: 'timeout command' },
  COMMAND_ENABLED: true,
  execute: async interaction => {
    const guild = interaction && interaction.guild
    if (!guild) return { error: 'Missing guild' }

    const executor = interaction.member
    const target = interaction.options && interaction.options.getMember ? interaction.options.getMember('user') : null
    const duration = interaction.options && interaction.options.getInteger ? interaction.options.getInteger('duration') : null

    const access = await resolveModerationAccess({
      guildId: guild.id,
      member: executor,
      requiredDiscordPerms: ['ModerateMembers']
    })
    if (!access.allowed) return { error: access.reason }

    if (!target) return { error: 'Member not found' }
    if (target.id === interaction.user.id) return { error: 'Cannot timeout self' }
    if (guild.ownerId && target.id === guild.ownerId) return { error: 'Cannot timeout owner' }
    if (guild.members && guild.members.me && target.id === guild.members.me.id) return { error: 'Cannot timeout bot' }

    if (!Number.isInteger(duration) || duration <= 0) {
      return { error: 'Invalid duration' }
    }

    if (executor && executor.roles && executor.roles.highest && target.roles && target.roles.highest) {
      if (target.roles.highest.position >= executor.roles.highest.position) {
        return { error: 'Role hierarchy issue' }
      }
    }

    return { ok: true }
  }
}
