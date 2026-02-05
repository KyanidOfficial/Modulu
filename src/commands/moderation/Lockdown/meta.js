'use strict'

const { guardCommand } = require('../../../utils/commandGuard.js')

const COMMAND_ENABLED = true

module.exports = {
  name: 'lockdown-meta',
  description: 'lockdown-meta command',
  data: { name: 'lockdown-meta', description: 'lockdown-meta command' },
  COMMAND_ENABLED,
  execute: async interaction => {
    const guild = interaction && interaction.guild
    const target = interaction && interaction.options && interaction.options.getMember ? interaction.options.getMember('user') : null
    const durationMs = null
    const reason = interaction && interaction.options && interaction.options.getString ? interaction.options.getString('reason') : null

    const guard = await guardCommand({
      commandName: 'lockdown',
      interaction,
      requiredDiscordPerms: ['ModerateMembers'],
      requireGuild: true,
      requireTarget: false,
      durationMs,
      reason,
      target,
      commandEnabled: COMMAND_ENABLED
    })
    if (!guard.allowed) return { error: guard.error }

    return { ok: true, reason: guard.reason }
  }
}
