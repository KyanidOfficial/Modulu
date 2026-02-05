'use strict'

const { guardCommand } = require('../../../utils/commandGuard.js')

const COMMAND_ENABLED = true

module.exports = {
  name: 'warn-prefix',
  description: 'warn-prefix command',
  data: { name: 'warn-prefix', description: 'warn-prefix command' },
  COMMAND_ENABLED,
  execute: async interaction => {
    const guild = interaction && interaction.guild
    const target = interaction && interaction.options && interaction.options.getUser ? interaction.options.getUser('user') : null
    const durationMs = null
    const reason = interaction && interaction.options && interaction.options.getString ? interaction.options.getString('reason') : null

    const guard = await guardCommand({
      commandName: 'warn',
      interaction,
      requiredDiscordPerms: ['ModerateMembers'],
      requireGuild: true,
      requireTarget: true,
      durationMs,
      reason,
      target,
      commandEnabled: COMMAND_ENABLED
    })
    if (!guard.allowed) return { error: guard.error }

    return { ok: true, reason: guard.reason }
  }
}
